"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider(props: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="pm-theme">
      {props.children}
    </NextThemesProvider>
  );
}
