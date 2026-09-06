import Link from "next/link";
import { Download } from "lucide-react";

export function ExportLink(props: { href: string; label?: string }) {
  return (
    <Link
      href={props.href}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-panel-muted"
    >
      <Download size={14} />
      {props.label ?? "Export"}
    </Link>
  );
}
