import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Bóveda Gamer",
  description: "Organiza tu colección y retoma cada partida sin perder el hilo.",
  manifest: "/mi-boveda-gamer/manifest.webmanifest",
  icons: {
    icon: "/mi-boveda-gamer/favicon.svg",
    shortcut: "/mi-boveda-gamer/favicon.svg",
  },
};

export const viewport: Viewport = { themeColor: "#07101f" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
