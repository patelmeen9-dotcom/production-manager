import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";

export default async function HomePage() {
  const context = await getAuthContext();
  redirect(context ? "/dashboard" : "/login");
}
