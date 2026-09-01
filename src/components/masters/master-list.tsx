import Link from "next/link";
import { SavedBanner } from "@/components/ui/saved-banner";

export function MasterList(props: {
  title: string;
  newHref?: string;
  empty: string;
  items: { id: string; title: string; subtitle?: string; href?: string }[];
  savedMessage?: string | string[];
}) {
  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">{props.title}</h1>
        {props.newHref ? (
          <Link className="text-sm text-sky-400 hover:text-sky-300" href={props.newHref}>
            New
          </Link>
        ) : null}
      </div>
      <SavedBanner message={props.savedMessage} />
      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {props.items.length === 0 ? (
          <li className="p-4 text-sm text-slate-400">{props.empty}</li>
        ) : (
          props.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-white">{item.title}</p>
                {item.subtitle ? <p className="text-sm text-slate-400">{item.subtitle}</p> : null}
              </div>
              {item.href ? (
                <Link className="text-sm text-sky-400" href={item.href}>
                  Edit
                </Link>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
