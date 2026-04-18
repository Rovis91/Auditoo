alter table public.inspections enable row level security;
alter table public.levels enable row level security;
alter table public.spaces enable row level security;

create policy "company_inspections"
  on public.inspections for all
  using (company_id = (select company_id from public.agents where id = auth.uid()))
  with check (company_id = (select company_id from public.agents where id = auth.uid()));

create policy "company_levels"
  on public.levels for all
  using (
    inspection_id in (
      select id from public.inspections
      where company_id = (select company_id from public.agents where id = auth.uid())
    )
  )
  with check (
    inspection_id in (
      select id from public.inspections
      where company_id = (select company_id from public.agents where id = auth.uid())
    )
  );

create policy "company_spaces"
  on public.spaces for all
  using (
    level_id in (
      select l.id from public.levels l
      join public.inspections i on l.inspection_id = i.id
      where i.company_id = (select company_id from public.agents where id = auth.uid())
    )
  )
  with check (
    level_id in (
      select l.id from public.levels l
      join public.inspections i on l.inspection_id = i.id
      where i.company_id = (select company_id from public.agents where id = auth.uid())
    )
  );
