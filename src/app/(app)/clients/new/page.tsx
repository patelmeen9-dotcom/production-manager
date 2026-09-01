import type { Metadata } from "next";
import { ClientForm } from "@/components/masters/client-form";
import { requireMasterWriter } from "@/lib/masters/auth";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireMasterWriter();
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New client</h1>
      <ClientForm />
    </main>
  );
}
