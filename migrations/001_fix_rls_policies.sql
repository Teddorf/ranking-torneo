-- =====================================================
-- MIGRACIÓN 001: Fix RLS policies
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Problema: auth.role() deprecado + policies "for all" solapadas con "for select"
-- Fix: separar por operación + usar auth.uid() is not null
-- =====================================================

BEGIN;

-- 1. Eliminar policies viejas
DROP POLICY IF EXISTS "auth write players" ON players;
DROP POLICY IF EXISTS "auth write dates" ON dates;
DROP POLICY IF EXISTS "auth write scores" ON scores;

-- 2. Crear policies granulares con auth.uid()
-- Players
CREATE POLICY "auth insert players" ON players FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update players" ON players FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete players" ON players FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Dates
CREATE POLICY "auth insert dates" ON dates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update dates" ON dates FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete dates" ON dates FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Scores
CREATE POLICY "auth insert scores" ON scores FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update scores" ON scores FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete scores" ON scores FOR DELETE
  USING (auth.uid() IS NOT NULL);

COMMIT;

-- =====================================================
-- ROLLBACK (ejecutar solo si algo falla):
-- =====================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "auth insert players" ON players;
-- DROP POLICY IF EXISTS "auth update players" ON players;
-- DROP POLICY IF EXISTS "auth delete players" ON players;
-- DROP POLICY IF EXISTS "auth insert dates" ON dates;
-- DROP POLICY IF EXISTS "auth update dates" ON dates;
-- DROP POLICY IF EXISTS "auth delete dates" ON dates;
-- DROP POLICY IF EXISTS "auth insert scores" ON scores;
-- DROP POLICY IF EXISTS "auth update scores" ON scores;
-- DROP POLICY IF EXISTS "auth delete scores" ON scores;
--
-- NOTA: el rollback restaura policies "for all" (menos granulares) pero
-- usa auth.uid() IS NOT NULL (no la deprecada auth.role())
-- CREATE POLICY "auth write players" ON players FOR ALL
--   USING (auth.uid() IS NOT NULL)
--   WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY "auth write dates" ON dates FOR ALL
--   USING (auth.uid() IS NOT NULL)
--   WITH CHECK (auth.uid() IS NOT NULL);
-- CREATE POLICY "auth write scores" ON scores FOR ALL
--   USING (auth.uid() IS NOT NULL)
--   WITH CHECK (auth.uid() IS NOT NULL);
-- COMMIT;
