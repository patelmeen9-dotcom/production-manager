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
  details: z.string().trim().max(2000).optional().or(z.literal("")),
  categoryIds: z.array(z.string().min(1)).default([]),
  isActive: z.boolean(),
});

export const productCategoryOptionSchema = z.object({
  id: z.string().trim().optional(),
  code: z.string().trim().min(1, "Option code is required.").max(40),
  name: z.string().trim().min(1, "Option name is required.").max(160),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const productCategorySchema = z
  .object({
    code: z.string().trim().min(1, "Category code is required.").max(40),
    name: z.string().trim().min(1, "Category name is required.").max(160),
    inputType: z.enum(["OPEN_TEXT", "DROPDOWN"]),
    choiceMode: z.enum(["SINGLE", "MULTI"]).optional().nullable(),
    isActive: z.boolean(),
    options: z.array(productCategoryOptionSchema).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.inputType === "DROPDOWN") {
      if (!value.choiceMode) {
        ctx.addIssue({ code: "custom", message: "Choice mode is required for dropdown categories.", path: ["choiceMode"] });
      }
      if (value.options.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Add at least one category option for dropdown categories.",
          path: ["options"],
        });
      }
      const codes = new Set<string>();
      const names = new Set<string>();
      for (const [index, option] of value.options.entries()) {
        const code = option.code.trim().toUpperCase();
        const name = option.name.trim().toLowerCase();
        if (codes.has(code)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate option code "${option.code}".`,
            path: ["options", index, "code"],
          });
        }
        codes.add(code);
        if (names.has(name)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate option name "${option.name}".`,
            path: ["options", index, "name"],
          });
        }
        names.add(name);
      }
    }
  });

export const processSchema = z.object({
  name: z.string().trim().min(1, "Process name is required.").max(160),
  code: z.string().trim().min(1, "Process code is required.").max(40),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  unitsPerDay: z.union([
    z.literal(""),
    z.coerce.number().int().positive("Units per day must be greater than zero."),
  ]).optional(),
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
