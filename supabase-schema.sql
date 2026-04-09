-- =====================================================
-- RANKING TORNEO - Esquema de base de datos
-- Pegar todo esto en el SQL Editor de Supabase y ejecutar
-- =====================================================

-- Tabla de jugadores
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Tabla de fechas
create table if not exists dates (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Tabla de puntajes
create table if not exists scores (
  player_id uuid references players(id) on delete cascade,
  date_id uuid references dates(id) on delete cascade,
  type text not null check (type in ('points', 'bye')),
  value numeric default 0,
  updated_at timestamptz default now(),
  primary key (player_id, date_id)
);

-- Habilitar Row Level Security
alter table players enable row level security;
alter table dates enable row level security;
alter table scores enable row level security;

-- Políticas: lectura pública (cualquiera puede ver el ranking)
create policy "public read players" on players for select using (true);
create policy "public read dates" on dates for select using (true);
create policy "public read scores" on scores for select using (true);

-- Políticas: escritura solo para usuarios autenticados (admin)
create policy "auth write players" on players for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "auth write dates" on dates for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "auth write scores" on scores for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Habilitar realtime para actualizaciones en vivo
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table dates;
alter publication supabase_realtime add table scores;

-- =====================================================
-- DATOS INICIALES (opcional - borrar si empezás vacío)
-- =====================================================

insert into players (name, sort_order) values
  ('Bengolea', 1), ('Bullrich', 2), ('Smith Estrada', 3),
  ('Valenzuela', 4), ('Dell Acqua Juan', 5), ('Urquiza', 6),
  ('Sanguinetti', 7), ('Perez Aquino', 8), ('Dell Acqua Justo', 9),
  ('Biquard', 10), ('Saavedra', 11), ('Zavalia Nacho', 12),
  ('Zavalia Marcial', 13), ('Carvajal', 14), ('Blaquier', 15),
  ('Moreno Quintana', 16), ('Papiccio', 17), ('Dubarry Lula', 18),
  ('Costantini Jaime', 19), ('Costantini Martin', 20),
  ('Abella Juan', 21), ('Abella Martin', 22), ('Basavilbaso', 23),
  ('Milberg', 24), ('Recondo', 25), ('Del Carril', 26);

insert into dates (label, sort_order) values
  ('7-mar', 1), ('14-mar', 2), ('21-mar', 3), ('28-mar', 4),
  ('4-abr', 5), ('11-abr', 6), ('18-abr', 7), ('25-abr', 8),
  ('2-may', 9), ('9-may', 10), ('16-may', 11), ('23-may', 12),
  ('30-may', 13);
