import { useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { Trash2 } from 'lucide-react'
import { entityCardClassName } from '@/components/entity-card'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/** Inset strip from container edges (px) — avoids 1px color bleed past rounded cards. */
const STRIP_EDGE_INSET_PX = 2
/** Pixels of action strip tucked under the card (covers rounded-corner gaps). */
const STRIP_UNDERLAP_PX = 12
/** Visible swipe distance / delete column width (px). */
const DELETE_VISIBLE_PX = 48
/** Total absolute strip width = underlap + visible (underlap is non-interactive). */
const DELETE_STRIP_TOTAL_PX = STRIP_UNDERLAP_PX + DELETE_VISIBLE_PX
const DEFAULT_THRESHOLD = -DELETE_VISIBLE_PX

export interface SwipeDeleteRowProps {
  onDelete: () => void
  children: React.ReactNode
  /** Horizontal reveal threshold (negative px). */
  thresholdPx?: number
  /** `data-testid` on the delete button (default: space-swipe-delete). */
  deleteButtonTestId?: string
  /** Optional class on the outer wrapper. */
  className?: string
}

/**
 * Swipe left to reveal a destructive delete action. Used for spaces on the
 * inspection detail screen and inspection cards on the list.
 */
export function SwipeDeleteRow({
  onDelete,
  children,
  thresholdPx = DEFAULT_THRESHOLD,
  deleteButtonTestId = 'space-swipe-delete',
  className,
}: SwipeDeleteRowProps) {
  const [dx, setDx] = useState(0)

  const bind = useDrag(
    ({ movement: [mx], last, cancel }) => {
      if (mx > 0) {
        cancel()
        return
      }
      setDx(last ? (mx < thresholdPx ? thresholdPx : 0) : Math.max(mx, thresholdPx))
    },
    { axis: 'x', filterTaps: true },
  )

  const maxReveal = Math.abs(thresholdPx)
  const openness = Math.min(1, Math.max(0, Math.abs(dx) / maxReveal))

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-lg bg-card',
        className,
      )}
      data-testid="swipe-row"
    >
      <div
        className="pointer-events-none absolute z-0 flex overflow-hidden rounded-r-lg"
        style={{
          top: STRIP_EDGE_INSET_PX,
          bottom: STRIP_EDGE_INSET_PX,
          right: STRIP_EDGE_INSET_PX,
          width: DELETE_STRIP_TOTAL_PX,
        }}
        aria-hidden
      >
        <div
          className="h-full shrink-0 bg-destructive"
          style={{ width: STRIP_UNDERLAP_PX }}
          aria-hidden
        />
        <Button
          type="button"
          variant="destructive"
          size="iconTouch"
          className="pointer-events-auto h-full min-h-11 w-12 min-w-12 shrink-0 rounded-none rounded-r-lg px-0"
          onClick={onDelete}
          aria-label="Supprimer"
          data-testid={deleteButtonTestId}
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>
      <div
        {...bind()}
        style={{
          transform: `translateX(${dx}px)`,
          touchAction: 'pan-y',
          ['--swipe-openness' as string]: String(openness),
        }}
        className={cn(
          entityCardClassName,
          'relative z-[1] min-w-0 w-full transition-transform duration-150 will-change-transform',
        )}
      >
        {children}
      </div>
    </div>
  )
}
