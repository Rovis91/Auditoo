export async function seedAgents(supabase, { userId, companyId }) {
  const { error } = await supabase.from('agents').insert({
    id: userId,
    company_id: companyId,
    email: 'inspector@auditoo.eco',
    name: 'Jean Dupont',
  })
  if (error) throw new Error(`agents seed failed: ${error.message}`)
  console.log('  agent inserted:', userId)
}
