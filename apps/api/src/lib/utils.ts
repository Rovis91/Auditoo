/**
 * Picks a subset of keys from an unvalidated body object and returns a
 * properly typed partial — safe to pass directly to Supabase .update().
 * The caller guarantees that `allowed` lists only keys that exist in T.
 */
export function pickAllowed<T>(
  body: Record<string, unknown>,
  allowed: readonly (keyof T & string)[]
): Partial<T> {
  const result: Partial<T> = {}
  for (const key of allowed) {
    if (key in body) result[key as keyof T] = body[key] as never
  }
  return result
}
