const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function seedAuth() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: 'inspector@auditoo.eco',
      password: 'password123',
      email_confirm: true,
    }),
  })
  if (!res.ok) throw new Error(`Auth seed failed: ${res.status} ${await res.text()}`)
  const user = await res.json()
  console.log('  auth user created:', user.id)
  return user.id
}
