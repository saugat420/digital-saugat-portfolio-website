import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Saugat | Conversion-Focused Funnel Expert",
  description:
    "Attract new people, build trust and turn interest into customers with funnel strategy, landing pages and email automation by Saugat Basnet.",
  openGraph: {
    title: "Digital Saugat | Conversion-Focused Funnel Expert",
    description:
      "Attract new people, build trust and turn interest into customers with funnel strategy, landing pages and email automation by Saugat Basnet.",
    type: "website",
    siteName: "Digital Saugat",
    images: [{ url: "/digital-saugat-logo.png", width: 1200, height: 400, alt: "Digital Saugat" }],
  },
  twitter: {
    card: "summary",
    title: "Digital Saugat | Conversion-Focused Funnel Expert",
    description:
      "Attract new people, build trust and turn interest into customers with funnel strategy, landing pages and email automation by Saugat Basnet.",
    images: ["/digital-saugat-logo.png"],
  },
  icons: {
    icon: "/ds-icon.png",
    shortcut: "/ds-icon.png",
    apple: "/ds-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">{children}</body>
    </html>
  );
}
