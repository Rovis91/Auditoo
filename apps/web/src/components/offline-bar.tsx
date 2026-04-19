import { useEffect, useState } from 'react'
import { mutationQueue } from '@/lib/queue'

type BarState = 'offline' | 'syncing' | 'synced'

export function OfflineBar() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const unsubscribe = mutationQueue.subscribe(setPending)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      unsubscribe()
    }
  }, [])

  const state: BarState = !online ? 'offline' : pending > 0 ? 'syncing' : 'synced'

  const label =
    state === 'offline'
      ? 'Hors ligne'
      : state === 'syncing'
        ? `Synchronisation (${pending})…`
        : 'Synchronisé'

  return (
    <div className="h-7 flex items-center justify-center bg-muted/50 border-b border-border">
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
