"use server";

import { revalidatePath } from "next/cache";
import { DateInputType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { uniqueConstraintMessage } from "@/lib/db-errors";
import { requireMasterWriter } from "@/lib/masters/auth";
import { requireGrantedPlant } from "@/lib/plants/access";
import { parseDateOnly, resolveDueDate, resolveEffectiveStartDate } from "@/lib/orders/date-rules";
import { buildOrderProcessSnapshot } from "@/lib/orders/snapshot";
import { writeAuditLog } from "@/lib/audit/write";
import { productionOrderSchema } from "@/lib/validation/orders";
import { redirectAfterSave } from "@/lib/forms/redirect";
import { rethrowNextNavigation } from "@/lib/forms/navigation";
import type { FormState } from "@/lib/masters/actions";

function optionalInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createProductionOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let successMessage = "";
  try {
    const context = await requireMasterWriter();
    const specialActivityIds = formData.getAll("specialActivityIds").map(String).filter(Boolean);
    const parsed = productionOrderSchema.safeParse({
      clientId: formData.get("clientId"),
      orderNumber: formData.get("orderNumber"),
      plantId: formData.get("plantId"),
      productId: formData.get("productId"),
      quantity: formData.get("quantity"),
      orderDate: formData.get("orderDate"),
      startDateType: formData.get("startDateType"),
      startDate: formData.get("startDate") ?? "",
      startDays: formData.get("startDays") ?? "",
      dueDateType: formData.get("dueDateType"),
      dueDate: formData.get("dueDate") ?? "",
      dueDays: formData.get("dueDays") ?? "",
      priority: formData.get("priority"),
      remarks: formData.get("remarks") ?? "",
      specialActivitiesRequested: formData.get("specialActivitiesRequested") === "on",
      specialActivityIds,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid order." };
    }

    await requireGrantedPlant(context, parsed.data.plantId);

    if (parsed.data.specialActivitiesRequested && parsed.data.specialActivityIds.length === 0) {
      return { error: "Select at least one special activity, or turn off special activities." };
    }
    if (!parsed.data.specialActivitiesRequested && parsed.data.specialActivityIds.length > 0) {
      return { error: "Clear special activity selections when special activities are not requested." };
    }

    const [client, product, mapping, activities] = await Promise.all([
      prisma.client.findFirst({
        where: { id: parsed.data.clientId, organizationId: context.organizationId, isActive: true },
      }),
      prisma.product.findFirst({
        where: { id: parsed.data.productId, organizationId: context.organizationId, isActive: true },
      }),
      prisma.plantProductProcessMapping.findMany({
        where: {
          organizationId: context.organizationId,
          plantId: parsed.data.plantId,
          productId: parsed.data.productId,
          isActive: true,
        },
        include: { process: true },
        orderBy: { sequence: "asc" },
      }),
      parsed.data.specialActivityIds.length > 0
        ? prisma.specialActivity.findMany({
            where: {
              organizationId: context.organizationId,
              isActive: true,
              id: { in: parsed.data.specialActivityIds },
            },
          })
        : Promise.resolve([]),
    ]);

    if (!client) {
      return { error: "Client not found in this organization." };
    }
    if (!product) {
      return { error: "Product not found in this organization." };
    }
    if (activities.length !== parsed.data.specialActivityIds.length) {
      return { error: "One or more special activities are invalid for this organization." };
    }

    const orderDate = parseDateOnly(parsed.data.orderDate);
    const startDateType = parsed.data.startDateType as DateInputType;
    const dueDateType = parsed.data.dueDateType as DateInputType;
    const startDate = parsed.data.startDate ? parseDateOnly(parsed.data.startDate) : null;
    const dueDate = parsed.data.dueDate ? parseDateOnly(parsed.data.dueDate) : null;
    const startDays = optionalInt(parsed.data.startDays);
    const dueDays = optionalInt(parsed.data.dueDays);

    const effectiveStartDate = resolveEffectiveStartDate({
      orderDate,
      startDateType,
      startDate,
      startDays,
    });
    const resolvedDueDate = resolveDueDate({
      orderDate,
      effectiveStartDate,
      dueDateType,
      dueDate,
      dueDays,
    });

    const snapshot = buildOrderProcessSnapshot(mapping, parsed.data.quantity);
    const usesDueDays = dueDateType === DateInputType.DAYS_FROM_ORDER || dueDateType === DateInputType.DAYS_FROM_START;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.productionOrder.create({
        data: {
          organizationId: context.organizationId,
          plantId: parsed.data.plantId,
          clientId: client.id,
          productId: product.id,
          createdByUserId: context.userId,
          orderNumber: parsed.data.orderNumber.trim(),
          quantity: parsed.data.quantity,
          orderDate,
          startDateType,
          startDate: startDateType === DateInputType.FIXED_DATE ? startDate : null,
          startDays: startDateType === DateInputType.DAYS_FROM_ORDER ? startDays : null,
          effectiveStartDate,
          dueDateType,
          dueDate: dueDateType === DateInputType.FIXED_DATE ? dueDate : null,
          dueDays: usesDueDays ? dueDays : null,
          resolvedDueDate,
          priority: parsed.data.priority,
          remarks: parsed.data.remarks || null,
          specialActivitiesRequested: parsed.data.specialActivitiesRequested,
        },
      });

      await tx.productionOrderProcess.createMany({
        data: snapshot.map((step) => ({
          organizationId: context.organizationId,
          productionOrderId: created.id,
          processId: step.processId,
          processName: step.processName,
          processCode: step.processCode,
          sequence: step.sequence,
          plannedQuantity: step.plannedQuantity,
        })),
      });

      if (activities.length > 0) {
        await tx.productionOrderSpecialActivity.createMany({
          data: activities.map((activity) => ({
            organizationId: context.organizationId,
            productionOrderId: created.id,
            specialActivityId: activity.id,
          })),
        });
      }

      return created;
    });

    revalidatePath("/orders");
    await writeAuditLog({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CREATE",
      entityType: "ProductionOrder",
      entityId: order.id,
      newValue: {
        orderNumber: order.orderNumber,
        quantity: order.quantity,
        plantId: order.plantId,
        specialActivitiesRequested: order.specialActivitiesRequested,
        specialActivityIds: activities.map((activity) => activity.id),
      },
    });
    successMessage = `Order ${order.orderNumber} created with a process snapshot.`;
  } catch (error) {
    rethrowNextNavigation(error);
    return {
      error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not create order."),
    };
  }

  redirectAfterSave("/orders", successMessage);
}
