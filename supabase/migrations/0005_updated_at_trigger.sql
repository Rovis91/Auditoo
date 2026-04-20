create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_inspections_updated_at
  before update on public.inspections
  for each row execute function public.set_updated_at();

create trigger set_levels_updated_at
  before update on public.levels
  for each row execute function public.set_updated_at();

create trigger set_spaces_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();
