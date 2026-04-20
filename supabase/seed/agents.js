export async function seedAgents(supabase, { userId, companyId }) {
  const { error } = await supabase.from('agents').upsert(
    {
      id: userId,
      company_id: companyId,
      email: 'agent@exemple.com',
      name: 'Jean Dupont',
    },
    { onConflict: 'id' },
  )
  if (error) throw new Error(`agents seed failed: ${error.message}`)
  console.log('  agent upserted:', userId)
}
