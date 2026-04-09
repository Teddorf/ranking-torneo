# Ranking del Torneo — Documentación de Flujos y Arquitectura

> Generado el 2026-04-08 desde el código fuente.
> Archivos base: `app/page.jsx`, `app/admin/page.jsx`, `middleware.js`, `lib/supabase.js`, `supabase-schema.sql`
> Proyecto: Next.js 14 + Supabase + Vercel.

---

## 1. Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENTE (Browser)                             │
│                                                                         │
│   ┌─────────────────────┐        ┌──────────────────────────────────┐   │
│   │   / (PublicRanking) │        │      /admin (AdminPage)          │   │
│   │   React Client Comp │        │      React Client Component      │   │
│   └──────────┬──────────┘        └────────────────┬─────────────────┘   │
│              │                                    │                     │
│              └──────────────┬─────────────────────┘                     │
│                             │ supabase-js client                        │
│                             │ (REST + Realtime WebSocket)               │
└─────────────────────────────┼─────────────────────────────────────────--┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS (Vercel Edge)                            │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    middleware.js                                 │  │
│   │   matcher: ["/admin/:path*"]                                     │  │
│   │                                                                  │  │
│   │   Request → createServerClient → supabase.auth.getUser()        │  │
│   │       ├── /admin/* sin sesión  → redirect /admin                │  │
│   │       └── /admin/* con sesión → NextResponse.next()             │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   ┌──────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│   │  app/page.jsx│    │app/admin/page.jsx│    │  lib/supabase.js     │  │
│   │  (SSR shell) │    │  (SSR shell)     │    │  createClient()      │  │
│   └──────────────┘    └──────────────────┘    │  singleton export    │  │
│                                               └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                    HTTPS REST / WebSocket
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                        │
│                                                                         │
│  ┌────────────────┐  ┌─────────────────┐  ┌───────────────────────┐    │
│  │   Auth Service │  │  PostgREST API  │  │   Realtime Server     │    │
│  │                │  │                 │  │                       │    │
│  │  signIn        │  │  players        │  │  supabase_realtime    │    │
│  │  getSession    │  │  dates          │  │  publication          │    │
│  │  getUser       │  │  scores         │  │  → players            │    │
│  │  signOut       │  │  (RLS policies) │  │  → dates              │    │
│  └────────────────┘  └────────┬────────┘  │  → scores             │    │
│                               │           └───────────────────────┘    │
│                               ▼                                         │
│                    ┌──────────────────────┐                             │
│                    │   PostgreSQL DB      │                             │
│                    │   players            │                             │
│                    │   dates              │                             │
│                    │   scores (FK+cascade)│                             │
│                    └──────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Flujo: Vista Pública del Ranking (`/`)

```
Usuario abre https://[dominio]/
        │
        ▼
┌───────────────────────────┐
│  Next.js sirve HTML shell │
│  (app/page.jsx)           │
│  middleware NO aplica     │
│  (matcher solo /admin/*)  │
└───────────────┬───────────┘
                │  Hidratación React
                ▼
┌───────────────────────────┐
│  PublicRanking()          │
│  useState: loading=true   │
│  useEffect → load()       │
└───────────────┬───────────┘
                │
                ▼
┌───────────────────────────────────────────────────────┐
│  load() — Promise.all en paralelo                     │
│                                                       │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ supabase        │  │ supabase     │  │ supabase │ │
│  │ .from("players")│  │ .from("dates")│  │.from(    │ │
│  │ .select("*")    │  │ .select("*") │  │"scores") │ │
│  │ .order(sort_ord)│  │ .order(sort) │  │.select() │ │
│  └────────┬────────┘  └──────┬───────┘  └────┬─────┘ │
│           └──────────────────┴───────────────┘       │
│                              │ await                 │
└──────────────────────────────┼───────────────────────┘
                               │
                               ▼
              ┌─────────────────────────────┐
              │  setPlayers / setDates      │
              │  setScores / setLoading=false│
              └───────────────┬─────────────┘
                              │
                              ▼
              ┌───────────────────────────────────────┐
              │  useMemo: scoreMap                    │
              │  { "playerId_dateId": scoreRow }      │
              │                                       │
              │  useMemo: ranking                     │
              │  players.map → { total, played, byes, │
              │    avg } → sort(total desc, avg desc) │
              └───────────────┬───────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────────────┐
              │  Render: view === "ranking"            │
              │    Lista ordenada con medallas         │
              │  view === "tabla"                     │
              │    Tabla jugadores × fechas            │
              └───────────────────────────────────────┘

  — En paralelo al render inicial —

  useEffect también suscribe Realtime:
  ┌─────────────────────────────────────────────────────┐
  │  supabase.channel("public-ranking")                 │
  │    .on(postgres_changes, table: "players", load)    │
  │    .on(postgres_changes, table: "dates",   load)    │
  │    .on(postgres_changes, table: "scores",  load)    │
  │    .subscribe()                                     │
  │                                                     │
  │  Cualquier INSERT/UPDATE/DELETE en DB               │
  │    → callback load() → re-fetch completo            │
  │    → setPlayers / setDates / setScores              │
  │    → React re-render automático                     │
  │                                                     │
  │  cleanup (unmount): supabase.removeChannel(ch)      │
  └─────────────────────────────────────────────────────┘
```

---

## 3. Flujo: Login de Admin (`/admin`)

```
Usuario navega a /admin
        │
        ▼
┌───────────────────────────────────────────────────┐
│  MIDDLEWARE.JS                                    │
│                                                   │
│  matcher: ["/admin/:path*"]                       │
│  ¿pathname === "/admin"? → NO aplica (excluido)   │
│  ¿pathname === "/admin/settings"? → SÍ aplica     │
│     supabase.auth.getUser()                       │
│       ├── user null → redirect /admin             │
│       └── user ok   → NextResponse.next()        │
└───────────────────────────────────────────────────┘
        │ (para /admin exacto, pasa directo)
        ▼
┌───────────────────────────────────────────────────┐
│  AdminPage() — Client Component                   │
│  useState: session=null, checking=true            │
│                                                   │
│  useEffect:                                       │
│    supabase.auth.getSession()                     │
│      → setSession(data.session)                   │
│      → setChecking(false)                         │
│                                                   │
│    supabase.auth.onAuthStateChange()              │
│      → listener activo (actualiza session)        │
└───────────────┬───────────────────────────────────┘
                │
        checking=true → spinner "Cargando…"
                │
                ▼
        ┌───────────────────┐
        │  checking = false │
        └───────┬───────────┘
                │
        ┌───────┴───────┐
        │               │
   session null    session ok
        │               │
        ▼               ▼
┌───────────────┐  ┌─────────────────────────────┐
│  <LoginForm/> │  │  <AdminPanel                │
│               │  │    onLogout={signOut}/>      │
│  email input  │  │                             │
│  pass input   │  │  Carga datos + Realtime      │
│  submit btn   │  │  (mismo patrón que public)  │
└───────┬───────┘  └─────────────────────────────┘
        │ onSubmit
        ▼
┌───────────────────────────────────────────┐
│  supabase.auth.signInWithPassword(        │
│    { email, password }                    │
│  )                                        │
│                                           │
│  ┌──────────────┐  ┌────────────────────┐ │
│  │  error null  │  │  error presente    │ │
│  │              │  │                    │ │
│  │ onAuthState  │  │  setErr(msg)       │ │
│  │ Change fires │  │  muestra error     │ │
│  │ → setSession │  │  en UI             │ │
│  │ → AdminPanel │  └────────────────────┘ │
│  └──────────────┘                         │
└───────────────────────────────────────────┘

  Logout:
  AdminPanel → botón LogOut
    → supabase.auth.signOut()
    → onAuthStateChange → session=null
    → AdminPage renderiza <LoginForm/>
```

---

## 4. Flujo: Cargar Puntos (Score)

```
AdminPanel — tab "scores" — tabla jugadores × fechas
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  <ScoreCell score={s} onChange={(type,val) => setScore()} │
│                                                           │
│  Estado inicial (score undefined):                        │
│  ┌─────────────────┬────────────┐                         │
│  │  [+ pts]        │   [bye]    │  ← botones dashed       │
│  └─────────────────┴────────────┘                         │
└───────────────────────────────────────────────────────────┘

  — Click "+ pts" —                  — Click "bye" —
        │                                   │
        ▼                                   ▼
┌────────────────────────┐      ┌─────────────────────────┐
│  setEditing(true)      │      │  onChange("bye", 0)      │
│  render: <input        │      └──────────────┬──────────┘
│    type="number"       │                     │
│    autoFocus           │                     │
│    step="0.5"          │                     │
│  />                    │                     │
└────────────┬───────────┘                     │
             │ blur o Enter                    │
             ▼                                 ▼
┌────────────────────────────────────────────────────────┐
│  onChange("points", val)  /  onChange("bye")           │
│                                                        │
│  setScore(playerId, dateId, type, value)               │
│                                                        │
│  type === "none"?                                      │
│    → supabase.from("scores")                           │
│        .delete()                                       │
│        .eq("player_id", playerId)                      │
│        .eq("date_id", dateId)                          │
│                                                        │
│  type === "points" o "bye"?                            │
│    → supabase.from("scores")                           │
│        .upsert(row, { onConflict:"player_id,date_id" })│
│        row = { player_id, date_id, type, value,        │
│                updated_at: new Date().toISOString() }  │
└──────────────────────────────┬─────────────────────────┘
                               │  Supabase PostgREST
                               ▼
                    ┌──────────────────────┐
                    │  PostgreSQL          │
                    │  INSERT / UPDATE /   │
                    │  DELETE on scores    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────────────────────┐
                    │  Supabase Realtime publica evento    │
                    │  postgres_changes (table: "scores")  │
                    └───────┬──────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              │                            │
              ▼                            ▼
   ┌──────────────────┐         ┌──────────────────────┐
   │  Channel         │         │  Channel             │
   │  "admin-ranking" │         │  "public-ranking"    │
   │  → callback load │         │  → callback load     │
   │  → re-fetch all  │         │  → re-fetch all      │
   │  → setState      │         │  → setState          │
   │  → re-render     │         │  → re-render         │
   └──────────────────┘         └──────────────────────┘
   (AdminPanel mismo tab)       (/ en TODOS los browsers)

  flash("Guardado") → status visible 1.5s → ""
```

---

## 5. Flujo: CRUD Jugadores y Fechas

### 5a. Agregar

```
Tab "manage" o header de "scores"
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  Input "Nombre del jugador" / "Nueva fecha"         │
│  → Enter o click botón Agregar                      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
        name/label = input.trim()
        sort_order = last.sort_order + 1
                      │
                      ▼
        supabase.from("players"|"dates")
          .insert({ name/label, sort_order })
                      │
              ┌───────┴────────┐
              │ error          │ ok
              ▼                ▼
         flash(err)      setNewPlayer("") / setNewDate("")
                         flash("Jugador agregado" / "Fecha agregada")
                         Realtime → load() → re-render
```

### 5b. Renombrar (EditableRow)

```
Click ícono Pencil
  → setEditing(true)
  → render: <input autoFocus value={draft} />

  Enter o blur:
    draft.trim() !== value?
      → onRename(draft)
      → supabase.from().update({ name/label }).eq("id", id)
      → Realtime → load() → re-render
      → flash("Renombrado/a")

  Escape:
    → setDraft(value original)
    → setEditing(false)
```

### 5c. Eliminar (con cascada)

```
Click ícono Trash2
  → confirm("¿Eliminar jugador/fecha?")
        │
    cancelar → nada
        │
    confirmar
        ▼
  supabase.from("players"|"dates")
    .delete()
    .eq("id", id)
        │
        ▼
  PostgreSQL ejecuta ON DELETE CASCADE
        │
  ┌─────────────────────────────────────────┐
  │  DELETE players/dates row              │
  │    ↓ CASCADE                           │
  │  DELETE scores WHERE player_id = id    │
  │            OR WHERE date_id = id       │
  └─────────────────────────────────────────┘
        │
  Realtime events → load() → re-render
  flash("Eliminado/a")
```

### 5d. Reordenar (swap sort_order)

```
Click ChevronUp / ChevronDown
  → movePlayer(id, -1) o movePlayer(id, +1)
  → moveDate(id, -1)   o moveDate(id, +1)
        │
        ▼
  idx = players/dates.findIndex(id)
  swapIdx = idx + direction
  a = players[idx], b = players[swapIdx]
        │
        ▼
  supabase.from("players"|"dates")
    .upsert([
      { id: a.id, ..., sort_order: b.sort_order },
      { id: b.id, ..., sort_order: a.sort_order },
    ])
        │
  Realtime → load() → re-render (orden actualizado)
```

---

## 6. Diagrama de Modelo de Datos (ER)

```
┌─────────────────────────────────────────────────────────────────┐
│                           players                               │
├──────────────────┬──────────────────────────────────────────────┤
│  id              │  uuid  PK  DEFAULT gen_random_uuid()         │
│  name            │  text  NOT NULL                              │
│  sort_order      │  int   DEFAULT 0                             │
│  created_at      │  timestamptz DEFAULT now()                   │
└─────────┬────────┴──────────────────────────────────────────────┘
          │
          │  FK: scores.player_id → players.id  ON DELETE CASCADE
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                            scores                               │
├──────────────────┬──────────────────────────────────────────────┤
│  player_id       │  uuid  FK → players(id)  ON DELETE CASCADE   │
│  date_id         │  uuid  FK → dates(id)    ON DELETE CASCADE   │
│  type            │  text  NOT NULL  CHECK (type IN              │
│                  │          ('points', 'bye'))                  │
│  value           │  numeric  DEFAULT 0                          │
│  updated_at      │  timestamptz DEFAULT now()                   │
│  PRIMARY KEY     │  (player_id, date_id)  ← clave compuesta     │
└──────────────────┴────────────────────────┬─────────────────────┘
                                            │
                                            │  FK: scores.date_id → dates.id
                                            │  ON DELETE CASCADE
                                            ▼
                             ┌──────────────────────────────────────┐
                             │               dates                  │
                             ├────────────────┬─────────────────────┤
                             │  id            │  uuid  PK           │
                             │  label         │  text  NOT NULL     │
                             │  sort_order    │  int   DEFAULT 0    │
                             │  created_at    │  timestamptz        │
                             └────────────────┴─────────────────────┘

Cardinalidades:
  players  1 ──< scores >── 1  dates
  (un jugador tiene muchos scores; una fecha tiene muchos scores)
  (un score pertenece a exactamente 1 jugador y 1 fecha)

Row Level Security (RLS):
  SELECT → público (cualquiera, sin autenticar)
  INSERT / UPDATE / DELETE → auth.uid() IS NOT NULL (admin logueado)

Realtime Publication:
  supabase_realtime ADD TABLE players, dates, scores
```

---

## 7. Flujo: Realtime (Supabase Channels)

```
  CLIENTE (browser)                     SUPABASE REALTIME SERVER
        │                                         │
        │  supabase.channel("public-ranking")     │
        │  .on("postgres_changes", {              │
        │      event: "*",                        │
        │      schema: "public",                  │
        │      table: "players"                   │
        │  }, callback)                           │
        │  .on(... "dates" ..., callback)         │
        │  .on(... "scores" ..., callback)        │
        │  .subscribe()                           │
        │ ──────────── WebSocket connect ────────►│
        │                                         │
        │◄─────────── SUBSCRIBED ─────────────────│
        │                                         │
                  [Admin hace upsert en scores]
                            │
                  PostgreSQL WAL → Realtime
                            │
        │◄─────────── postgres_changes event ─────│
        │  { table: "scores",                     │
        │    type: "INSERT"|"UPDATE"|"DELETE",     │
        │    record: {...} }                       │
        │                                         │
        │  callback = load()                      │
        │  ┌──────────────────────────────────┐   │
        │  │  Promise.all([                   │   │
        │  │    .from("players").select()     │   │
        │  │    .from("dates").select()       │   │
        │  │    .from("scores").select()      │   │
        │  │  ])                              │   │
        │  └────────────────┬─────────────────┘   │
        │                   │ await               │
        │                   ▼                     │
        │  setPlayers / setDates / setScores       │
        │  → React reconciliation                 │
        │  → useMemo recalcula scoreMap           │
        │  → useMemo recalcula ranking            │
        │  → DOM actualizado                      │
        │                                         │

Cleanup (unmount del componente):
  return () => supabase.removeChannel(ch)
  → WebSocket unsubscribe

Canales activos simultáneos:
  "public-ranking"  → app/page.jsx        (vista pública)
  "admin-ranking"   → app/admin/page.jsx  (AdminPanel, solo si logueado)
```

---

## 8. Diagrama de Componentes React

```
app/page.jsx
└── PublicRanking()  [Client Component]
    │
    │  state: players[], dates[], scores[], loading, view
    │  effect: load() + channel "public-ranking"
    │  memo: scoreMap, ranking[]
    │
    ├── <header>
    │   ├── <Trophy/>  (lucide-react)
    │   ├── <button onClick={load}> <RefreshCw/> </button>
    │   └── <Link href="/admin"> <Settings/> </Link>
    │
    ├── Tab buttons: "ranking" | "tabla"
    │
    └── <main>
        ├── [loading=true]  → "Cargando…"
        │
        ├── [view="ranking"]
        │   └── ranking.map(p) →
        │       <div> posición + nombre + stats + total </div>
        │
        └── [view="tabla"]
            └── <table>
                ├── <thead> Jugador | Total | fecha[] </thead>
                └── <tbody>
                    └── ranking.map(p) →
                        <tr> nombre | total | scoreMap[p_d][] </tr>


app/admin/page.jsx
└── AdminPage()  [Client Component]
    │
    │  state: session, checking
    │  effect: getSession() + onAuthStateChange()
    │
    ├── [checking=true]  → spinner
    │
    ├── [session=null]   → <LoginForm/>
    │   │  state: email, password, err, loading
    │   └── submit → signInWithPassword()
    │                   ├── error → setErr(msg)
    │                   └── ok    → onAuthStateChange → setSession
    │
    └── [session ok]    → <AdminPanel onLogout={signOut}/>
        │
        │  state: players[], dates[], scores[], tab,
        │         newPlayer, newDate, status
        │  effect: load() + channel "admin-ranking"
        │  memo: scoreMap, ranking[]
        │
        ├── <header>
        │   ├── <Link href="/"> <ArrowLeft/> </Link>
        │   ├── tabs: "ranking" | "scores" | "manage"
        │   └── <button onClick={onLogout}> <LogOut/> </button>
        │
        └── <main>
            │
            ├── [tab="ranking"]
            │   └── ranking.map(p) → posición + nombre + stats
            │
            ├── [tab="scores"]
            │   └── <table>
            │       ├── <thead> + input nueva fecha
            │       └── players.map(p) →
            │           <tr>
            │             <td> nombre </td>
            │             <td> total </td>
            │             dates.map(d) →
            │               <ScoreCell score onChange={setScore}/>
            │                 │  state: editing, val
            │                 ├── [no score]   → [+pts] [bye]
            │                 ├── [editing]    → <input number/>
            │                 │                  blur/Enter → onChange
            │                 ├── [type=points]→ valor + [×]
            │                 └── [type=bye]   → [bye] clickable
            │           </tr>
            │
            └── [tab="manage"]
                ├── Sección Jugadores
                │   ├── input + botón Agregar → addPlayer()
                │   └── players.map(p) →
                │       <EditableRow
                │         value={p.name}
                │         onRename={renamePlayer}
                │         onRemove={removePlayer}
                │         onMoveUp / onMoveDown={movePlayer}
                │       />
                │         │  state: editing, draft
                │         ├── [view]   → texto + [Pencil] [Trash2]
                │         └── [editing]→ <input/> + [Check] [X]
                │
                └── Sección Fechas
                    ├── input + botón Agregar → addDate()
                    └── dates.map(d) →
                        <EditableRow
                          value={d.label}
                          onRename={renameDate}
                          onRemove={removeDate}
                          onMoveUp / onMoveDown={moveDate}
                        />
```

---

*Method + MCV + RR activos*
