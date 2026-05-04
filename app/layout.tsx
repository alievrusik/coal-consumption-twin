import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Двойник потребления угля — запас парка котельных",
  description:
    "Прототип панели парка: суточный расход угля и остатки с линейным прогнозом дефицита.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
