"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { uniqueConstraintMessage } from "@/lib/db-errors";
import { requireMasterWriter } from "@/lib/masters/auth";
import { assertProcessesBelongToOrganization, buildProcessMappingSteps } from "@/lib/masters/process-mapping";
import { writeAuditLog } from "@/lib/audit/write";
import { requireGrantedPlant } from "@/lib/plants/access";
import { redirectAfterSave } from "@/lib/forms/redirect";
import { rethrowNextNavigation } from "@/lib/forms/navigation";
import {
  clientSchema,
  processMappingSchema,
  processSchema,
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

export async function createProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = productSchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid product." };
    }
    await prisma.product.create({
      data: {
        organizationId,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        isActive: parsed.data.isActive,
      },
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
        isActive: parsed.data.isActive,
      },
    });
    if (result.count === 0) {
      return { error: "Product not found." };
    }
    revalidatePath("/products");
    message = "Product saved.";
  } catch (error) {
    rethrowNextNavigation(error);
    return { error: uniqueConstraintMessage(error, error instanceof AppError ? error.message : "Could not update product.") };
  }
  redirectAfterSave("/products", message);
}

export async function createProcessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let message = "";
  try {
    const { organizationId } = await requireMasterWriter();
    const parsed = processSchema.safeParse({
      name: formData.get("name"),
      code: formData.get("code"),
      description: formData.get("description") ?? "",
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
