import { Prisma } from "@prisma/client";

export function uniqueConstraintMessage(error: unknown, fallback: string): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "A record with this name or code already exists in the organization.";
  }
  return fallback;
}
