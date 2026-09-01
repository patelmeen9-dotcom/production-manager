import Link from "next/link";
import { buildPageHref, totalPages } from "@/lib/pagination";

export function Pager(props: {
  basePath: string;
  page: number;
  pageSize: number;
  totalCount: number;
  currentQuery?: Record<string, string | undefined>;
}) {
  const pages = totalPages(props.totalCount, props.pageSize);
  const query = props.currentQuery ?? {};
  if (props.totalCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
      <p>
        Page {props.page} of {pages} · {props.totalCount} total
      </p>
      <div className="flex gap-3">
        {props.page > 1 ? (
          <Link className="text-sky-400 hover:text-sky-300" href={buildPageHref(props.basePath, props.page - 1, query)}>
            Previous
          </Link>
        ) : (
          <span className="text-slate-600">Previous</span>
        )}
        {props.page < pages ? (
          <Link className="text-sky-400 hover:text-sky-300" href={buildPageHref(props.basePath, props.page + 1, query)}>
            Next
          </Link>
        ) : (
          <span className="text-slate-600">Next</span>
        )}
      </div>
    </div>
  );
}
