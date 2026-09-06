import { Prisma } from "@prisma/client";
import { isAppError } from "@/lib/errors";

export function uniqueConstraintMessage(error: unknown, fallback: string): string {
  if (isAppError(error)) {
    return error.message;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "A record with this name or code already exists in the organization.";
  }
  return fallback;
}

/** User-facing write error, including FK/validation codes the unique helper ignores. */
export function writeErrorMessage(error: unknown, fallback: string): string {
  if (isAppError(error)) {
    return error.message;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "A record with this name or code already exists in the organization.";
    }
    if (error.code === "P2003" || error.code === "P2014") {
      return "This change would remove a category option that is already used on an order line. Keep the option (you can deactivate it) and save again.";
    }
    if (error.code === "P2025") {
      return "The record was not found or is no longer available.";
    }
    return `${fallback} (database error ${error.code})`;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return `${fallback} The submitted values could not be saved.`;
  }
  if (error instanceof Error && error.message.trim() && error.message.length < 280) {
    return error.message;
  }
  return fallback;
}
