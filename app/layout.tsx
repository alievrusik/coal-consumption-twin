import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coal consumption twin — fleet inventory",
  description:
    "Prototype fleet dashboard for daily coal draw versus reserves with linear shortage outlook.",
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
