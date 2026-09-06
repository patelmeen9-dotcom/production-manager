"use client";

import { useActionState, useRef } from "react";
import { uploadOrderAttachmentAction, deleteOrderAttachmentAction } from "@/lib/orders/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/masters/actions";

type Attachment = {
  id: string;
  fileName: string;
  fileType: "XLSX" | "PDF";
  fileSizeBytes: number;
  createdAt: Date;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: "XLSX" | "PDF" }) {
  if (type === "PDF") {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded bg-red-900/60 text-xs font-bold text-red-300">
        PDF
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded bg-emerald-900/60 text-xs font-bold text-emerald-300">
      XLS
    </span>
  );
}

function DeleteAttachmentButton({ attachmentId }: { attachmentId: string }) {
  const action = deleteOrderAttachmentAction.bind(null, attachmentId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" disabled={pending} className="h-7 px-2 text-xs text-red-400 hover:text-red-300">
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {state.error ? <span className="ml-2 text-xs text-red-400">{state.error}</span> : null}
    </form>
  );
}

export function OrderAttachmentsPanel({
  orderId,
  attachments,
}: {
  orderId: string;
  attachments: Attachment[];
}) {
  const uploadAction = uploadOrderAttachmentAction.bind(null, orderId);
  const [uploadState, formAction, pending] = useActionState<FormState, FormData>(uploadAction, {});
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Attachments</p>
          <p className="text-xs text-slate-500">XLSX and PDF files only · max 20 MB each</p>
        </div>
      </div>

      {/* Existing attachments */}
      {attachments.length > 0 ? (
        <ul className="space-y-1">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-3 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2"
            >
              <FileIcon type={attachment.fileType} />
              <div className="min-w-0 flex-1">
                <a
                  href={`/api/orders/attachments/${attachment.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm text-slate-200 hover:text-white hover:underline"
                >
                  {attachment.fileName}
                </a>
                <p className="text-xs text-slate-500">{formatBytes(attachment.fileSizeBytes)}</p>
              </div>
              <DeleteAttachmentButton attachmentId={attachment.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">No attachments yet.</p>
      )}

      {/* Upload form */}
      <form action={formAction} className="flex items-center gap-2">
        <div className="flex-1">
          <Label htmlFor={`attachment-${orderId}`} className="sr-only">
            Upload file
          </Label>
          <input
            ref={fileInputRef}
            id={`attachment-${orderId}`}
            type="file"
            name="attachment"
            accept=".xlsx,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
            required
            className="block w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-200
              file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:font-medium
              file:text-slate-200 hover:file:bg-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending} className="shrink-0">
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {uploadState.error ? (
        <p className="text-xs text-red-400">{uploadState.error}</p>
      ) : null}
      {uploadState.success ? (
        <p className="text-xs text-emerald-400">{uploadState.success}</p>
      ) : null}
    </div>
  );
}
