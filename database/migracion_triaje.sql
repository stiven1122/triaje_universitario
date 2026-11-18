-- =====================================================================
-- MIGRACIÓN: reglas de triaje por rol y tipo de correo
-- Ejecutar UNA VEZ en Supabase > SQL Editor (si ya habías ejecutado
-- schema.sql antes de esta versión). Es seguro repetirla.
-- =====================================================================

-- 1) Nuevas columnas en correos: quién escribe, qué pide y qué se decidió
alter table public.correos
  add column if not exists rol_remitente  text
    check (rol_remitente in ('Docente','Estudiante','Vicerrectoría','Desconocido')),
  add column if not exists tipo_correo    text
    check (tipo_correo in ('Propuesta de proyecto','Salida técnica','Consulta','Promoción','Otro')),
  add column if not exists decision_triaje text
    check (decision_triaje in ('Pendiente','Revisión manual','Descartado')),
  add column if not exists motivo_triaje  text;

create index if not exists idx_correos_decision on public.correos (decision_triaje);

-- 2) Nuevo estado de solicitud: "Revisión manual"
alter table public.solicitudes drop constraint if exists solicitudes_estado_check;
alter table public.solicitudes add constraint solicitudes_estado_check
  check (estado in ('Pendiente','En revisión','Revisión manual','Aprobada','Rechazada',
                    'Información requerida','Error de procesamiento'));

-- 3) Estadísticas: "Revisión manual" cuenta como pendiente de decisión
create or replace function public.obtener_estadisticas()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_correos',        (select count(*) from public.correos),
    'correos_urgentes',     (select count(*) from public.correos where categoria = 'Urgente' or prioridad = 'Crítica'),
    'prioridad_alta',       (select count(*) from public.correos where prioridad = 'Alta'),
    'pendientes_decision',  (select count(*) from public.solicitudes where estado in ('Pendiente','En revisión','Revisión manual')),
    'revision_manual',      (select count(*) from public.solicitudes where estado = 'Revisión manual'),
    'descartados',          (select count(*) from public.correos where decision_triaje = 'Descartado'),
    'info_requerida',       (select count(*) from public.solicitudes where estado = 'Información requerida'),
    'total_solicitudes',    (select count(*) from public.solicitudes),
    'solicitudes_asignadas',(select count(*) from public.solicitudes where asignado_a is not null),
    'resueltas',            (select count(*) from public.solicitudes where estado in ('Aprobada','Rechazada')),
    'tasa_resolucion',      (select case when count(*) = 0 then 0
                                    else round(100.0 * count(*) filter (where estado in ('Aprobada','Rechazada')) / count(*), 1)
                                    end
                             from public.solicitudes),
    'tiempo_promedio_respuesta_horas',
                            (select round(avg(extract(epoch from (s.decidido_en - c.fecha_recepcion)) / 3600.0)::numeric, 1)
                             from public.solicitudes s
                             join public.correos c on c.id = s.correo_id
                             where s.decidido_en is not null),
    'por_categoria',        (select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
                             from (select categoria, count(*) as total from public.correos group by categoria) t)
  );
$$;

-- Mantener el permiso solo para el backend
revoke all on function public.obtener_estadisticas() from public, anon, authenticated;
grant execute on function public.obtener_estadisticas() to service_role;
