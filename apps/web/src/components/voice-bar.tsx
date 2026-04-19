import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, type PostVoiceResult } from '@/lib/api'

type BarPhase = 'idle' | 'recording' | 'processing' | 'queued' | 'done' | 'error'

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export interface VoiceBarProps {
  inspectionId: string
  spaceId?: string
  /** Called after a successful online transcription (refetch or merge in parent). */
  onComplete?: (result: PostVoiceResult) => void
}

export function VoiceBar({ inspectionId, spaceId, onComplete }: VoiceBarProps) {
  const [phase, setPhase] = useState<BarPhase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const mimeRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => {
    clearTimer()
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [clearTimer])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try {
        rec.requestData()
      } catch {
        /* optional on some browsers */
      }
      rec.stop()
    }
    clearTimer()
  }, [clearTimer])

  const startRecording = useCallback(async () => {
    setErrorMsg(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      mimeRef.current = pickMimeType()
      chunksRef.current = []
      const rec = mimeRef.current
        ? new MediaRecorder(stream, { mimeType: mimeRef.current })
        : new MediaRecorder(stream)
      recorderRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        recorderRef.current = null
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current || rec.mimeType || 'audio/webm',
        })
        chunksRef.current = []
        void (async () => {
          setPhase('processing')
          try {
            const result = await api.postVoice(blob, inspectionId, spaceId)
            onComplete?.(result)
            if (result.status === 'queued') {
              setPhase('queued')
              window.setTimeout(() => setPhase('idle'), 2000)
            } else {
              setPhase('done')
              window.setTimeout(() => setPhase('idle'), 1500)
            }
          } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : 'Erreur vocale')
            setPhase('error')
          }
        })()
      }
      setElapsed(0)
      rec.start()
      setPhase('recording')
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch {
      setErrorMsg('Microphone refusé ou indisponible')
      setPhase('error')
    }
  }, [inspectionId, spaceId, onComplete])

  const dismissError = useCallback(() => {
    setErrorMsg(null)
    setPhase('idle')
  }, [])

  const label =
    phase === 'idle'
      ? null
      : phase === 'recording'
        ? `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
        : phase === 'processing'
          ? 'Analyse…'
          : phase === 'queued'
            ? 'En file (hors ligne)'
            : phase === 'done'
              ? 'Enregistré'
              : phase === 'error'
                ? errorMsg ?? 'Erreur'
                : null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-3 w-full max-w-md">
        {phase === 'recording' ? (
          <>
            <span className="text-sm tabular-nums text-muted-foreground min-w-[3.5rem]">{label}</span>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="rounded-full w-12 h-12 shrink-0"
              onClick={stopRecording}
              aria-label="Arrêter l'enregistrement"
            >
              <Square className="w-4 h-4 fill-current" />
            </Button>
          </>
        ) : (
          <>
            {label && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 flex-1 justify-center min-h-6">
                {phase === 'processing' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                {phase === 'done' && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                {label}
              </span>
            )}
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="rounded-full w-12 h-12 shrink-0"
              disabled={phase === 'processing' || phase === 'queued' || phase === 'done'}
              onClick={phase === 'error' ? dismissError : startRecording}
              aria-label={
                phase === 'error' ? 'Fermer' : 'Dicter une observation'
              }
            >
              {phase === 'processing' || phase === 'queued' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
