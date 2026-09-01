"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRoles, requireTenantContext } from "@/lib/auth/session";
import { ALL_PLANTS, setRequestedPlantId } from "@/lib/plants/cookie";
import { loadPlantScope } from "@/lib/plants/access";
import { canManagePlants, canManageUserPlantAccess, canUseAllPlantsView } from "@/lib/plants/scope";
import { organizationSettingsSchema, plantSchema, userPlantAccessSchema } from "@/lib/validation/masters";
import { parseOrganizationSettings } from "@/lib/organization-settings";
import { redirectAfterSave } from "@/lib/forms/redirect";
import { rethrowNextNavigation } from "@/lib/forms/navigation";

export async function switchPlantAction(formData: FormData) {
  const context = await requireTenantContext();
  const requested = String(formData.get("plantId") ?? "");
  const { plants } = await loadPlantScope(context);

  if (requested === ALL_PLANTS) {
    if (!canUseAllPlantsView(context.role)) {
      throw new AppError("FORBIDDEN", "All Plants view is not available for this role.", 403);
    }
    await setRequestedPlantId(ALL_PLANTS);
    revalidatePath("/");
    return;
  }

  const plant = plants.find((item) => item.id === requested);
  if (!plant) {
    throw new AppError("FORBIDDEN", "You do not have access to this plant.", 403);
  }

  if (!canUseAllPlantsView(context.role)) {
    const grant = await prisma.userPlantAccess.findUnique({
      where: { userId_plantId: { userId: context.userId, plantId: plant.id } },
    });
    if (!grant) {
      throw new AppError("FORBIDDEN", "You do not have access to this plant.", 403);
    }
  }

  await setRequestedPlantId(plant.id);
  revalidatePath("/");
}

export async function createPlantAction(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  let message = "";
  try {
    const context = await requireRoles([Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN]);
    if (!canManagePlants(context.role)) {
      throw new AppError("FORBIDDEN", "You cannot manage plants.", 403);
    }
    const organizationId = context.organizationId;
    if (!organizationId) {
      throw new AppError("FORBIDDEN", "An organization context is required.", 403);
    }

    const parsed = plantSchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      location: formData.get("location") ?? "",
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid plant." };
    }

    await prisma.plant.create({
      data: {
        organizationId,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        location: parsed.data.location || null,
        isActive: parsed.data.isActive,
      },
    });
    revalidatePath("/plants");
    message = "Plant created.";
  } catch (error) {
    rethrowNextNavigation(error);
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: "Could not create plant." };
  }
  redirectAfterSave("/plants", message);
}

export async function updatePlantAction(plantId: string, _prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  let message = "";
  try {
    const context = await requireRoles([Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN]);
    const organizationId = context.organizationId;
    if (!organizationId) {
      throw new AppError("FORBIDDEN", "An organization context is required.", 403);
    }

    const parsed = plantSchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      location: formData.get("location") ?? "",
      isActive: formData.get("isActive") === "on",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid plant." };
    }

    const result = await prisma.plant.updateMany({
      where: { id: plantId, organizationId },
      data: {
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        location: parsed.data.location || null,
        isActive: parsed.data.isActive,
      },
    });
    if (result.count === 0) {
      return { error: "Plant not found." };
    }
    revalidatePath("/plants");
    message = "Plant saved.";
  } catch (error) {
    rethrowNextNavigation(error);
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: "Could not update plant." };
  }
  redirectAfterSave("/plants", message);
}

export async function updateOrganizationAction(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  try {
    const context = await requireRoles([Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN]);
    const organizationId = context.organizationId;
    if (!organizationId) {
      throw new AppError("FORBIDDEN", "An organization context is required.", 403);
    }

    const parsed = organizationSettingsSchema.safeParse({
      name: formData.get("name"),
      startDelayWarningDays: formData.get("startDelayWarningDays"),
      startDelayCriticalDays: formData.get("startDelayCriticalDays"),
      gettingDelayedLeadDays: formData.get("gettingDelayedLeadDays"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid settings." };
    }

    const current = await prisma.organization.findFirst({
      where: { id: organizationId, isActive: true },
    });
    if (!current) {
      return { error: "Organization not found." };
    }

    const settings = {
      ...parseOrganizationSettings(current.settings),
      startDelayWarningDays: parsed.data.startDelayWarningDays,
      startDelayCriticalDays: parsed.data.startDelayCriticalDays,
      gettingDelayedLeadDays: parsed.data.gettingDelayedLeadDays,
    };

    await prisma.organization.update({
      where: { id: organizationId },
      data: { name: parsed.data.name, settings },
    });
    revalidatePath("/");
    revalidatePath("/organization");
  } catch (error) {
    rethrowNextNavigation(error);
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: "Could not update organization." };
  }
  redirectAfterSave("/organization", "Organization settings saved.");
}

export async function updateUserPlantAccessAction(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  try {
    const context = await requireRoles([Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN]);
    if (!canManageUserPlantAccess(context.role)) {
      throw new AppError("FORBIDDEN", "You cannot assign plant access.", 403);
    }
    const organizationId = context.organizationId;
    if (!organizationId) {
      throw new AppError("FORBIDDEN", "An organization context is required.", 403);
    }

    const plantIds = formData.getAll("plantIds").map(String);
    const parsed = userPlantAccessSchema.safeParse({
      userId: formData.get("userId"),
      plantIds,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid access list." };
    }

    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, organizationId },
    });
    if (!target) {
      return { error: "User not found in this organization." };
    }

    const orgPlants = await prisma.plant.findMany({
      where: { organizationId, id: { in: parsed.data.plantIds } },
      select: { id: true },
    });
    const allowedIds = new Set(orgPlants.map((plant) => plant.id));
    const sanitized = parsed.data.plantIds.filter((id) => allowedIds.has(id));

    await prisma.$transaction([
      prisma.userPlantAccess.deleteMany({
        where: { organizationId, userId: target.id },
      }),
      ...sanitized.map((plantId) =>
        prisma.userPlantAccess.create({
          data: { organizationId, userId: target.id, plantId },
        }),
      ),
    ]);

    revalidatePath("/users");
  } catch (error) {
    rethrowNextNavigation(error);
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: "Could not update plant access." };
  }
  redirectAfterSave("/users", "User plant access saved.");
}
