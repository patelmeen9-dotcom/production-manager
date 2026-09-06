import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMasterWriter } from "@/lib/masters/auth";
import { resolveAttachmentPath } from "@/lib/orders/attachments";
import fs from "fs/promises";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireMasterWriter();

    const attachment = await prisma.productionOrderAttachment.findFirst({
      where: { id, organizationId: context.organizationId },
    });
    if (!attachment) {
      return new NextResponse("Not found", { status: 404 });
    }

    const filePath = resolveAttachmentPath(attachment.storagePath);
    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(await fs.readFile(filePath));
    } catch {
      return new NextResponse("File not found on disk", { status: 404 });
    }

    const contentType =
      attachment.fileType === "PDF"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
        "Content-Length": String(attachment.fileSizeBytes),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return new NextResponse("Unauthorised", { status: 401 });
  }
}
