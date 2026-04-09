"use client";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-6 text-center">
            <h2 className="font-semibold text-lg text-slate-900 mb-2">
              Algo salió mal
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {process.env.NODE_ENV === "development"
                ? error?.message
                : "Ocurrió un error inesperado."}
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
