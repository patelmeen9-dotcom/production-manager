import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-line-strong bg-input px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-ring",
        className,
      )}
      {...props}
    />
  );
}
