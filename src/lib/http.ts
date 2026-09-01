import { NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function jsonError(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  logger.error("unhandled_error", { message: error instanceof Error ? error.message : "unknown" });
  return NextResponse.json({ error: "An unexpected error occurred.", code: "INTERNAL" }, { status: 500 });
}
