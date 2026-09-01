import { redirect } from "next/navigation";

/** Redirect only after a successful write. Listing pages read `saved` for feedback. */
export function redirectAfterSave(listPath: string, message: string): never {
  const params = new URLSearchParams({ saved: message });
  redirect(`${listPath}?${params.toString()}`);
}
