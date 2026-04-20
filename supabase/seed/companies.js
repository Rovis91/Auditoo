export const COMPANY_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

export async function seedCompanies(supabase) {
  const { error } = await supabase.from('companies').upsert(
    {
      id: COMPANY_ID,
      name: 'Diagnostics Dupont',
    },
    { onConflict: 'id' },
  )
  if (error) throw new Error(`companies seed failed: ${error.message}`)
  console.log('  company upserted:', COMPANY_ID)
}
