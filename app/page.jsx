"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Trophy, Settings, RefreshCw, Share2, Download } from "lucide-react";
import { supabase } from "../lib/supabase";
import { buildScoreMap, computeRanking } from "../lib/ranking";

export default function PublicRanking() {
  const [players, setPlayers] = useState([]);
  const [dates, setDates] = useState([]);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("ranking"); // ranking | tabla
  const [sharing, setSharing] = useState(false);
  const rankingRef = useRef(null);
  const loadingRef = useRef(false);

  const load = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [p, d, s] = await Promise.all([
        supabase.from("players").select("*").order("sort_order"),
        supabase.from("dates").select("*").order("sort_order"),
        supabase.from("scores").select("*"),
      ]);
      if (p.error || d.error || s.error) {
        setError("No se pudieron cargar los datos");
        return;
      }
      setPlayers(p.data || []);
      setDates(d.data || []);
      setScores(s.data || []);
      setError(null);
      setLoading(false);
    } finally {
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    load();
    // Realtime subscriptions
    const ch = supabase
      .channel("public-ranking")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "dates" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const scoreMap = useMemo(() => buildScoreMap(scores), [scores]);

  const ranking = useMemo(() => computeRanking(players, dates, scoreMap), [players, dates, scoreMap]);

  const handleShare = async () => {
    if (!rankingRef.current || sharing) return;
    setSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(rankingRef.current, {
        backgroundColor: "#f8fafc",
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      const file = new File([blob], "ranking-torneo.png", { type: "image/png" });
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: "Ranking del Torneo",
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ranking-torneo.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Error al compartir:", err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h1 className="font-semibold text-lg">Ranking del Torneo</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              title="Compartir ranking"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={load}
              className="p-2 rounded-lg hover:bg-slate-100"
              title="Refrescar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link
              href="/admin"
              className="p-2 rounded-lg hover:bg-slate-100"
              title="Admin"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {[
            { id: "ranking", label: "Ranking" },
            { id: "tabla", label: "Tabla completa" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`px-3 py-2 text-sm border-b-2 transition ${
                view === t.id
                  ? "border-amber-500 text-amber-700 font-medium"
                  : "border-transparent text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 flex items-center justify-between">
            <span className="text-sm text-red-700">{error}</span>
            <button
              onClick={() => { setError(null); load(); }}
              className="ml-4 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        ) : loading ? (
          <div className="text-center text-slate-400 py-10">Cargando…</div>
        ) : view === "ranking" ? (
          <div ref={rankingRef} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {ranking.map((p, i) => {
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 text-center font-semibold text-slate-500">
                      {medal || i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.played} {p.played === 1 ? "fecha jugada" : "fechas jugadas"}
                        {p.byes > 0 && ` · ${p.byes} bye`}
                        {p.played > 0 && ` · prom ${p.avg.toFixed(2)}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums">
                        {p.total.toFixed(2).replace(/\.00$/, "")}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase">pts</div>
                    </div>
                  </div>
                );
              })}
              {ranking.length === 0 && (
                <div className="px-4 py-10 text-center text-slate-400 text-sm">
                  Sin jugadores cargados todavía.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div ref={rankingRef} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="table-scroll-container">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 sticky left-0 bg-slate-50 min-w-[140px]">
                      Jugador
                    </th>
                    <th className="text-right px-2 py-2 font-medium text-amber-600">Total</th>
                    {dates.map((d) => (
                      <th key={d.id} className="px-2 py-2 font-medium text-slate-600 min-w-[70px]">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ranking.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 sticky left-0 z-[1] bg-white font-medium truncate max-w-[140px]">
                        {p.name}
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-amber-600 tabular-nums">
                        {p.total.toFixed(2).replace(/\.00$/, "")}
                      </td>
                      {dates.map((d) => {
                        const s = scoreMap[`${p.id}_${d.id}`];
                        return (
                          <td key={d.id} className="px-2 py-2 text-center text-slate-700 tabular-nums">
                            {s?.type === "points"
                              ? Number(s.value).toFixed(2).replace(/\.00$/, "")
                              : s?.type === "bye"
                              ? <span className="text-slate-400 text-xs">bye</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}
        <p className="text-center text-xs text-slate-400 mt-4">
          Se actualiza en vivo automáticamente
        </p>
      </main>
    </div>
  );
}
