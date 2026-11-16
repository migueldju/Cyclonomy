-- Eliminar la propia cuenta (lo exigen las tiendas de apps): borra al usuario y, en cascada, su perfil, sus equipos
-- en todas las ligas y lo que cuelga de ellos (plantilla, pujas, ofertas, inscripciones, movimientos).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  l record;
  v_next uuid;
begin
  if v_uid is null then raise exception 'Inicia sesión'; end if;

  -- traspasos pendientes hacia mis equipos: se anulan y el ciclista se queda con su dueño (si no, al borrar mi
  -- equipo la fila de la plantilla caería en cascada y el dueño lo perdería)
  update public.ownership o
     set pending_member_id = null, pending_price = null, transfer_at = null
   where o.pending_member_id in (select m.id from public.league_member m where m.user_id = v_uid);

  -- ligas que administro: pasan al jugador más antiguo que quede; si no queda nadie, la liga se borra
  for l in select id from public.league where admin_id = v_uid loop
    select m.user_id into v_next from public.league_member m
     where m.league_id = l.id and m.user_id <> v_uid order by m.joined_at limit 1;
    if v_next is null then
      delete from public.league where id = l.id;
    else
      update public.league set admin_id = v_next where id = l.id;
    end if;
  end loop;

  delete from auth.users where id = v_uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
