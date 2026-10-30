import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { StoreProvider } from "@/components/store-provider";
import "./globals.css";
import type { ReactNode } from "react";
import { MyMessagesWidget } from "@/components/my-messages-widget";

export const metadata: Metadata = {
  title: "HASI.TJ — видеонаблюдение и безопасность",
  description: "Камеры видеонаблюдения и оборудование для систем безопасности в Таджикистане.",
  keywords: ["HASI.TJ", "видеонаблюдение", "IP-камеры", "Hikvision", "Таджикистан"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="hasi-theme"
          disableTransitionOnChange
        >
          <StoreProvider>{children}</StoreProvider>
          <MyMessagesWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
