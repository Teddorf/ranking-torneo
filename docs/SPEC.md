# SPEC — Ranking del Torneo

> Versión: 1.0.0 | Fecha: 2026-04-08 | Estado: Producción

---

## 1. Visión General

**Qué es:** Aplicación web de ranking en tiempo real para un torneo de golf. Permite que cualquier participante vea la clasificación actualizada desde su celular, y que el administrador cargue puntajes por fecha desde un panel protegido.

**Para quién:** Torneo de golf privado con ~26 jugadores y ~13 fechas de competición.

**Problema que resuelve:** Elimina la necesidad de planillas manuales (Excel/papel). El ranking se actualiza en vivo en el momento en que el admin carga un puntaje; cualquier participante que tenga la URL abierta lo ve sin refrescar.

**Alcance actual:**
- Vista pública: ranking ordenado + tabla completa por fecha
- Panel admin: login → cargar puntajes → gestionar jugadores y fechas
- Sin registro de usuarios públicos, sin pagos, sin perfil de jugador

---

## 2. Arquitectura

### Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js | ^14.2.35 |
| Lenguaje | JavaScript (JSX) | — |
| Estilos | Tailwind CSS | ^3.4.6 |
| Iconos | lucide-react | ^0.400.0 |
| Base de datos | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth (email/password) | — |
| Realtime | Supabase Realtime (postgres_changes) | — |
| Cliente Supabase | @supabase/supabase-js | ^2.45.0 |
| Middleware Supabase | @supabase/ssr | ^0.10.0 |
| Deploy target | Vercel (inferido) | — |

### Diagrama de componentes (ASCII)

```
Browser (público)              Browser (admin)
      │                               │
      ▼                               ▼
 app/page.jsx                  app/admin/page.jsx
 "use client"                  "use client"
 PublicRanking()               AdminPage()
   ├── Vista "Ranking"           ├── LoginForm       (sin sesión)
   └── Vista "Tabla completa"    └── AdminPanel       (con sesión)
                                       ├── Tab: Ranking
                                       ├── Tab: Cargar puntos
                                       │     └── ScoreCell (por celda)
                                       └── Tab: Jugadores y fechas
                                             └── EditableRow (por fila)

      │                               │
      └───────────┬───────────────────┘
                  ▼
           lib/supabase.js
           createClient (anon key)
                  │
                  ▼
        ┌─────────────────────┐
        │   Supabase Cloud    │
        │  ┌───────────────┐  │
        │  │  PostgreSQL   │  │
        │  │  players      │  │
        │  │  dates        │  │
        │  │  scores       │  │
        │  └───────────────┘  │
        │  ┌───────────────┐  │
        │  │  Auth         │  │
        │  │  (email/pwd)  │  │
        │  └───────────────┘  │
        │  ┌───────────────┐  │
        │  │  Realtime     │  │
        │  │  pub channel  │  │
        │  └───────────────┘  │
        └─────────────────────┘

middleware.js (Next.js Edge)
  └── Protege /admin/* (subrutas)
  └── /admin en sí: guard client-side
```

### Flujo de datos

1. **Carga inicial:** El componente monta → `Promise.all([players, dates, scores])` → estado local.
2. **Cálculo:** `useMemo` computa `scoreMap` (lookup `playerId_dateId`) y `ranking` (suma + promedio + sort).
3. **Realtime:** Canal suscripto a `postgres_changes` en las 3 tablas → dispara `load()` en cualquier cambio.
4. **Escritura (admin):** Mutaciones directas via cliente Supabase (insert / upsert / update / delete) → RLS valida `auth.uid() is not null` → Realtime notifica a todos los clientes conectados.

---

## 3. Modelo de Datos

### Tabla: `players`

| Columna | Tipo | Constraints |
|---------|------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `name` | `text` | NOT NULL |
| `sort_order` | `int` | DEFAULT 0 |
| `created_at` | `timestamptz` | DEFAULT now() |

### Tabla: `dates`

| Columna | Tipo | Constraints |
|---------|------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `label` | `text` | NOT NULL (ej: "7-mar") |
| `sort_order` | `int` | DEFAULT 0 |
| `created_at` | `timestamptz` | DEFAULT now() |

### Tabla: `scores`

| Columna | Tipo | Constraints |
|---------|------|-------------|
| `player_id` | `uuid` | FK → `players(id)` ON DELETE CASCADE |
| `date_id` | `uuid` | FK → `dates(id)` ON DELETE CASCADE |
| `type` | `text` | NOT NULL, CHECK IN ('points', 'bye') |
| `value` | `numeric` | DEFAULT 0 |
| `updated_at` | `timestamptz` | DEFAULT now() |
| PK compuesta | — | `(player_id, date_id)` |

### Relaciones

```
players 1 ──< scores >── 1 dates
  (cascade delete)   (cascade delete)
```

- Un jugador puede tener **como máximo un score por fecha** (PK compuesta).
- Eliminar un jugador elimina en cascada todos sus scores.
- Eliminar una fecha elimina en cascada todos los scores de esa fecha.

### RLS Policies

| Tabla | Operación | Policy |
|-------|-----------|--------|
| players, dates, scores | SELECT | Pública (`using (true)`) |
| players, dates, scores | INSERT | `auth.uid() is not null` |
| players, dates, scores | UPDATE | `auth.uid() is not null` |
| players, dates, scores | DELETE | `auth.uid() is not null` |

Realtime habilitado en las 3 tablas via `supabase_realtime` publication.

---

## 4. Requisitos Funcionales

### REQ-001 — Ver ranking público

**Descripción:** Cualquier usuario sin autenticación puede acceder a `/` y ver el ranking de jugadores ordenado por puntos totales descendentes.

**Criterio de aceptación:**
- El listado muestra posición, nombre, total de puntos, fechas jugadas, byes y promedio.
- Las posiciones 1°, 2° y 3° muestran medallas (🥇🥈🥉).
- Si hay empate en total, se desempata por promedio descendente.

**Estado:** IMPLEMENTADO

---

### REQ-002 — Ver tabla completa por fecha

**Descripción:** Desde la vista pública, el usuario puede cambiar a la pestaña "Tabla completa" para ver una grilla jugador × fecha con todos los puntajes.

**Criterio de aceptación:**
- Columna fija con nombre de jugador (sticky).
- Columna "Total" con puntaje acumulado.
- Celdas muestran: valor numérico (points), "bye" (bye) o "—" (sin score).
- Scroll horizontal cuando las fechas exceden el ancho de pantalla.

**Estado:** IMPLEMENTADO

---

### REQ-003 — Actualización en tiempo real

**Descripción:** Cuando el admin carga o modifica un puntaje, la vista pública (y el panel admin) se actualizan automáticamente sin que el usuario refresque.

**Criterio de aceptación:**
- La suscripción `postgres_changes` en el canal "public-ranking" dispara `load()` ante cualquier evento en players, dates o scores.
- El indicador "Se actualiza en vivo automáticamente" es visible en la vista pública.
- El botón manual de refresh también está disponible como fallback.

**Estado:** IMPLEMENTADO

---

### REQ-004 — Login de administrador

**Descripción:** El admin accede a `/admin` y se autentica con email y contraseña via Supabase Auth.

**Criterio de aceptación:**
- Si no hay sesión activa, se muestra `LoginForm`.
- Credenciales incorrectas muestran el mensaje de error de Supabase.
- Con sesión válida, se carga `AdminPanel`.
- El botón "Salir" cierra la sesión (`signOut()`).

**Estado:** IMPLEMENTADO

---

### REQ-005 — Cargar y editar puntajes

**Descripción:** El admin puede cargar puntos o marcar "bye" para cualquier combinación jugador × fecha desde una grilla interactiva.

**Criterio de aceptación:**
- Celdas vacías muestran botones "+ pts" y "bye".
- Tocar "+ pts" abre un input numérico (step 0.5). Al confirmar (Enter/blur) se hace upsert.
- Tocar "bye" registra `type='bye', value=0`.
- Los valores existentes son editables in-place.
- El botón "×" junto a un valor existente lo elimina (delete).
- Un flash "Guardado" confirma cada operación.

**Estado:** IMPLEMENTADO

---

### REQ-006 — Gestionar jugadores

**Descripción:** El admin puede agregar, renombrar, reordenar y eliminar jugadores.

**Criterio de aceptación:**
- Input + botón "Agregar" inserta un nuevo jugador con `sort_order` auto-incremental.
- Enter en el input también dispara el insert.
- Cada fila tiene flechas ↑↓ para reordenar (swap de `sort_order`).
- Doble clic en el nombre o botón lápiz activa edición inline; Enter/Check confirma, Escape cancela.
- Botón papelera con confirm dialog elimina el jugador y sus scores en cascada.

**Estado:** IMPLEMENTADO

---

### REQ-007 — Gestionar fechas

**Descripción:** El admin puede agregar, renombrar, reordenar y eliminar fechas del torneo.

**Criterio de aceptación:**
- Mismo comportamiento que REQ-006 aplicado a la tabla `dates`.
- Las fechas se muestran como etiquetas libres (ej: "7-mar", "14-mar").
- Agregar fecha también disponible desde el tab "Cargar puntos" (input en header de tabla).

**Estado:** IMPLEMENTADO

---

### REQ-008 — Vista ranking en panel admin

**Descripción:** El admin tiene una pestaña "Ranking" dentro del panel admin que replica la vista de clasificación general.

**Criterio de aceptación:**
- Misma lógica de ordenamiento que la vista pública.
- Muestra posición, medallas, nombre, fechas jugadas, byes, promedio y total.

**Estado:** IMPLEMENTADO

---

### REQ-009 — Manejo de errores global

**Descripción:** Errores no capturados del árbol de componentes se muestran en una pantalla de error amigable.

**Criterio de aceptación:**
- `app/error.jsx` captura errores con boundary de Next.js.
- En desarrollo muestra el mensaje de error real; en producción muestra mensaje genérico.
- Botón "Intentar de nuevo" llama a `reset()`.

**Estado:** IMPLEMENTADO

---

## 5. Requisitos No Funcionales

### Performance

- **Carga inicial:** Una sola ronda de 3 queries en paralelo (`Promise.all`). Sin waterfalls.
- **Recálculo:** `useMemo` evita recomputar ranking y scoreMap en cada render.
- **Realtime vs polling:** Se usa Realtime (WebSocket) en lugar de polling. Sin carga periódica innecesaria.
- **Bundle:** Sin librerías pesadas. Solo Next.js + Supabase client + lucide-react.

### Seguridad

- La anon key de Supabase es pública por diseño (prefijo `NEXT_PUBLIC_`). Las RLS policies son la única barrera de escritura.
- Las mutaciones de escritura sólo se ejecutan si `auth.uid() is not null` (RLS).
- El middleware protege subrutas `/admin/*` a nivel Edge antes de que lleguen al componente.
- `/admin` (raíz) usa guard client-side: muestra `LoginForm` si no hay sesión.
- No se almacenan passwords en el código; la auth es delegada 100% a Supabase Auth.

### Accesibilidad

- Idioma del documento declarado: `<html lang="es">`.
- Botones con atributo `title` descriptivo (Refrescar, Admin, Salir, Editar, Eliminar).
- Inputs con `placeholder` en español.
- No se declaró `aria-label` explícito; área de mejora pendiente.

### SEO

- Metadata estática declarada en `layout.jsx`: `title` y `description`.
- La app es "use client" pura, por lo que el HTML inicial no contiene datos (sin SSR). El SEO de contenido dinámico no es prioridad para este caso de uso (acceso privado/semiprivado).

---

## 6. Flujos de Usuario

### Flujo público — Ver ranking

```
Usuario abre URL raíz (/)
  └── Carga página
  └── load() → Promise.all [players, dates, scores]
  └── useMemo calcula ranking (sort por total desc, avg desc)
  └── Muestra vista "Ranking" (default)
        ├── Puede cambiar a "Tabla completa"
        └── Puede hacer refresh manual
  └── Canal Realtime activo → auto-refresh ante cambios
```

### Flujo admin — Login

```
Admin navega a /admin
  └── getSession() → sin sesión → muestra LoginForm
  └── Admin ingresa email + password
  └── signInWithPassword()
        ├── Error → muestra mensaje en rojo
        └── OK → onAuthStateChange dispara → setSession(s) → muestra AdminPanel
```

### Flujo admin — Cargar puntaje

```
AdminPanel (tab "Cargar puntos")
  └── Grilla jugadores × fechas visible
  └── Admin toca celda vacía
        ├── "+ pts" → input numérico (autoFocus)
        │     └── Enter/blur → setScore(playerId, dateId, "points", value)
        │           └── supabase.upsert(score) → flash "Guardado"
        │           └── Realtime notifica a clientes públicos
        └── "bye" → setScore(playerId, dateId, "bye", 0)
              └── supabase.upsert(score) → flash "Guardado"
  └── Admin toca celda con valor existente
        ├── Click en valor → edición inline
        └── Click "×" → setScore(..., "none") → delete → flash "Guardado"
```

### Flujo admin — Gestionar jugadores/fechas

```
AdminPanel (tab "Jugadores y fechas")
  └── AGREGAR: input nombre → Enter o botón → insert → load()
  └── RENOMBRAR: botón lápiz → inline edit → Enter/Check → update
  └── REORDENAR: flechas ↑↓ → swap sort_order vía upsert de 2 filas
  └── ELIMINAR: botón papelera → confirm dialog → delete (cascade en scores)
```

### Flujo admin — Logout

```
Admin toca ícono LogOut
  └── supabase.auth.signOut()
  └── onAuthStateChange → setSession(null)
  └── AdminPage renderiza LoginForm
```

---

## 7. API / Endpoints

No hay API routes propias (no existe directorio `app/api/`). Toda la comunicación es directa con Supabase via cliente JS.

### Queries de lectura (ambos componentes)

```js
// Carga inicial paralela
supabase.from("players").select("*").order("sort_order")
supabase.from("dates").select("*").order("sort_order")
supabase.from("scores").select("*")
```

### Mutaciones de escritura (AdminPanel)

```js
// INSERT jugador / fecha
supabase.from("players").insert({ name, sort_order })
supabase.from("dates").insert({ label, sort_order })

// UPDATE (rename)
supabase.from("players").update({ name }).eq("id", id)
supabase.from("dates").update({ label }).eq("id", id)

// UPSERT reordenamiento (2 filas simultáneas)
supabase.from("players").upsert([{ id, name, sort_order }, ...])
supabase.from("dates").upsert([{ id, label, sort_order }, ...])

// UPSERT score (insert o update según PK compuesta)
supabase.from("scores").upsert(
  { player_id, date_id, type, value, updated_at },
  { onConflict: "player_id,date_id" }
)

// DELETE
supabase.from("players").delete().eq("id", id)
supabase.from("dates").delete().eq("id", id)
supabase.from("scores").delete().eq("player_id", pid).eq("date_id", did)
```

### Auth

```js
supabase.auth.getSession()                          // verificar sesión al montar
supabase.auth.signInWithPassword({ email, password }) // login
supabase.auth.signOut()                             // logout
supabase.auth.onAuthStateChange(callback)           // listener reactivo
```

### Realtime channels

| Canal | Tablas escuchadas | Componente |
|-------|------------------|-----------|
| `"public-ranking"` | players, dates, scores | `app/page.jsx` |
| `"admin-ranking"` | players, dates, scores | `app/admin/page.jsx` (AdminPanel) |

Evento escuchado: `{ event: "*", schema: "public" }` → cualquier INSERT/UPDATE/DELETE dispara `load()` completo.

---

## 8. Seguridad

### Auth flow

```
Cliente → supabase.auth.signInWithPassword()
       → Supabase Auth valida credenciales
       → JWT en cookie (gestionado por @supabase/ssr)
       → middleware.js lee la cookie en Edge
       → supabase.auth.getUser() verifica token
```

### RLS policies (resumen)

- **SELECT:** Sin restricción (`using (true)`) → lectura pública del ranking.
- **INSERT / UPDATE / DELETE:** Requieren `auth.uid() is not null` → solo usuarios autenticados por Supabase Auth.
- La anon key no puede saltar las RLS policies; son enforced en el servidor de Supabase.

### Middleware protection

- `middleware.js` corre en el Edge de Next.js y protege el matcher `/admin/:path*`.
- `/admin` (sin trailing path) está **excluido del matcher** intencionalmente: el guard es client-side via `getSession()` → muestra `LoginForm` si no hay sesión.
- Subrutas futuras `/admin/settings`, `/admin/export`, etc. quedan protegidas server-side automáticamente.

### Variables de entorno

| Variable | Exposición | Uso |
|----------|-----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública (cliente) | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública (cliente) | Clave anónima; RLS es el guard real |

No existe service role key en el código fuente (correcto).

---

## 9. Invariantes

Reglas que **NUNCA** deben romperse sin revisar impacto completo:

**INV-001** — La clave primaria de `scores` es `(player_id, date_id)`. Nunca agregar un campo `id` separado sin migrar la lógica de upsert.

**INV-002** — El campo `type` en `scores` solo puede ser `'points'` o `'bye'`. El CHECK constraint de la DB lo enforcea; el frontend nunca debe enviar otro valor.

**INV-003** — Las RLS policies de escritura deben siempre requerir `auth.uid() is not null`. Nunca dar acceso de escritura pública.

**INV-004** — El ordenamiento del ranking es: primero por `total` descendente, luego por `avg` descendente. Cambiar el criterio de ordenamiento requiere comunicar a todos los participantes del torneo.

**INV-005** — El campo `value` de un score `type='bye'` es siempre `0`. Los byes no suman puntos y no cuentan como "fechas jugadas" para el promedio.

**INV-006** — Eliminar un jugador elimina en cascada sus scores (ON DELETE CASCADE). No existe soft-delete; la operación es irreversible.

**INV-007** — El cliente Supabase se instancia **una sola vez** en `lib/supabase.js` y se importa como singleton. No crear instancias adicionales en componentes.

**INV-008** — Los canales Realtime deben limpiarse en el `return` del `useEffect` (`supabase.removeChannel(ch)`). No dejar suscripciones zombie.

---

## 10. Decisiones de Diseño

### Por qué `"use client"` en todo

**Decisión:** Todos los componentes de datos (`page.jsx`, `admin/page.jsx`) son Client Components.

**Razón:** La app requiere:
1. Suscripciones Realtime (WebSocket) — solo posible en cliente.
2. Estado reactivo local (`useState`, `useMemo`) para la UI interactiva.
3. Auth client-side (`getSession`, `onAuthStateChange`).

No hay datos que beneficien del Server-Side Rendering para este caso: el ranking cambia en tiempo real y no necesita ser indexable por SEO. Un RSC (React Server Component) que fetch-ea datos iniciales agregaría complejidad sin beneficio real.

### Por qué Supabase y no otra DB

**Decisión:** Supabase como backend completo (DB + Auth + Realtime).

**Razones:**
- **Realtime out-of-the-box:** `postgres_changes` sin infraestructura adicional (no se necesita WebSocket server propio, ni Redis Pub/Sub).
- **Auth incluida:** Login email/password con JWT sin implementar nada custom.
- **RLS nativa:** Las policies de acceso se definen en la DB, no en el código de la app — más seguro y menos superficie de error.
- **Free tier suficiente:** Para ~26 jugadores y ~13 fechas, el volumen de datos y conexiones está muy por debajo de cualquier límite gratuito.
- **SDK JS maduro:** `@supabase/supabase-js` y `@supabase/ssr` cubren todos los casos de uso necesarios.

Alternativa descartada: Firebase / Firestore — más complejidad en queries relacionales y sin ventaja de SQL para este modelo tabular.

### Por qué no hay Server Components

**Decisión:** Cero RSC para páginas de datos.

**Razón:** La actualización en tiempo real es el requisito central del producto. Un RSC fetchea datos en el servidor en el momento del request y no puede mantener una conexión Realtime. La arquitectura correcta para este caso es: RSC para shell estático (layout) + Client Component para todo lo que tiene datos vivos.

**Trade-off aceptado:** El HTML inicial llega sin datos (muestra "Cargando…") lo que no es ideal para SEO, pero el torneo es de acceso semi-privado y el SEO no es un requisito.

### Por qué upsert y no insert+update separados para scores

**Decisión:** `supabase.from("scores").upsert(row, { onConflict: "player_id,date_id" })`.

**Razón:** La PK compuesta garantiza idempotencia. Un upsert es más simple y seguro que verificar si el score existe antes de decidir insert vs update. Evita race conditions si el admin toca dos veces la misma celda rápidamente.

### Por qué sort_order con swap de dos filas y no índices consecutivos

**Decisión:** El reordenamiento intercambia los `sort_order` entre dos jugadores adyacentes.

**Razón:** Evita re-numerar todos los registros. Un upsert de 2 filas es atómico (en términos de Realtime) y suficientemente simple para la frecuencia de uso esperada (raramente se reordena).
