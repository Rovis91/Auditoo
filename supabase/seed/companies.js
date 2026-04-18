export const COMPANY_ID = 'a1b2c3d4-0000-0000-0000-000000000001'

export async function seedCompanies(supabase) {
  const { error } = await supabase.from('companies').insert({
    id: COMPANY_ID,
    name: 'Diagnostics Dupont',
  })
  if (error) throw new Error(`companies seed failed: ${error.message}`)
  console.log('  company inserted:', COMPANY_ID)
}
