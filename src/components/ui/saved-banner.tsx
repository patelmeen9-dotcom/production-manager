export function SavedBanner(props: { message?: string | string[] }) {
  const message = Array.isArray(props.message) ? props.message[0] : props.message;
  if (!message) {
    return null;
  }

  return (
    <p className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200" role="status">
      {message}
    </p>
  );
}
