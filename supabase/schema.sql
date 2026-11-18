-- =====================================================================
--  Despensa · esquema de base de datos para Supabase
--  Ejecutar entero en: Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Una "familia" (hogar) comparte lista, productos y supermercados
create table if not exists public.households (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at   timestamptz not null default now()
);

create table if not exists public.members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists members_user_idx on public.members(user_id);

create table if not exists public.supermarkets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  color        text not null default '#2f9e44',
  created_at   timestamptz not null default now()
);

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  brand        text,
  barcode      text,
  image_url    text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index if not exists products_barcode_uidx
  on public.products(household_id, barcode) where barcode is not null;

-- En qué supermercados se compra cada producto (vacío = en cualquiera)
create table if not exists public.product_supermarkets (
  product_id     uuid not null references public.products(id) on delete cascade,
  supermarket_id uuid not null references public.supermarkets(id) on delete cascade,
  primary key (product_id, supermarket_id)
);

-- Cada compra realizada ("he hecho la compra")
create table if not exists public.trips (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  supermarket_id uuid references public.supermarkets(id) on delete set null,
  done_by        uuid references auth.users(id) on delete set null,
  done_at        timestamptz not null default now(),
  item_count     int not null default 0
);
create index if not exists trips_household_idx on public.trips(household_id, done_at desc);

-- Lo que falta en casa (status = pending) y su historia
create table if not exists public.list_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  quantity     int  not null default 1 check (quantity > 0),
  note         text,
  status       text not null default 'pending' check (status in ('pending','bought','removed')),
  added_by     uuid references auth.users(id) on delete set null,
  added_at     timestamptz not null default now(),
  resolved_at  timestamptz,
  trip_id      uuid references public.trips(id) on delete set null
);
-- Un producto solo puede estar una vez "pendiente" en la lista
create unique index if not exists list_items_pending_uidx
  on public.list_items(product_id) where status = 'pending';
create index if not exists list_items_household_idx on public.list_items(household_id, status);

-- Trazabilidad: una fila por producto comprado en cada compra
create table if not exists public.purchases (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id      uuid not null references public.trips(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  quantity     int  not null default 1 check (quantity > 0),
  purchased_at timestamptz not null default now()
);
create index if not exists purchases_product_idx on public.purchases(product_id, purchased_at desc);
create index if not exists purchases_trip_idx on public.purchases(trip_id);

-- Estadísticas por producto: veces comprado, unidades, última compra, frecuencia
create or replace view public.product_stats
with (security_invoker = true) as
select
  p.product_id,
  p.household_id,
  count(distinct p.trip_id)::int                       as times_bought,
  sum(p.quantity)::int                                 as total_quantity,
  min(p.purchased_at)                                  as first_bought,
  max(p.purchased_at)                                  as last_bought,
  case when count(distinct p.trip_id) > 1 then
    round((extract(epoch from max(p.purchased_at) - min(p.purchased_at)) / 86400.0
          / (count(distinct p.trip_id) - 1))::numeric, 1)
  end                                                  as avg_days_between
from public.purchases p
group by p.product_id, p.household_id;

-- ---------------------------------------------------------------------
-- Seguridad (Row Level Security): cada familia solo ve lo suyo
-- ---------------------------------------------------------------------

create or replace function public.is_member(hid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m
                 where m.household_id = hid and m.user_id = auth.uid());
$$;

alter table public.households           enable row level security;
alter table public.members              enable row level security;
alter table public.supermarkets         enable row level security;
alter table public.products             enable row level security;
alter table public.product_supermarkets enable row level security;
alter table public.trips                enable row level security;
alter table public.list_items           enable row level security;
alter table public.purchases            enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households for select using (public.is_member(id));
drop policy if exists households_update on public.households;
create policy households_update on public.households for update using (public.is_member(id));

drop policy if exists members_select on public.members;
create policy members_select on public.members for select using (public.is_member(household_id));
drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members for update using (user_id = auth.uid());
drop policy if exists members_delete_self on public.members;
create policy members_delete_self on public.members for delete using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['supermarkets','products','trips','list_items','purchases'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format(
      'create policy %1$s_all on public.%1$s for all
         using (public.is_member(household_id))
         with check (public.is_member(household_id))', t);
  end loop;
end $$;

drop policy if exists product_supermarkets_all on public.product_supermarkets;
create policy product_supermarkets_all on public.product_supermarkets for all
  using (exists (select 1 from public.products p
                 where p.id = product_id and public.is_member(p.household_id)))
  with check (exists (select 1 from public.products p
                      where p.id = product_id and public.is_member(p.household_id)));

-- ---------------------------------------------------------------------
-- Funciones (RPC) que usa la app
-- ---------------------------------------------------------------------

-- Crear una familia nueva y entrar en ella
create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  insert into households(name) values (coalesce(nullif(trim(p_name), ''), 'Mi casa'))
    returning id into hid;
  insert into members(household_id, user_id, display_name)
    values (hid, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Yo'));
  return hid;
end $$;

-- Unirse a una familia con su código de invitación
create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select id into hid from households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'Código de familia no válido'; end if;
  insert into members(household_id, user_id, display_name)
    values (hid, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Yo'))
    on conflict (household_id, user_id) do update set display_name = excluded.display_name;
  return hid;
end $$;

-- Generar un código de invitación nuevo
create or replace function public.regenerate_invite_code(p_household uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_member(p_household) then raise exception 'Sin permiso'; end if;
  c := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  update households set invite_code = c where id = p_household;
  return c;
end $$;

-- Apuntar que falta un producto (si ya estaba en la lista, suma cantidad)
create or replace function public.add_to_list(p_product uuid, p_quantity int default 1, p_note text default null)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare hid uuid; lid uuid;
begin
  select household_id into hid from products where id = p_product;
  if hid is null or not public.is_member(hid) then raise exception 'Producto no encontrado'; end if;

  update list_items
     set quantity = quantity + greatest(coalesce(p_quantity, 1), 1),
         note = coalesce(nullif(trim(p_note), ''), note)
   where product_id = p_product and status = 'pending'
   returning id into lid;

  if lid is null then
    insert into list_items(household_id, product_id, quantity, note, added_by)
      values (hid, p_product, greatest(coalesce(p_quantity, 1), 1), nullif(trim(p_note), ''), auth.uid())
      returning id into lid;
  end if;
  return lid;
end $$;

-- "He hecho la compra"
--   p_bought: [{ "list_item_id": uuid, "quantity": int }]  -> se compraron (salen de la lista)
--   p_extra:  [{ "product_id": uuid,  "quantity": int }]   -> comprados sin estar en la lista
--   Lo que estaba en la lista y no se compró sigue pendiente.
create or replace function public.complete_shopping(
  p_household uuid, p_supermarket uuid, p_bought jsonb, p_extra jsonb default '[]'::jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare tid uuid; r record; n int := 0;
begin
  if not public.is_member(p_household) then raise exception 'Sin permiso'; end if;

  insert into trips(household_id, supermarket_id, done_by)
    values (p_household, p_supermarket, auth.uid()) returning id into tid;

  for r in
    select li.id, li.product_id,
           greatest(coalesce((b->>'quantity')::int, li.quantity), 1) as qty
      from jsonb_array_elements(coalesce(p_bought, '[]'::jsonb)) b
      join list_items li on li.id = (b->>'list_item_id')::uuid
     where li.household_id = p_household and li.status = 'pending'
  loop
    insert into purchases(household_id, trip_id, product_id, quantity)
      values (p_household, tid, r.product_id, r.qty);
    update list_items set status = 'bought', resolved_at = now(), trip_id = tid where id = r.id;
    n := n + 1;
  end loop;

  for r in
    select p.id as product_id, greatest(coalesce((e->>'quantity')::int, 1), 1) as qty
      from jsonb_array_elements(coalesce(p_extra, '[]'::jsonb)) e
      join products p on p.id = (e->>'product_id')::uuid
     where p.household_id = p_household
  loop
    insert into purchases(household_id, trip_id, product_id, quantity)
      values (p_household, tid, r.product_id, r.qty);
    -- si por casualidad estaba pendiente, también se da por comprado
    update list_items set status = 'bought', resolved_at = now(), trip_id = tid
     where product_id = r.product_id and status = 'pending';
    n := n + 1;
  end loop;

  update trips set item_count = n where id = tid;
  return tid;
end $$;

-- Nadie sin sesión puede llamar a las funciones
revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.add_to_list(uuid, int, text) from public, anon;
revoke execute on function public.complete_shopping(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.create_household(text, text)          to authenticated;
grant execute on function public.join_household(text, text)            to authenticated;
grant execute on function public.regenerate_invite_code(uuid)          to authenticated;
grant execute on function public.add_to_list(uuid, int, text)          to authenticated;
grant execute on function public.complete_shopping(uuid, uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Fotos de productos (Storage)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- (necesaria también para poder borrar o sustituir fotos desde la app)
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (bucket_id = 'product-images'
         and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "fotos: subir" on storage.objects;
create policy "fotos: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images'
              and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "fotos: cambiar" on storage.objects;
create policy "fotos: cambiar" on storage.objects for update to authenticated
  using (bucket_id = 'product-images'
         and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "fotos: borrar" on storage.objects;
create policy "fotos: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images'
         and public.is_member(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------
-- Tiempo real: la lista se actualiza sola en los móviles de toda la familia
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.list_items;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.products;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.supermarkets; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.trips;        exception when duplicate_object then null; end;
end $$;
