"use server";

import { OrderLifecycleStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { uniqueConstraintMessage } from "@/lib/db-errors";
import { writeAuditLog } from "@/lib/audit/write";
import { parseDateOnly } from "@/lib/orders/date-rules";
import { requireGrantedPlant } from "@/lib/plants/access";
import { requireProductionRecorder } from "@/lib/production/auth";
import { assertValidProductionEntry } from "@/lib/production/validate";
import { evaluateOrder } from "@/lib/production/engine";
import { parseOrganizationSettings } from "@/lib/organization-settings";
import { productionEntrySchema, specialActivityEntrySchema } from "@/lib/validation/production";
import { redirectAfterSave } from "@/lib/forms/redirect";
import { rethrowNextNavigation } from "@/lib/forms/navigation";
import type { FormState } from "@/lib/masters/actions";

export async function createProductionEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let successMessage = "";
  let listPath = "/entries";
  try {
    const context = await requireProductionRecorder();
    const parsed = productionEntrySchema.safeParse({
      productionOrderId: formData.get("productionOrderId"),
      orderProcessId: formData.get("orderProcessId"),
      entryDate: formData.get("entryDate"),
      quantity: formData.get("quantity"),
      remarks: formData.get("remarks") ?? "",
      specialActivityId: formData.get("specialActivityId") ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid entry." };
    }

    const order = await prisma.productionOrder.findFirst({
      where: { id: parsed.data.productionOrderId, organizationId: context.organizationId },
      include: {
        processes: { orderBy: { sequence: "asc" } },
        requestedSpecialActivities: true,
      },
    });
    if (!order) {
      return { error: "Order not found." };
    }
    await requireGrantedPlant(context, order.plantId);

    const specialActivityId = parsed.data.specialActivityId || null;
    if (specialActivityId) {
      if (!order.specialActivitiesRequested) {
        return { error: "This order does not have special activities requested." };
      }
      const allowed = order.requestedSpecialActivities.some((row) => row.specialActivityId === specialActivityId);
      if (!allowed) {
        return { error: "Selected special activity is not requested on this order." };
      }
    }

    const existing = await prisma.productionEntry.findMany({
      where: { organizationId: context.organizationId, productionOrderId: order.id },
      select: { orderProcessId: true, quantity: true },
    });

    assertValidProductionEntry({
      quantity: parsed.data.quantity,
      lifecycleStatus: order.lifecycleStatus,
      processes: order.processes.map((process) => ({
        id: process.id,
        sequence: process.sequence,
        processName: process.processName,
        processCode: process.processCode,
        plannedQuantity: process.plannedQuantity,
      })),
      orderProcessId: parsed.data.orderProcessId,
      existingEntries: existing,
    });

    const organization = await prisma.organization.findFirstOrThrow({ where: { id: context.organizationId } });
    const settings = parseOrganizationSettings(organization.settings);
    const entryDate = parseDateOnly(parsed.data.entryDate);

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.productionEntry.create({
        data: {
          organizationId: context.organizationId,
          plantId: order.plantId,
          productionOrderId: order.id,
          orderProcessId: parsed.data.orderProcessId,
          specialActivityId,
          entryDate,
          quantity: parsed.data.quantity,
          remarks: parsed.data.remarks || null,
          createdByUserId: context.userId,
        },
      });

      const after = await tx.productionEntry.findMany({
        where: { organizationId: context.organizationId, productionOrderId: order.id },
        select: { orderProcessId: true, quantity: true, entryDate: true },
      });
      const first = after.reduce((min, row) => (min && min < row.entryDate ? min : row.entryDate), after[0]?.entryDate ?? null);
      const evaluation = evaluateOrder({
        orderQuantity: order.quantity,
        effectiveStartDate: order.effectiveStartDate,
        resolvedDueDate: order.resolvedDueDate,
        lifecycleStatus: order.lifecycleStatus,
        processes: order.processes.map((process) => ({
          id: process.id,
          sequence: process.sequence,
          processName: process.processName,
          processCode: process.processCode,
          plannedQuantity: process.plannedQuantity,
        })),
        entries: after,
        firstEntryDate: first,
        asOfDate: entryDate,
        settings,
      });

      if (order.lifecycleStatus !== OrderLifecycleStatus.CANCELLED && order.lifecycleStatus !== OrderLifecycleStatus.ON_HOLD) {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: { lifecycleStatus: evaluation.derivedLifecycle },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          userId: context.userId,
          action: "CREATE",
          entityType: "ProductionEntry",
          entityId: created.id,
          newValue: {
            orderNumber: order.orderNumber,
            orderProcessId: parsed.data.orderProcessId,
            quantity: parsed.data.quantity,
            entryDate: parsed.data.entryDate,
            specialActivityId,
          },
        },
      });

      return created;
    });

    revalidatePath("/orders");
    revalidatePath(`/orders/${order.id}`);
    revalidatePath("/dashboard");
    revalidatePath("/entries");
    void entry;
    listPath = "/entries";
    successMessage = "Production entry saved as an incremental quantity.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not save entry.") };
  }

  redirectAfterSave(listPath, successMessage);
}

export async function createSpecialActivityEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let successMessage = "";
  let listPath = "/orders";
  try {
    const context = await requireProductionRecorder();
    const parsed = specialActivityEntrySchema.safeParse({
      productionOrderId: formData.get("productionOrderId"),
      specialActivityId: formData.get("specialActivityId"),
      orderProcessId: formData.get("orderProcessId") ?? "",
      entryDate: formData.get("entryDate"),
      quantity: formData.get("quantity"),
      remarks: formData.get("remarks") ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid activity entry." };
    }
    if (parsed.data.quantity <= 0) {
      return { error: "Quantity must be greater than zero." };
    }

    const order = await prisma.productionOrder.findFirst({
      where: { id: parsed.data.productionOrderId, organizationId: context.organizationId },
      include: { processes: true, requestedSpecialActivities: true },
    });
    if (!order) {
      return { error: "Order not found." };
    }
    await requireGrantedPlant(context, order.plantId);

    if (!order.specialActivitiesRequested || order.requestedSpecialActivities.length === 0) {
      return { error: "This order does not request special activities." };
    }
    const requested = order.requestedSpecialActivities.some((row) => row.specialActivityId === parsed.data.specialActivityId);
    if (!requested) {
      return { error: "Activity must be one of the special activities requested on this order." };
    }

    const activity = await prisma.specialActivity.findFirst({
      where: { id: parsed.data.specialActivityId, organizationId: context.organizationId, isActive: true },
    });
    if (!activity) {
      return { error: "Special activity not found." };
    }

    const relatedProcess = parsed.data.orderProcessId
      ? order.processes.find((process) => process.id === parsed.data.orderProcessId)
      : null;
    if (parsed.data.orderProcessId && !relatedProcess) {
      return { error: "Related stage is not part of this order." };
    }

    const created = await prisma.specialActivityEntry.create({
      data: {
        organizationId: context.organizationId,
        plantId: order.plantId,
        productionOrderId: order.id,
        specialActivityId: activity.id,
        orderProcessId: relatedProcess?.id ?? null,
        entryDate: parseDateOnly(parsed.data.entryDate),
        quantity: parsed.data.quantity,
        remarks: parsed.data.remarks || null,
        createdByUserId: context.userId,
      },
    });

    await writeAuditLog({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "CREATE",
      entityType: "SpecialActivityEntry",
      entityId: created.id,
      newValue: { activity: activity.code, quantity: parsed.data.quantity, orderId: order.id },
      reason: "Special/rework activity recorded without changing production history.",
    });

    revalidatePath(`/orders/${order.id}`);
    revalidatePath("/entries");
    listPath = `/orders/${order.id}`;
    successMessage = "Special activity recorded. Original production entries were not changed.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not save activity.") };
  }

  redirectAfterSave(listPath, successMessage);
}
