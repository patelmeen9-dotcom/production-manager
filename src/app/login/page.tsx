import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const context = await getAuthContext();
  if (context) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-xl border border-line bg-panel p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-ink">Production Manager</h1>
        <p className="mt-1 mb-6 text-sm text-ink-soft">Sign in with your organization account.</p>
        <LoginForm />
      </div>
    </main>
  );
}
