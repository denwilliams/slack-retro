import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slack Retro",
  description: "Run retrospectives in Slack",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
