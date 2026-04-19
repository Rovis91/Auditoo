import { useEffect, useState } from 'react'

type BarState = 'offline' | 'syncing' | 'synced'

/** Phase 4: top status strip. Phase 5 will drive `syncing` from the mutation queue. */
export function OfflineBar({ pendingMutations = 0 }: { pendingMutations?: number }) {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    function onOnline() {
      setOnline(true)
    }
    function onOffline() {
      setOnline(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const state: BarState = !online ? 'offline' : pendingMutations > 0 ? 'syncing' : 'synced'

  const label =
    state === 'offline'
      ? 'Hors ligne'
      : state === 'syncing'
        ? `Synchronisation (${pendingMutations})…`
        : 'Synchronisé'

  return (
    <div className="h-7 flex items-center justify-center bg-muted/50 border-b border-border">
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
