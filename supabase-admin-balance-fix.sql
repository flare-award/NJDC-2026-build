-- Разрешаем админу обновлять любые профили
DROP POLICY IF EXISTS "admin update any nodbet profile" ON nodbet_profiles;
CREATE POLICY "admin update any nodbet profile"
  ON nodbet_profiles FOR UPDATE
  USING ((select auth.jwt() ->> 'email') = 'maronn@njdc.local')
  WITH CHECK ((select auth.jwt() ->> 'email') = 'maronn@njdc.local');
