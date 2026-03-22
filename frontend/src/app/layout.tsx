import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { DEMO_USER } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "BananaGains | CMU's Prediction Market",
  description:
    "A campus prediction market for the CMU community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Navbar balance={DEMO_USER.banana_balance} />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
