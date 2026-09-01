import type { Metadata } from "next";
import { SpecialActivityForm } from "@/components/masters/special-activity-form";
import { requireMasterWriter } from "@/lib/masters/auth";

export const metadata: Metadata = { title: "New special activity" };

export default async function NewSpecialActivityPage() {
  await requireMasterWriter();
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New special activity</h1>
      <SpecialActivityForm />
    </main>
  );
}
