import "./globals.css";

export const metadata = {
  title: "Ranking del Torneo",
  description: "Clasificación en vivo del torneo",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ranking",
  },
};

export const viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
