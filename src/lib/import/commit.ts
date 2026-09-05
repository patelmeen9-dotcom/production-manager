import { DateInputType, ImportDuplicateStrategy, OrderLifecycleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseDateOnly, resolveDueDate, resolveEffectiveStartDate } from "@/lib/orders/date-rules";
import type { ImportPreviewPayload } from "@/lib/import/types";
import { normalizeCode } from "@/lib/import/parse";

export async function commitImportPayload(input: {
  organizationId: string;
  userId: string;
  payload: ImportPreviewPayload;
}): Promise<{ successfulRows: number }> {
  let successfulRows = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of input.payload.plants) {
      if (row.action === "skip") {
        continue;
      }
      await tx.plant.upsert({
        where: { organizationId_code: { organizationId: input.organizationId, code: row.code } },
        update: row.action === "update" ? { name: row.name, location: row.location, isActive: row.isActive } : {},
        create: {
          organizationId: input.organizationId,
          code: row.code,
          name: row.name,
          location: row.location,
          isActive: row.isActive,
        },
      });
      successfulRows += 1;
    }

    for (const row of input.payload.clients) {
      if (row.action === "skip") {
        continue;
      }
      await tx.client.upsert({
        where: { organizationId_code: { organizationId: input.organizationId, code: row.code } },
        update:
          row.action === "update"
            ? {
                name: row.name,
                contactName: row.contactName,
                contactEmail: row.contactEmail,
                contactPhone: row.contactPhone,
                isActive: row.isActive,
              }
            : {},
        create: {
          organizationId: input.organizationId,
          code: row.code,
          name: row.name,
          contactName: row.contactName,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          isActive: row.isActive,
        },
      });
      successfulRows += 1;
    }

    for (const row of input.payload.products) {
      if (row.action === "skip") {
        continue;
      }
      await tx.product.upsert({
        where: { organizationId_code: { organizationId: input.organizationId, code: row.code } },
        update: row.action === "update" ? { name: row.name, isActive: row.isActive } : {},
        create: {
          organizationId: input.organizationId,
          code: row.code,
          name: row.name,
          isActive: row.isActive,
        },
      });
      successfulRows += 1;
    }

    for (const row of input.payload.processes) {
      if (row.action === "skip") {
        continue;
      }
      await tx.process.upsert({
        where: { organizationId_code: { organizationId: input.organizationId, code: row.code } },
        update: row.action === "update" ? { name: row.name, description: row.description, isActive: row.isActive } : {},
        create: {
          organizationId: input.organizationId,
          code: row.code,
          name: row.name,
          description: row.description,
          isActive: row.isActive,
        },
      });
      successfulRows += 1;
    }

    const plants = await tx.plant.findMany({ where: { organizationId: input.organizationId } });
    const clients = await tx.client.findMany({ where: { organizationId: input.organizationId } });
    const products = await tx.product.findMany({ where: { organizationId: input.organizationId } });
    const processes = await tx.process.findMany({ where: { organizationId: input.organizationId } });
    const plantId = (code: string) => plants.find((row) => normalizeCode(row.code) === code)?.id;
    const clientId = (code: string) => clients.find((row) => normalizeCode(row.code) === code)?.id;
    const productId = (code: string) => products.find((row) => normalizeCode(row.code) === code)?.id;
    const processId = (code: string) => processes.find((row) => normalizeCode(row.code) === code)?.id;

    for (const row of input.payload.mappings) {
      if (row.action === "skip") {
        continue;
      }
      const plant = plantId(row.plantCode);
      const product = productId(row.productCode);
      if (!plant || !product) {
        throw new Error(`Mapping references missing plant/product: ${row.plantCode}/${row.productCode}`);
      }
      await tx.plantProductProcessMapping.deleteMany({
        where: { organizationId: input.organizationId, plantId: plant, productId: product },
      });
      await tx.plantProductProcessMapping.createMany({
        data: row.processCodes.map((code, index) => ({
          organizationId: input.organizationId,
          plantId: plant,
          productId: product,
          processId: processId(code)!,
          sequence: index + 1,
          isActive: true,
        })),
      });
      successfulRows += 1;
    }

    for (const row of input.payload.specialActivities) {
      if (row.action === "skip") {
        continue;
      }
      await tx.specialActivity.upsert({
        where: { organizationId_code: { organizationId: input.organizationId, code: row.code } },
        update: row.action === "update" ? { name: row.name, activityType: row.activityType, isActive: row.isActive } : {},
        create: {
          organizationId: input.organizationId,
          code: row.code,
          name: row.name,
          activityType: row.activityType,
          isActive: row.isActive,
        },
      });
      successfulRows += 1;
    }

    const activities = await tx.specialActivity.findMany({ where: { organizationId: input.organizationId } });
    const activityId = (code: string) => activities.find((row) => normalizeCode(row.code) === code)?.id;

    const generalCategory = await tx.productCategory.upsert({
      where: {
        organizationId_code: { organizationId: input.organizationId, code: "GENERAL" },
      },
      update: { isActive: true, inputType: "OPEN_TEXT", choiceMode: null },
      create: {
        organizationId: input.organizationId,
        code: "GENERAL",
        name: "General",
        inputType: "OPEN_TEXT",
        isActive: true,
      },
    });

    for (const row of input.payload.projects) {
      if (row.action === "skip") {
        continue;
      }
      const plant = plantId(row.plantCode);
      const client = clientId(row.clientCode);
      const product = productId(row.productCode);
      if (!plant || !client || !product) {
        throw new Error(`Project ${row.projectCode} references missing master data.`);
      }

      const orderDate = parseDateOnly(row.orderDate);
      const effectiveStartDate = resolveEffectiveStartDate({
        orderDate,
        startDateType: row.startDateType,
        startDate: row.startDate ? parseDateOnly(row.startDate) : null,
        startDays: row.startDays,
      });
      const resolvedDueDate = resolveDueDate({
        orderDate,
        effectiveStartDate,
        dueDateType: row.dueDateType,
        dueDate: row.dueDate ? parseDateOnly(row.dueDate) : null,
        dueDays: row.dueDays,
      });

      const existing = await tx.productionOrder.findUnique({
        where: { organizationId_orderNumber: { organizationId: input.organizationId, orderNumber: row.projectCode } },
        include: { processes: true },
      });

      if (existing) {
        if (row.action === "update") {
          await tx.productionOrder.update({
            where: { id: existing.id },
            data: {
              clientId: client,
              plantId: plant,
              productId: product,
              quantity: row.quantity,
              orderDate,
              startDateType: row.startDateType as DateInputType,
              startDate: row.startDateType === "FIXED_DATE" && row.startDate ? parseDateOnly(row.startDate) : null,
              startDays: row.startDateType === "DAYS_FROM_ORDER" ? row.startDays : null,
              effectiveStartDate,
              dueDateType: row.dueDateType as DateInputType,
              dueDate: row.dueDateType === "FIXED_DATE" && row.dueDate ? parseDateOnly(row.dueDate) : null,
              dueDays:
                row.dueDateType === "DAYS_FROM_ORDER" || row.dueDateType === "DAYS_FROM_START" ? row.dueDays : null,
              resolvedDueDate,
              priority: row.priority,
              remarks: row.remarks,
            },
          });
          // Never silently replace historical process snapshot.
        }
        successfulRows += 1;
        continue;
      }

      const created = await tx.productionOrder.create({
        data: {
          organizationId: input.organizationId,
          plantId: plant,
          clientId: client,
          productId: product,
          createdByUserId: input.userId,
          orderNumber: row.projectCode,
          quantity: row.quantity,
          orderDate,
          startDateType: row.startDateType as DateInputType,
          startDate: row.startDateType === "FIXED_DATE" && row.startDate ? parseDateOnly(row.startDate) : null,
          startDays: row.startDateType === "DAYS_FROM_ORDER" ? row.startDays : null,
          effectiveStartDate,
          dueDateType: row.dueDateType as DateInputType,
          dueDate: row.dueDateType === "FIXED_DATE" && row.dueDate ? parseDateOnly(row.dueDate) : null,
          dueDays:
            row.dueDateType === "DAYS_FROM_ORDER" || row.dueDateType === "DAYS_FROM_START" ? row.dueDays : null,
          resolvedDueDate,
          priority: row.priority,
          remarks: row.remarks,
          lifecycleStatus: OrderLifecycleStatus.NOT_STARTED,
        },
      });

      await tx.productCategoryAssignment.upsert({
        where: {
          productId_productCategoryId: {
            productId: product,
            productCategoryId: generalCategory.id,
          },
        },
        update: {},
        create: {
          organizationId: input.organizationId,
          productId: product,
          productCategoryId: generalCategory.id,
        },
      });

      const createdLine = await tx.productionOrderLine.create({
        data: {
          organizationId: input.organizationId,
          productionOrderId: created.id,
          productId: product,
          quantity: row.quantity,
          lineNumber: 1,
        },
      });

      await tx.productionOrderProcess.createMany({
        data: row.processCodes.map((code, index) => {
          const process = processes.find((item) => normalizeCode(item.code) === code);
          return {
            organizationId: input.organizationId,
            productionOrderId: created.id,
            productionOrderLineId: createdLine.id,
            processId: process?.id ?? null,
            processName: process?.name ?? code,
            processCode: code,
            sequence: index + 1,
            plannedQuantity: row.quantity,
          };
        }),
      });
      successfulRows += 1;
    }

    const orders = await tx.productionOrder.findMany({
      where: { organizationId: input.organizationId },
      include: { processes: true },
    });
    const orderByCode = new Map(orders.map((order) => [normalizeCode(order.orderNumber), order]));

    for (const row of input.payload.productionEntries) {
      const order = orderByCode.get(row.projectCode);
      if (!order) {
        throw new Error(`Production entry references missing project ${row.projectCode}`);
      }
      const stage = order.processes.find((process) => normalizeCode(process.processCode) === row.processCode);
      if (!stage) {
        throw new Error(`Production entry process ${row.processCode} missing on ${row.projectCode}`);
      }
      await tx.productionEntry.create({
        data: {
          organizationId: input.organizationId,
          plantId: order.plantId,
          productionOrderId: order.id,
          orderProcessId: stage.id,
          entryDate: parseDateOnly(row.entryDate),
          quantity: row.quantity,
          remarks: row.remarks,
          createdByUserId: input.userId,
        },
      });
      if (order.lifecycleStatus === OrderLifecycleStatus.NOT_STARTED) {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: { lifecycleStatus: OrderLifecycleStatus.IN_PRODUCTION },
        });
        order.lifecycleStatus = OrderLifecycleStatus.IN_PRODUCTION;
      }
      successfulRows += 1;
    }

    for (const row of input.payload.specialActivityEntries) {
      const order = orderByCode.get(row.projectCode);
      const activity = activityId(row.activityCode);
      if (!order || !activity) {
        throw new Error(`Special activity entry references missing project/activity`);
      }
      const stage = row.processCode
        ? order.processes.find((process) => normalizeCode(process.processCode) === row.processCode)
        : null;
      await tx.specialActivityEntry.create({
        data: {
          organizationId: input.organizationId,
          plantId: order.plantId,
          productionOrderId: order.id,
          specialActivityId: activity,
          orderProcessId: stage?.id ?? null,
          entryDate: parseDateOnly(row.entryDate),
          quantity: row.quantity,
          remarks: row.remarks,
          createdByUserId: input.userId,
        },
      });
      successfulRows += 1;
    }

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "IMPORT_COMMIT",
        entityType: "ImportJob",
        entityId: "batch",
        newValue: { successfulRows } as Prisma.InputJsonValue,
        reason: "Confirmed Excel import after validation preview.",
      },
    });
  });

  return { successfulRows };
}

export function toPrismaDuplicateStrategy(value: string): ImportDuplicateStrategy {
  if (value === "SKIP_EXISTING") {
    return ImportDuplicateStrategy.SKIP_EXISTING;
  }
  if (value === "FAIL_ON_DUPLICATE") {
    return ImportDuplicateStrategy.FAIL_ON_DUPLICATE;
  }
  return ImportDuplicateStrategy.CREATE_OR_UPDATE;
}
