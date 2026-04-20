const apiUrl = import.meta.env.VITE_API_URL as string | undefined
if (!apiUrl) throw new Error('VITE_API_URL is not set — check apps/web/.env')
export const API_BASE = apiUrl
