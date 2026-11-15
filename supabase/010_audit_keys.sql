-- =====================================================================
-- LLC — 010: audit log names the record for tables keyed by "key"
-- (site settings showed as "site_settings #" with no name).
-- Run in Supabase → SQL Editor after 009. Safe to re-run.
-- =====================================================================
create or replace function public.audit() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare diff jsonb; o jsonb; n jsonb; k text;
begin
  if tg_op = 'UPDATE' then
    o := to_jsonb(old); n := to_jsonb(new); diff := '{}';
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at') and (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
      end if;
    end loop;
    if diff = '{}' then return new; end if;
  elsif tg_op = 'INSERT' then diff := to_jsonb(new);
  else diff := to_jsonb(old);
  end if;
  insert into public.audit_log (actor_id, actor_name, action, table_name, row_id, changes)
  values (auth.uid(), (select full_name from public.profiles where id = auth.uid()), lower(tg_op), tg_table_name,
          coalesce(case when tg_op = 'DELETE' then coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key') else coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key') end, ''), diff);
  return coalesce(new, old);
end $$;

-- fill in the lines already written
update public.audit_log set row_id = coalesce(changes ->> 'key', changes -> 'key' ->> 'to', row_id)
where table_name = 'site_settings' and coalesce(row_id, '') = '';
