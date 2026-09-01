import { cookies } from "next/headers";
import { ALL_PLANTS } from "@/lib/plants/scope";

export const PLANT_COOKIE = "pm.activePlant";

export async function getRequestedPlantId(): Promise<string | null> {
  const store = await cookies();
  return store.get(PLANT_COOKIE)?.value ?? null;
}

export async function setRequestedPlantId(value: string) {
  const store = await cookies();
  store.set(PLANT_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export { ALL_PLANTS };
