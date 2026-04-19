-- Subqueries on public.agents inside agents RLS re-evaluate the same policy → infinite recursion (42P17).

create or replace function public.current_user_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.agents where id = auth.uid() limit 1;
$$;

drop policy if exists "agents_select" on public.agents;
drop policy if exists "companies_select" on public.companies;
drop policy if exists "company_inspections" on public.inspections;
drop policy if exists "company_levels" on public.levels;
drop policy if exists "company_spaces" on public.spaces;

create policy "agents_select"
  on public.agents for select
  using (
    id = auth.uid()
    or company_id = public.current_user_company_id()
  );

create policy "companies_select"
  on public.companies for select
  using (id = public.current_user_company_id());

create policy "company_inspections"
  on public.inspections for all
  using (company_id = public.current_user_company_id())
  with check (company_id = public.current_user_company_id());

create policy "company_levels"
  on public.levels for all
  using (
    inspection_id in (
      select id from public.inspections
      where company_id = public.current_user_company_id()
    )
  )
  with check (
    inspection_id in (
      select id from public.inspections
      where company_id = public.current_user_company_id()
    )
  );

create policy "company_spaces"
  on public.spaces for all
  using (
    level_id in (
      select l.id from public.levels l
      join public.inspections i on l.inspection_id = i.id
      where i.company_id = public.current_user_company_id()
    )
  )
  with check (
    level_id in (
      select l.id from public.levels l
      join public.inspections i on l.inspection_id = i.id
      where i.company_id = public.current_user_company_id()
    )
  );
