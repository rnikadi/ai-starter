import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { appConfig } from "@/lib/app-config";

export const metadata: Metadata = {
  title: appConfig.displayName,
  description: `AI application for ${appConfig.displayName}.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
