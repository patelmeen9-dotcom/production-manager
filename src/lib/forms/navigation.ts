/** Next.js redirect()/notFound() throw; never treat them as form errors. */
export function rethrowNextNavigation(error: unknown): void {
  if (typeof error !== "object" || error === null) {
    return;
  }
  if ("digest" in error) {
    const digest = String((error as { digest?: unknown }).digest ?? "");
    if (digest.startsWith("NEXT_") || digest.includes("NEXT_REDIRECT") || digest.includes("NEXT_NOT_FOUND")) {
      throw error;
    }
  }
}
