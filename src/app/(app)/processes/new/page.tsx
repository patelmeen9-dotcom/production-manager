import type { Metadata } from "next";
import { ProcessForm } from "@/components/masters/process-form";
import { requireMasterWriter } from "@/lib/masters/auth";

export const metadata: Metadata = { title: "New process" };

export default async function NewProcessPage() {
  await requireMasterWriter();
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New process</h1>
      <ProcessForm />
    </main>
  );
}
