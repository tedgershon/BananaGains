import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";
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
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <SessionProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
