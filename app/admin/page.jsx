"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, Plus, Trash2, Calendar, Users, Save, LogOut, ArrowLeft, ChevronUp, ChevronDown, Pencil, Check, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Cargando…</div>;
  }

  if (!session) return <LoginForm />;
  return <AdminPanel onLogout={() => supabase.auth.signOut()} />;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setErr(error.message);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h1 className="font-semibold text-lg">Admin · Ranking</h1>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <button
            disabled={loading}
            className="w-full py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <Link href="/" className="block text-center text-xs text-slate-500 mt-4 hover:text-slate-700">
          ← Volver al ranking público
        </Link>
      </div>
    </div>
  );
}

function AdminPanel({ onLogout }) {
  const [players, setPlayers] = useState([]);
  const [dates, setDates] = useState([]);
  const [scores, setScores] = useState([]);
  const [tab, setTab] = useState("scores");
  const [newPlayer, setNewPlayer] = useState("");
  const [newDate, setNewDate] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    const [p, d, s] = await Promise.all([
      supabase.from("players").select("*").order("sort_order"),
      supabase.from("dates").select("*").order("sort_order"),
      supabase.from("scores").select("*"),
    ]);
    setPlayers(p.data || []);
    setDates(d.data || []);
    setScores(s.data || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-ranking")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "dates" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 1500);
  };

  const scoreMap = useMemo(() => {
    const m = {};
    scores.forEach((s) => { m[`${s.player_id}_${s.date_id}`] = s; });
    return m;
  }, [scores]);

  const ranking = useMemo(() => {
    return players
      .map((p) => {
        let total = 0, played = 0, byes = 0;
        dates.forEach((d) => {
          const s = scoreMap[`${p.id}_${d.id}`];
          if (!s) return;
          if (s.type === "points") { total += Number(s.value) || 0; played += 1; }
          else if (s.type === "bye") { byes += 1; }
        });
        return { ...p, total, played, byes, avg: played ? total / played : 0 };
      })
      .sort((a, b) => b.total - a.total || b.avg - a.avg);
  }, [players, dates, scoreMap]);

  const addPlayer = async () => {
    const name = newPlayer.trim();
    if (!name) return;
    const sort_order = (players[players.length - 1]?.sort_order || 0) + 1;
    const { error } = await supabase.from("players").insert({ name, sort_order });
    if (error) return flash("Error: " + error.message);
    setNewPlayer("");
    flash("Jugador agregado");
  };

  const removePlayer = async (id) => {
    if (!confirm("¿Eliminar jugador?")) return;
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) return flash("Error: " + error.message);
    flash("Eliminado");
  };

  const renamePlayer = async (id, name) => {
    const { error } = await supabase.from("players").update({ name }).eq("id", id);
    if (error) return flash("Error: " + error.message);
    flash("Renombrado");
  };

  const movePlayer = async (id, direction) => {
    const idx = players.findIndex((p) => p.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= players.length) return;
    const a = players[idx], b = players[swapIdx];
    const { error } = await supabase.from("players").upsert([
      { id: a.id, name: a.name, sort_order: b.sort_order },
      { id: b.id, name: b.name, sort_order: a.sort_order },
    ]);
    if (error) return flash("Error: " + error.message);
  };

  const addDate = async () => {
    const label = newDate.trim();
    if (!label) return;
    const sort_order = (dates[dates.length - 1]?.sort_order || 0) + 1;
    const { error } = await supabase.from("dates").insert({ label, sort_order });
    if (error) return flash("Error: " + error.message);
    setNewDate("");
    flash("Fecha agregada");
  };

  const removeDate = async (id) => {
    if (!confirm("¿Eliminar fecha?")) return;
    const { error } = await supabase.from("dates").delete().eq("id", id);
    if (error) return flash("Error: " + error.message);
    flash("Eliminada");
  };

  const renameDate = async (id, label) => {
    const { error } = await supabase.from("dates").update({ label }).eq("id", id);
    if (error) return flash("Error: " + error.message);
    flash("Renombrada");
  };

  const moveDate = async (id, direction) => {
    const idx = dates.findIndex((d) => d.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= dates.length) return;
    const a = dates[idx], b = dates[swapIdx];
    const { error } = await supabase.from("dates").upsert([
      { id: a.id, label: a.label, sort_order: b.sort_order },
      { id: b.id, label: b.label, sort_order: a.sort_order },
    ]);
    if (error) return flash("Error: " + error.message);
  };

  const setScore = async (playerId, dateId, type, value) => {
    if (type === "none") {
      const { error } = await supabase
        .from("scores")
        .delete()
        .eq("player_id", playerId)
        .eq("date_id", dateId);
      if (error) return flash("Error: " + error.message);
      return flash("Guardado");
    }
    const row = {
      player_id: playerId,
      date_id: dateId,
      type,
      value: type === "points" ? Number(value) || 0 : 0,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("scores").upsert(row, { onConflict: "player_id,date_id" });
    if (error) return flash("Error: " + error.message);
    flash("Guardado");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="p-1.5 rounded hover:bg-slate-100">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Trophy className="w-5 h-5 text-amber-500" />
            <h1 className="font-semibold text-lg">Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            {status && <span className="text-xs text-emerald-600">{status}</span>}
            <button onClick={onLogout} className="p-2 rounded-lg hover:bg-slate-100" title="Salir">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {[
            { id: "ranking", label: "Ranking", icon: Trophy },
            { id: "scores", label: "Cargar puntos", icon: Save },
            { id: "manage", label: "Jugadores y fechas", icon: Users },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition ${
                  tab === t.id
                    ? "border-amber-500 text-amber-700 font-medium"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {tab === "ranking" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold">Clasificación general</h2>
            </div>
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
                        {p.played} jugadas
                        {p.byes > 0 && ` · ${p.byes} bye`}
                        {p.played > 0 && ` · prom ${p.avg.toFixed(2)}`}
                      </div>
                    </div>
                    <div className="text-lg font-bold tabular-nums">
                      {p.total.toFixed(2).replace(/\.00$/, "")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "scores" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Cargar puntos por fecha</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tocá una celda para cargar puntos o marcar bye.
                </p>
              </div>
              <div className="flex gap-1">
                <input
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDate()}
                  placeholder="Nueva fecha"
                  className="w-28 px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={addDate}
                  className="px-2 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[140px]">
                      Jugador
                    </th>
                    <th className="text-right px-2 py-2 font-medium text-amber-600">Total</th>
                    {dates.map((d) => (
                      <th key={d.id} className="px-2 py-2 font-medium text-slate-600 min-w-[80px]">
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {players.map((p) => {
                    const total = dates.reduce((acc, d) => {
                      const s = scoreMap[`${p.id}_${d.id}`];
                      return acc + (s?.type === "points" ? Number(s.value) || 0 : 0);
                    }, 0);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 sticky left-0 bg-white font-medium truncate max-w-[140px]">
                          {p.name}
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-amber-600 tabular-nums">
                          {total.toFixed(2).replace(/\.00$/, "")}
                        </td>
                        {dates.map((d) => {
                          const s = scoreMap[`${p.id}_${d.id}`];
                          return (
                            <td key={d.id} className="px-1 py-1">
                              <ScoreCell
                                score={s}
                                onChange={(type, value) => setScore(p.id, d.id, type, value)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "manage" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold">Jugadores</h2>
                <span className="text-xs text-slate-400 ml-auto">{players.length}</span>
              </div>
              <div className="p-3 flex gap-2 border-b border-slate-100">
                <input
                  value={newPlayer}
                  onChange={(e) => setNewPlayer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                  placeholder="Nombre del jugador"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={addPlayer}
                  className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Agregar
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {players.map((p, i) => (
                  <EditableRow
                    key={p.id}
                    value={p.name}
                    onRename={(name) => renamePlayer(p.id, name)}
                    onRemove={() => removePlayer(p.id)}
                    onMoveUp={i > 0 ? () => movePlayer(p.id, -1) : null}
                    onMoveDown={i < players.length - 1 ? () => movePlayer(p.id, 1) : null}
                  />
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold">Fechas</h2>
                <span className="text-xs text-slate-400 ml-auto">{dates.length}</span>
              </div>
              <div className="p-3 flex gap-2 border-b border-slate-100">
                <input
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDate()}
                  placeholder="Ej: 6-jun"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={addDate}
                  className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Agregar
                </button>
              </div>
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {dates.map((d, i) => (
                  <EditableRow
                    key={d.id}
                    value={d.label}
                    onRename={(label) => renameDate(d.id, label)}
                    onRemove={() => removeDate(d.id)}
                    onMoveUp={i > 0 ? () => moveDate(d.id, -1) : null}
                    onMoveDown={i < dates.length - 1 ? () => moveDate(d.id, 1) : null}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function EditableRow({ value, onRename, onRemove, onMoveUp, onMoveDown }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const save = () => {
    const clean = draft.trim();
    if (clean && clean !== value) onRename(clean);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="flex flex-col">
        <button
          onClick={onMoveUp}
          disabled={!onMoveUp}
          className="text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={!onMoveDown}
          className="text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") { setDraft(value); setEditing(false); }
            }}
            className="flex-1 px-2 py-1 text-sm border border-amber-400 rounded focus:outline-none"
          />
          <button onClick={save} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded">
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setDraft(value); setEditing(false); }}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{value}</span>
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-slate-400 hover:text-amber-600"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 text-slate-400 hover:text-red-500"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

function ScoreCell({ score, onChange }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(score?.type === "points" ? String(score.value) : "");

  useEffect(() => {
    setVal(score?.type === "points" ? String(score.value) : "");
  }, [score]);

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.5"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { onChange("points", val); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onChange("points", val); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-14 px-1 py-1 text-sm border border-amber-400 rounded text-center"
      />
    );
  }

  if (score?.type === "points") {
    return (
      <div className="flex items-center justify-center gap-0.5">
        <button
          onClick={() => setEditing(true)}
          className="px-2 py-1 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 min-w-[44px]"
        >
          {Number(score.value).toFixed(2).replace(/\.00$/, "")}
        </button>
        <button
          onClick={() => onChange("none")}
          className="text-slate-300 hover:text-red-500 text-xs"
        >
          ×
        </button>
      </div>
    );
  }

  if (score?.type === "bye") {
    return (
      <button
        onClick={() => onChange("none")}
        className="w-full px-2 py-1 text-xs font-medium text-slate-500 bg-slate-100 rounded hover:bg-slate-200"
      >
        bye
      </button>
    );
  }

  return (
    <div className="flex gap-0.5 justify-center">
      <button
        onClick={() => setEditing(true)}
        className="flex-1 px-1 py-1 text-xs text-amber-600 border border-dashed border-slate-300 rounded hover:border-amber-400 hover:bg-amber-50"
      >
        + pts
      </button>
      <button
        onClick={() => onChange("bye")}
        className="px-1.5 py-1 text-xs text-slate-500 border border-dashed border-slate-300 rounded hover:bg-slate-100"
      >
        bye
      </button>
    </div>
  );
}
