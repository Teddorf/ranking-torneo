import "./globals.css";

export const metadata = {
  title: "Ranking del Torneo",
  description: "Clasificación en vivo del torneo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
