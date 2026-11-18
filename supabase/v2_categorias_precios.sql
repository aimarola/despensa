-- =====================================================================
--  Despensa v2 · categorías, precios por supermercado, quién compra y total
--  (ejecutar después de schema.sql; se puede repetir sin problema)
-- =====================================================================

-- Categoría de cada producto (frutas-verduras, limpieza, …; ver src/lib/categories.ts)
alter table public.products add column if not exists category text not null default 'otros';
-- Precio orientativo cuando no se conoce el de un supermercado concreto (p.ej. de Open Prices)
alter table public.products add column if not exists ref_price numeric(10,2);

-- Último precio conocido de cada producto en cada supermercado
create table if not exists public.product_prices (
  product_id     uuid not null references public.products(id) on delete cascade,
  supermarket_id uuid not null references public.supermarkets(id) on delete cascade,
  price          numeric(10,2) not null check (price >= 0),
  source         text not null default 'manual' check (source in ('manual','compra','openprices')),
  updated_at     timestamptz not null default now(),
  primary key (product_id, supermarket_id)
);
alter table public.product_prices enable row level security;
drop policy if exists product_prices_all on public.product_prices;
create policy product_prices_all on public.product_prices for all
  using (exists (select 1 from public.products p
                 where p.id = product_id and public.is_member(p.household_id)))
  with check (exists (select 1 from public.products p
                      where p.id = product_id and public.is_member(p.household_id)));

-- Precio pagado por unidad en cada compra
alter table public.purchases add column if not exists unit_price numeric(10,2);

-- Quién fue a comprar, total pagado (ticket) y total estimado con los precios
alter table public.trips add column if not exists shoppers uuid[] not null default '{}';
alter table public.trips add column if not exists total_amount numeric(10,2);
alter table public.trips add column if not exists estimated_total numeric(10,2);

-- Nueva versión de "He hecho la compra"
--   p_bought: [{ "list_item_id": uuid, "quantity": int, "unit_price": numeric|null }]
--   p_extra:  [{ "product_id": uuid,  "quantity": int, "unit_price": numeric|null }]
drop function if exists public.complete_shopping(uuid, uuid, jsonb, jsonb);
drop function if exists public.complete_shopping(uuid, uuid, jsonb, jsonb, numeric, uuid[]);
create or replace function public.complete_shopping(
  p_household uuid, p_supermarket uuid, p_bought jsonb, p_extra jsonb default '[]'::jsonb,
  p_total numeric default null, p_shoppers uuid[] default null)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare tid uuid; r record; n int := 0; est numeric := 0; has_price boolean := false;
begin
  if not public.is_member(p_household) then raise exception 'Sin permiso'; end if;

  insert into trips(household_id, supermarket_id, done_by, shoppers, total_amount)
    values (p_household, p_supermarket, auth.uid(),
            coalesce(nullif(p_shoppers, '{}'), array[auth.uid()]),
            case when p_total is not null and p_total > 0 then round(p_total, 2) end)
    returning id into tid;

  for r in
    select x.product_id, x.list_item_id, x.qty, x.unit_price from (
      select li.product_id, li.id as list_item_id,
             greatest(coalesce((b->>'quantity')::int, li.quantity), 1) as qty,
             nullif(b->>'unit_price', '')::numeric as unit_price
        from jsonb_array_elements(coalesce(p_bought, '[]'::jsonb)) b
        join list_items li on li.id = (b->>'list_item_id')::uuid
       where li.household_id = p_household and li.status = 'pending'
      union all
      select p.id, null::uuid,
             greatest(coalesce((e->>'quantity')::int, 1), 1),
             nullif(e->>'unit_price', '')::numeric
        from jsonb_array_elements(coalesce(p_extra, '[]'::jsonb)) e
        join products p on p.id = (e->>'product_id')::uuid
       where p.household_id = p_household
    ) x
  loop
    insert into purchases(household_id, trip_id, product_id, quantity, unit_price)
      values (p_household, tid, r.product_id, r.qty, round(r.unit_price, 2));

    update list_items set status = 'bought', resolved_at = now(), trip_id = tid
     where status = 'pending' and (id = r.list_item_id or product_id = r.product_id);

    if r.unit_price is not null then
      est := est + r.unit_price * r.qty;
      has_price := true;
      -- El precio pagado se recuerda para la próxima vez
      if p_supermarket is not null then
        insert into product_prices(product_id, supermarket_id, price, source, updated_at)
          values (r.product_id, p_supermarket, round(r.unit_price, 2), 'compra', now())
          on conflict (product_id, supermarket_id)
          do update set price = excluded.price, source = 'compra', updated_at = now();
      else
        update products set ref_price = round(r.unit_price, 2) where id = r.product_id;
      end if;
    end if;
    n := n + 1;
  end loop;

  update trips set item_count = n,
                   estimated_total = case when has_price then round(est, 2) end
   where id = tid;
  return tid;
end $$;

revoke execute on function public.complete_shopping(uuid, uuid, jsonb, jsonb, numeric, uuid[]) from public, anon;
grant execute on function public.complete_shopping(uuid, uuid, jsonb, jsonb, numeric, uuid[]) to authenticated;

-- Corregir datos de una compra ya registrada (quién fue y total del ticket)
-- se hace con UPDATE directo sobre trips (RLS ya lo permite a la familia).

do $$
begin
  begin alter publication supabase_realtime add table public.product_prices; exception when duplicate_object then null; end;
end $$;
