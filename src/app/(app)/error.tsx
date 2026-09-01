"use client";

export default function AppErrorBoundary({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="mx-auto max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-6">
      <h1 className="text-lg font-semibold text-white">Request failed</h1>
      <p className="mt-2 text-sm text-slate-300">Something went wrong while loading this page.</p>
      <p className="mt-2 text-xs text-slate-500">{error.digest ? `Reference: ${error.digest}` : null}</p>
    </main>
  );
}
