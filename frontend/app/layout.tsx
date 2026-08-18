import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const siteName = "Boardly";
const siteDescription =
  "A real-time collaborative whiteboard for sketching, sticky notes, and live discussion — synced instantly across your team.";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: `${siteName} — Real-time collaborative whiteboard`,
    template: `%s · ${siteName}`
  },
  description: siteDescription,
  applicationName: siteName,
  icons: {
    icon: "/favicon.ico"
  },
  openGraph: {
    title: `${siteName} — Real-time collaborative whiteboard`,
    description: siteDescription,
    siteName,
    type: "website"
  },
  twitter: {
    card: "summary",
    title: `${siteName} — Real-time collaborative whiteboard`,
    description: siteDescription
  }
};

export const viewport: Viewport = {
  themeColor: "#08090d",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster
            position="bottom-right"
            theme="dark"
            richColors
            toastOptions={{
              style: {
                background: "#111319",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#f1f5f9"
              }
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
