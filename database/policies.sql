-- =====================================================================
-- Políticas de seguridad (Row Level Security)
-- Ejecutar DESPUÉS de schema.sql
--
-- Modelo:
--  * El backend y n8n usan la service_role key (ignora RLS por diseño).
--  * Cualquier otro acceso (anon / authenticated) queda restringido:
--    solo usuarios activos de la tabla "usuarios" pueden LEER.
--  * Nadie, salvo service_role, puede escribir desde el cliente.
-- =====================================================================

alter table public.usuarios              enable row level security;
alter table public.correos               enable row level security;
alter table public.solicitudes           enable row level security;
alter table public.historial_solicitudes enable row level security;
alter table public.correos_enviados      enable row level security;

-- Función auxiliar: ¿el usuario autenticado es personal activo?
create or replace function public.es_personal_activo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.activo = true
  );
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.activo = true and u.rol = 'admin'
  );
$$;

-- Limpieza para poder re-ejecutar el script
drop policy if exists usuarios_select_propio      on public.usuarios;
drop policy if exists usuarios_admin_all          on public.usuarios;
drop policy if exists correos_select_personal     on public.correos;
drop policy if exists solicitudes_select_personal on public.solicitudes;
drop policy if exists historial_select_personal   on public.historial_solicitudes;
drop policy if exists enviados_select_personal    on public.correos_enviados;

-- USUARIOS: cada quien ve su fila; el admin gestiona todas
create policy usuarios_select_propio on public.usuarios
  for select to authenticated
  using (id = auth.uid() or public.es_admin());

create policy usuarios_admin_all on public.usuarios
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Lectura para personal activo (las escrituras solo las hace service_role)
create policy correos_select_personal on public.correos
  for select to authenticated
  using (public.es_personal_activo());

create policy solicitudes_select_personal on public.solicitudes
  for select to authenticated
  using (public.es_personal_activo());

create policy historial_select_personal on public.historial_solicitudes
  for select to authenticated
  using (public.es_personal_activo());

create policy enviados_select_personal on public.correos_enviados
  for select to authenticated
  using (public.es_personal_activo());

-- La función de estadísticas solo debe poder invocarla el backend
revoke all on function public.obtener_estadisticas() from public, anon, authenticated;
grant execute on function public.obtener_estadisticas() to service_role;

-- =====================================================================
-- ALTA DEL PRIMER ADMINISTRADOR
-- 1) Supabase > Authentication > Users > Add user (email + contraseña,
--    marca "Auto Confirm User").
-- 2) Reemplaza el correo y ejecuta:
--
-- insert into public.usuarios (id, email, nombre, rol)
-- select id, email, 'Administrador', 'admin'
-- from auth.users
-- where email = 'admin@tuuniversidad.edu.co';
-- =====================================================================
