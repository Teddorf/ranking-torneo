import "./globals.css";

export const metadata = {
  title: "Ranking del Torneo",
  description: "Clasificación en vivo del torneo",
  manifest: "/manifest.json",
  themeColor: "#f59e0b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ranking",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
