import type { Metadata } from "next";
import "./globals.css";
import { DailyClaimBanner } from "@/components/daily-claim-banner";
import { Navbar } from "@/components/navbar";
import { DataProvider } from "@/lib/DataProvider";
import { SessionProvider } from "@/lib/SessionProvider";

export const metadata: Metadata = {
  title: "BananaGains | CMU's Prediction Market",
  description: "A campus prediction market for the CMU community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <SessionProvider>
          <DataProvider>
            <DailyClaimBanner />
            <Navbar />
            <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
          </DataProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
