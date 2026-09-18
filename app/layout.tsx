import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.GITHUB_ACTIONS ? "/mi-boveda-gamer" : "";

export const metadata: Metadata = {
  title: "Mi Bóveda Gamer",
  description: "Organiza tu colección y retoma cada partida sin perder el hilo.",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
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
