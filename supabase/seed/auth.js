const SEED_EMAIL = 'agent@exemple.com'

export async function seedAuth(supabase) {
  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Auth list users failed: ${error.message}`)
    const found = data.users.find(
      (u) => u.email?.toLowerCase() === SEED_EMAIL.toLowerCase(),
    )
    if (found) {
      console.log('  auth user exists:', found.id)
      return found.id
    }
    if (data.users.length < perPage) break
    page++
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: SEED_EMAIL,
    password: 'motdepasse',
    email_confirm: true,
  })
  if (createErr) throw new Error(`Auth seed failed: ${createErr.message}`)
  console.log('  auth user created:', created.user.id)
  return created.user.id
}
