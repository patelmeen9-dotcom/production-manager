import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-sky-600 text-white hover:bg-sky-500",
        variant === "secondary" && "border border-line bg-panel text-ink hover:bg-panel-muted",
        variant === "ghost" && "bg-transparent text-ink-soft hover:bg-panel-muted hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
