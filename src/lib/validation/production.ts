import { z } from "zod";

export const productionEntrySchema = z.object({
  productionOrderId: z.string().min(1, "Order is required."),
  orderProcessId: z.string().min(1, "Stage is required."),
  entryDate: z.string().min(1, "Date is required."),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero."),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
  specialActivityId: z.string().optional().or(z.literal("")),
});

export const specialActivityEntrySchema = z.object({
  productionOrderId: z.string().min(1, "Order is required."),
  specialActivityId: z.string().min(1, "Activity is required."),
  orderProcessId: z.string().optional().or(z.literal("")),
  entryDate: z.string().min(1, "Date is required."),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero."),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
});
