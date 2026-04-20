import { useEffect, useRef, useState } from 'react'
import { mutationQueue } from '@/lib/queue'

const RECONNECT_VISIBLE_MS = 3500

type BarState = 'offline' | 'syncing' | 'reconnect'

export function OfflineBar() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [pending, setPending] = useState(0)
  const [showReconnect, setShowReconnect] = useState(false)
  const wasOfflineRef = useRef(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )

  useEffect(() => {
    const onOffline = () => {
      wasOfflineRef.current = true
      setOnline(false)
      setShowReconnect(false)
    }
    const onOnline = () => {
      setOnline(true)
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false
        setShowReconnect(true)
      }
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const unsubscribe = mutationQueue.subscribe(setPending)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!showReconnect) return
    const t = window.setTimeout(() => setShowReconnect(false), RECONNECT_VISIBLE_MS)
    return () => clearTimeout(t)
  }, [showReconnect])

  const visible = !online || showReconnect || pending > 0

  if (!visible) {
    return null
  }

  const state: BarState = !online
    ? 'offline'
    : pending > 0
      ? 'syncing'
      : 'reconnect'

  const label =
    state === 'offline'
      ? 'Hors ligne'
      : state === 'syncing'
        ? `Synchronisation (${pending})…`
        : 'De retour en ligne'

  const styles: Record<BarState, string> = {
    offline: 'bg-amber-50 border-amber-200 text-amber-800',
    syncing: 'bg-sky-50 border-sky-200 text-sky-700',
    reconnect: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-bar"
      className={`h-8 flex items-center justify-center border-b transition-colors ${styles[state]}`}
    >
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}
