-- Datos de prueba: 4 usuarios, 2 equipos, 400 ciclistas, 3 carreras
set app.now = '2027-03-01 09:00:00 Europe/Madrid';

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com',   '{"full_name":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'carla@example.com', '{"name":"Carla"}'),
  ('00000000-0000-0000-0000-00000000000d', 'admin@example.com', '{}');
insert into public.app_admin values ('00000000-0000-0000-0000-00000000000d');

insert into public.team (pcs_slug, name, level, season) values
  ('uae-team-emirates-2027', 'UAE Team Emirates', 'WT', 2027),
  ('equipo-pro-2027', 'Equipo Pro', 'PRT', 2027);

insert into public.rider (pcs_slug, name, birthdate, team_id, pcs_points_base)
values ('tadej-pogacar', 'Tadej Pogačar', '1998-09-21', 1, 10000);
insert into public.rider (pcs_slug, name, birthdate, team_id, pcs_points_base)
select 'rider-' || i, 'Ciclista ' || i, make_date(1990 + (i % 16), 1 + (i % 12), 1 + (i % 27)),
       1 + (i % 2), round(4000 * exp(-i / 60.0))::int
from generate_series(2, 400) i;

select public.seed_initial_values();

-- Carreras (categoría decidida por las reglas)
insert into public.race (pcs_slug, season, name, uci_class, category, country, start_date, end_date, is_stage_race, entries_close_at)
values
 ('strade-bianche', 2027, 'Strade Bianche', '1.UWT', public.classify_race('strade-bianche', 'Strade Bianche', '1.UWT'),
  'it', '2027-03-06', '2027-03-06', false, '2027-03-06 11:00 Europe/Madrid'),
 ('giro-d-italia', 2027, 'Giro d''Italia', '2.UWT', public.classify_race('giro-d-italia', 'Giro d''Italia', '2.UWT'),
  'it', '2027-03-06', '2027-03-07', true, '2027-03-06 13:00 Europe/Madrid'),
 ('gp-martes', 2027, 'GP del Martes', '1.1', public.classify_race('gp-martes', 'GP del Martes', '1.1'),
  'es', '2027-03-09', '2027-03-09', false, '2027-03-09 12:00 Europe/Madrid');

insert into public.stage (race_id, number, date) values
  (1, 1, '2027-03-06'), (2, 1, '2027-03-06'), (2, 2, '2027-03-07'), (3, 1, '2027-03-09');
