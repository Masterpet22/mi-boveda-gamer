import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Bóveda Gamer",
  description: "Organiza tu colección y retoma cada partida sin perder el hilo.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

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
