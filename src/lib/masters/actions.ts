"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { uniqueConstraintMessage, writeErrorMessage } from "@/lib/db-errors";
import { requireMasterWriter } from "@/lib/masters/auth";
import { planCategoryOptionSync } from "@/lib/masters/category-options";
import { assertProcessesBelongToOrganization, buildProcessMappingSteps } from "@/lib/masters/process-mapping";
import { writeAuditLog } from "@/lib/audit/write";
import { logger } from "@/lib/logger";
import { requireGrantedPlant } from "@/lib/plants/access";
import { redirectAfterSave } from "@/lib/forms/redirect";
import { rethrowNextNavigation } from "@/lib/forms/navigation";
import {
  clientSchema,
  processMappingSchema,
  processSchema,
  productCategorySchema,
  productSchema,
  specialActivitySchema,
} from "@/lib/validation/masters";

export type FormState = { error?: string; success?: string };

function emptyToNull(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = clientSchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      contactName: formData.get("contactName") ?? "",
      contactEmail: formData.get("contactEmail") ?? "",
      contactPhone: formData.get("contactPhone") ?? "",
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid client." };
    }
    await prisma.client.create({
      data: {
        organizationId,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        contactName: emptyToNull(parsed.data.contactName),
        contactEmail: emptyToNull(parsed.data.contactEmail),
        contactPhone: emptyToNull(parsed.data.contactPhone),
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/clients");
    message = "Client created.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not create client.") };
  }
  redirectAfterSave("/clients", message);
}

export async function updateClientAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = clientSchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      contactName: formData.get("contactName") ?? "",
      contactEmail: formData.get("contactEmail") ?? "",
      contactPhone: formData.get("contactPhone") ?? "",
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid client." };
    }
    const result = await prisma.client.updateMany({
      where: { id, organizationId },
      data: {
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        contactName: emptyToNull(parsed.data.contactName),
        contactEmail: emptyToNull(parsed.data.contactEmail),
        contactPhone: emptyToNull(parsed.data.contactPhone),
        isActive: parsed.data.isActive,
      },
    });
    if (result.count === 0) {
      return { error: "Client not found." };
    }
    revalidatePath("/clients");
    message = "Client saved.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not update client.") };
  }
  redirectAfterSave("/clients", message);
}

async function syncProductCategories(input: {
  organizationId: string;
  productId: string;
  categoryIds: string[];
}) {
  const uniqueIds = [...new Set(input.categoryIds)];
  if (uniqueIds.length > 0) {
    const categories = await prisma.productCategory.findMany({
      where: { organizationId: input.organizationId, id: { in: uniqueIds } },
      select: { id: true },
    });
    if (categories.length !== uniqueIds.length) {
      throw new AppError("VALIDATION", "One or more product categories are invalid for this organization.", 400);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.productCategoryAssignment.deleteMany({
      where: { organizationId: input.organizationId, productId: input.productId },
    });
    if (uniqueIds.length > 0) {
      await tx.productCategoryAssignment.createMany({
        data: uniqueIds.map((productCategoryId) => ({
          organizationId: input.organizationId,
          productId: input.productId,
          productCategoryId,
        })),
      });
    }
  });
}

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = productSchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      details: formData.get("details") ?? "",
      categoryIds: formData.getAll("categoryIds").map(String).filter(Boolean),
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid product." };
    }
    const product = await prisma.product.create({
      data: {
        organizationId,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        details: emptyToNull(parsed.data.details),
        isActive: parsed.data.isActive,
      },
    });
    await syncProductCategories({
      organizationId,
      productId: product.id,
      categoryIds: parsed.data.categoryIds,
    });
    revalidatePath("/products");
    message = "Product created.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not create product.") };
  }
  redirectAfterSave("/products", message);
}

export async function updateProductAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = productSchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      details: formData.get("details") ?? "",
      categoryIds: formData.getAll("categoryIds").map(String).filter(Boolean),
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid product." };
    }
    const result = await prisma.product.updateMany({
      where: { id, organizationId },
      data: {
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        details: emptyToNull(parsed.data.details),
        isActive: parsed.data.isActive,
      },
    });
    if (result.count === 0) {
      return { error: "Product not found." };
    }
    await syncProductCategories({
      organizationId,
      productId: id,
      categoryIds: parsed.data.categoryIds,
    });
    revalidatePath("/products");
    message = "Product saved.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not update product.") };
  }
  redirectAfterSave("/products", message);
}

function parseCategoryOptions(formData: FormData) {
  const ids = formData.getAll("optionId").map(String);
  const codes = formData.getAll("optionCode").map(String);
  const names = formData.getAll("optionName").map(String);
  const sortOrders = formData.getAll("optionSortOrder").map(String);
  const actives = formData.getAll("optionIsActive").map(String);
  const count = Math.max(codes.length, names.length);
  const options = [];
  for (let index = 0; index < count; index += 1) {
    if (!codes[index]?.trim() && !names[index]?.trim()) {
      continue;
    }
    options.push({
      id: ids[index] ?? "",
      code: codes[index] ?? "",
      name: names[index] ?? "",
      sortOrder: sortOrders[index] ?? "0",
      isActive: (actives[index] ?? "on") === "on",
    });
  }
  return options;
}

export async function createProductCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const inputType = String(formData.get("inputType") ?? "OPEN_TEXT");
    const parsed = productCategorySchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      inputType,
      choiceMode: inputType === "DROPDOWN" ? formData.get("choiceMode") : null,
      isActive: formData.get("isActive") === "on",
      options: inputType === "DROPDOWN" ? parseCategoryOptions(formData) : [],
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid category." };
    }
    await prisma.productCategory.create({
      data: {
        organizationId,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        inputType: parsed.data.inputType,
        choiceMode: parsed.data.inputType === "DROPDOWN" ? parsed.data.choiceMode : null,
        isActive: parsed.data.isActive,
        options:
          parsed.data.inputType === "DROPDOWN"
            ? {
                create: parsed.data.options.map((option, index) => ({
                  organizationId,
                  code: option.code.toUpperCase(),
                  name: option.name,
                  sortOrder: option.sortOrder ?? index,
                  isActive: option.isActive,
                })),
              }
            : undefined,
      },
    });
    revalidatePath("/product-categories");
    message = "Product category created.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not create category.") };
  }
  redirectAfterSave("/product-categories", message);
}

export async function updateProductCategoryAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const inputType = String(formData.get("inputType") ?? "OPEN_TEXT");
    const parsed = productCategorySchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      inputType,
      choiceMode: inputType === "DROPDOWN" ? formData.get("choiceMode") : null,
      isActive: formData.get("isActive") === "on",
      options: inputType === "DROPDOWN" ? parseCategoryOptions(formData) : [],
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid category." };
    }
    const existing = await prisma.productCategory.findFirst({
      where: { id, organizationId },
      include: { options: { select: { id: true, code: true } } },
    });
    if (!existing) {
      return { error: "Product category not found." };
    }
    await prisma.$transaction(async (tx) => {
      await tx.productCategory.update({
        where: { id },
        data: {
          code: parsed.data.code.toUpperCase(),
          name: parsed.data.name,
          inputType: parsed.data.inputType,
          choiceMode: parsed.data.inputType === "DROPDOWN" ? parsed.data.choiceMode : null,
          isActive: parsed.data.isActive,
        },
      });

      if (parsed.data.inputType !== "DROPDOWN") {
        return;
      }

      const incoming = parsed.data.options.map((option) => ({
        id: option.id?.trim() || undefined,
        code: option.code,
        name: option.name,
        sortOrder: option.sortOrder,
        isActive: option.isActive,
      }));
      const plan = planCategoryOptionSync(existing.options, incoming);

      for (const update of plan.updates) {
        const option = incoming[update.incomingIndex]!;
        await tx.productCategoryOption.update({
          where: { id: update.id },
          data: {
            code: option.code.toUpperCase(),
            name: option.name,
            sortOrder: option.sortOrder ?? update.incomingIndex,
            isActive: option.isActive,
          },
        });
      }

      if (plan.creates.length > 0) {
        await tx.productCategoryOption.createMany({
          data: plan.creates.map((incomingIndex) => {
            const option = incoming[incomingIndex]!;
            return {
              organizationId,
              productCategoryId: id,
              code: option.code.toUpperCase(),
              name: option.name,
              sortOrder: option.sortOrder ?? incomingIndex,
              isActive: option.isActive,
              updatedAt: new Date(),
            };
          }),
        });
      }

      if (plan.removeIds.length > 0) {
        const inUse = await tx.productionOrderLineCategoryOption.findMany({
          where: { categoryOptionId: { in: plan.removeIds } },
          select: { categoryOptionId: true },
        });
        const usedIds = new Set(inUse.map((row) => row.categoryOptionId));
        const deletable = plan.removeIds.filter((optionId) => !usedIds.has(optionId));
        const retain = plan.removeIds.filter((optionId) => usedIds.has(optionId));
        if (deletable.length > 0) {
          await tx.productCategoryOption.deleteMany({
            where: { id: { in: deletable }, productCategoryId: id, organizationId },
          });
        }
        if (retain.length > 0) {
          await tx.productCategoryOption.updateMany({
            where: { id: { in: retain }, productCategoryId: id, organizationId },
            data: { isActive: false },
          });
        }
      }
    });
    revalidatePath("/product-categories");
    message = "Product category saved.";
  } catch (error) {
    rethrowNextNavigation(error);
    logger.error("product_category_update_failed", {
      categoryId: id,
      code: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return { error: writeErrorMessage(error, "Could not update category.") };
  }
  redirectAfterSave("/product-categories", message);
}

export async function createProcessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = processSchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      description: formData.get("description") ?? "",
      unitsPerDay: formData.get("unitsPerDay") ?? "",
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid process." };
    }
    await prisma.process.create({
      data: {
        organizationId,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        description: emptyToNull(parsed.data.description),
        unitsPerDay:
          parsed.data.unitsPerDay === "" || parsed.data.unitsPerDay == null
            ? null
            : Number(parsed.data.unitsPerDay),
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/processes");
    message = "Process created.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not create process.") };
  }
  redirectAfterSave("/processes", message);
}

export async function updateProcessAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = processSchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      description: formData.get("description") ?? "",
      unitsPerDay: formData.get("unitsPerDay") ?? "",
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid process." };
    }
    const result = await prisma.process.updateMany({
      where: { id, organizationId },
      data: {
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        description: emptyToNull(parsed.data.description),
        unitsPerDay:
          parsed.data.unitsPerDay === "" || parsed.data.unitsPerDay == null
            ? null
            : Number(parsed.data.unitsPerDay),
        isActive: parsed.data.isActive,
      },
    });
    if (result.count === 0) {
      return { error: "Process not found." };
    }
    revalidatePath("/processes");
    message = "Process saved.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not update process.") };
  }
  redirectAfterSave("/processes", message);
}

export async function createSpecialActivityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = specialActivitySchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      activityType: formData.get("activityType"),
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid activity." };
    }
    await prisma.specialActivity.create({
      data: {
        organizationId,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        activityType: parsed.data.activityType,
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/special-activities");
    message = "Special activity created.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not create activity.") };
  }
  redirectAfterSave("/special-activities", message);
}

export async function updateSpecialActivityAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = specialActivitySchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      activityType: formData.get("activityType"),
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid activity." };
    }
    const result = await prisma.specialActivity.updateMany({
      where: { id, organizationId },
      data: {
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        activityType: parsed.data.activityType,
        isActive: parsed.data.isActive,
      },
    });
    if (result.count === 0) {
      return { error: "Special activity not found." };
    }
    revalidatePath("/special-activities");
    message = "Special activity saved.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not update activity.") };
  }
  redirectAfterSave("/special-activities", message);
}

export async function saveProcessMappingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const context = await requireMasterWriter();
    const parsed = processMappingSchema.safeParse({
      plantId: formData.get("plantId"),
      productId: formData.get("productId"),
      processIds: formData.getAll("processIds").map(String),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid mapping." };
    }

    await requireGrantedPlant(context, parsed.data.plantId);

    const [plant, product, processes] = await Promise.all([
      prisma.plant.findFirst({ where: { id: parsed.data.plantId, organizationId: context.organizationId } }),
      prisma.product.findFirst({ where: { id: parsed.data.productId, organizationId: context.organizationId } }),
      prisma.process.findMany({
        where: { organizationId: context.organizationId, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!plant) {
      return { error: "Plant not found in this organization." };
    }
    if (!product) {
      return { error: "Product not found in this organization." };
    }

    const steps = buildProcessMappingSteps(parsed.data.processIds);
    assertProcessesBelongToOrganization(
      steps.map((step) => step.processId),
      processes.map((process) => process.id),
    );

    await prisma.$transaction(async (tx) => {
      await tx.plantProductProcessMapping.deleteMany({
        where: {
          organizationId: context.organizationId,
          plantId: plant.id,
          productId: product.id,
        },
      });
      await tx.plantProductProcessMapping.createMany({
        data: steps.map((step) => ({
          organizationId: context.organizationId,
          plantId: plant.id,
          productId: product.id,
          processId: step.processId,
          sequence: step.sequence,
          isActive: true,
        })),
      });
    });

    revalidatePath("/mappings");
    await writeAuditLog({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "REPLACE",
      entityType: "PlantProductProcessMapping",
      entityId: `${plant.id}:${product.id}`,
      newValue: { plantId: plant.id, productId: product.id, steps },
      reason: "Master mapping change does not rewrite historical order snapshots.",
    });
    message = "Process mapping saved. Existing production orders are not changed.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not save mapping.") };
  }
  redirectAfterSave("/mappings", message);
}
