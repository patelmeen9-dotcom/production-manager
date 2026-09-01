import { z } from "zod";

export const plantSchema = z.object({
  code: z.string().trim().min(1, "Plant code is required.").max(40),
  name: z.string().trim().min(1, "Plant name is required.").max(120),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  isActive: z.boolean(),
});

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required.").max(160),
  startDelayWarningDays: z.coerce.number().int().min(0).max(365),
  startDelayCriticalDays: z.coerce.number().int().min(0).max(365),
  gettingDelayedLeadDays: z.coerce.number().int().min(0).max(365),
});

export const userPlantAccessSchema = z.object({
  userId: z.string().min(1),
  plantIds: z.array(z.string().min(1)),
});

export const clientSchema = z.object({
  code: z.string().trim().min(1, "Client code is required.").max(40),
  name: z.string().trim().min(1, "Client name is required.").max(160),
  contactName: z.string().trim().max(160).optional().or(z.literal("")),
  contactEmail: z.union([z.string().trim().email("Enter a valid email."), z.literal("")]).optional(),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  isActive: z.boolean(),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(160),
  code: z.string().trim().min(1, "Product code is required.").max(40),
  isActive: z.boolean(),
});

export const processSchema = z.object({
  name: z.string().trim().min(1, "Process name is required.").max(160),
  code: z.string().trim().min(1, "Process code is required.").max(40),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean(),
});

export const specialActivitySchema = z.object({
  name: z.string().trim().min(1, "Activity name is required.").max(160),
  code: z.string().trim().min(1, "Activity code is required.").max(40),
  activityType: z.enum(["SPECIAL_PROCESS", "REWORK", "OTHER"]),
  isActive: z.boolean(),
});

export const processMappingSchema = z.object({
  plantId: z.string().min(1, "Plant is required."),
  productId: z.string().min(1, "Product is required."),
  processIds: z.array(z.string().min(1)),
});
