import { Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function VoiceBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex justify-center">
      <Button size="icon" variant="outline" className="rounded-full w-12 h-12" disabled>
        <Mic className="w-5 h-5" />
      </Button>
    </div>
  )
}
