import { NextResponse } from "next/server";
import { requireMasterWriter } from "@/lib/masters/auth";
import { buildImportTemplateBuffer } from "@/lib/import/template";

export async function GET() {
  await requireMasterWriter();
  const buffer = await buildImportTemplateBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="production-manager-import-template.xlsx"',
    },
  });
}
