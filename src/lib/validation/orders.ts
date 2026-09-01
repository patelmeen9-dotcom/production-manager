import { z } from "zod";

export const productionOrderSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  orderNumber: z.string().trim().min(1, "Order number is required.").max(80),
  plantId: z.string().min(1, "Plant is required."),
  productId: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().int().positive("Quantity must be greater than zero."),
  orderDate: z.string().min(1, "Order date is required."),
  startDateType: z.enum(["NONE", "FIXED_DATE", "DAYS_FROM_ORDER"]),
  startDate: z.string().optional().or(z.literal("")),
  startDays: z.string().optional().or(z.literal("")),
  dueDateType: z.enum(["FIXED_DATE", "DAYS_FROM_ORDER", "DAYS_FROM_START"]),
  dueDate: z.string().optional().or(z.literal("")),
  dueDays: z.string().optional().or(z.literal("")),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  remarks: z.string().trim().max(1000).optional().or(z.literal("")),
  specialActivitiesRequested: z.boolean(),
  specialActivityIds: z.array(z.string().min(1)).default([]),
});
