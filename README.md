# Ranking del Torneo

App web para llevar el ranking de un torneo, con vista pública en vivo y panel de admin para cargar puntos.

## Qué hace

- **Página pública** (`/`): cualquiera con el link ve el ranking y la tabla completa, se actualiza en vivo cuando el admin carga puntos.
- **Panel de admin** (`/admin`): login con email/contraseña, carga de puntos, gestión de jugadores y fechas.

## Stack

- Next.js 14 (App Router)
- Supabase (base de datos + auth + realtime)
- Tailwind CSS
- Deploy en Vercel

---

## Paso 1 — Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta gratis.
2. **New project** → nombre, contraseña de base de datos (guardala), región cercana (São Paulo).
3. Esperá ~2 minutos a que se cree.
4. Andá a **SQL Editor** (ícono en el sidebar) → **New query**.
5. Copiá TODO el contenido de `supabase-schema.sql` y pegalo en el editor.
6. Tocá **Run**. Debería decir "Success. No rows returned".

Esto crea las tablas, permisos y datos iniciales (jugadores y fechas del torneo).

## Paso 2 — Crear el usuario admin

1. En Supabase, andá a **Authentication** → **Users** → **Add user** → **Create new user**.
2. Ingresá tu email y una contraseña.
3. Marcá **Auto Confirm User** para no tener que confirmar por mail.
4. Tocá **Create user**.

Este es el único usuario que va a poder cargar puntos.

## Paso 3 — Obtener las credenciales

1. En Supabase, andá a **Project Settings** (engranaje) → **API**.
2. Copiá dos valores:
   - **Project URL** (algo tipo `https://abcdefg.supabase.co`)
   - **anon public** key (una cadena larga)

## Paso 4 — Configurar local (opcional, para probar antes de deploy)

```bash
cd ranking-app
npm install
cp .env.local.example .env.local
```

Editá `.env.local` y pegá los valores del paso 3:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Después:

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) para el ranking público y [http://localhost:3000/admin](http://localhost:3000/admin) para el login de admin.

## Paso 5 — Subir a GitHub

```bash
git init
git add .
git commit -m "ranking torneo"
```

Creá un repo en GitHub y empujá:

```bash
git remote add origin https://github.com/TUUSUARIO/ranking-torneo.git
git branch -M main
git push -u origin main
```

## Paso 6 — Deploy en Vercel

1. Entrá a [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. **Add New** → **Project** → seleccioná el repo.
3. En **Environment Variables**, agregá:
   - `NEXT_PUBLIC_SUPABASE_URL` → tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → tu anon key
4. **Deploy**.

En ~1 minuto te da una URL tipo `ranking-torneo.vercel.app`. Esa es la que compartís con los jugadores.

---

## Cómo usarlo

- Pasale a los jugadores el link de la raíz (`https://tu-app.vercel.app`) — ven el ranking en vivo.
- Vos entrás a `/admin`, iniciás sesión con el email/contraseña del paso 2 y cargás los puntos fecha por fecha.
- Los cambios aparecen al instante en la vista pública de todos los que tengan el link abierto.

## Seguridad

- La base tiene Row Level Security activado: cualquiera puede leer (para el ranking público) pero solo usuarios autenticados pueden escribir.
- El único usuario autenticado es el que creaste en el paso 2.
- Si querés cambiar contraseña, vas a Supabase → Authentication → Users → tus tres puntitos → Send password recovery.

## Agregar más jugadores o fechas

Desde el panel de admin (`/admin`), pestaña **Jugadores y fechas**. O directamente desde Supabase → **Table Editor**.

## Costos

Todo gratis dentro de los límites generosos de Supabase (500MB DB, 50k usuarios activos) y Vercel (100GB ancho de banda). Para un torneo personal sobra con muchísimo margen.
