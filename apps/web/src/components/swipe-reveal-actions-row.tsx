import { useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { Pencil, Trash2 } from 'lucide-react'
import { entityCardClassName } from '@/components/entity-card'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/** Inset strip from container edges (px) — avoids 1px color bleed past rounded cards. */
const STRIP_EDGE_INSET_PX = 2
/** Pixels of strip tucked under the card (covers rounded-corner gaps). */
const STRIP_UNDERLAP_PX = 12
/** Width of each action column (px). */
const ACTION_COL_PX = 48
const REVEAL_WIDTH = ACTION_COL_PX * 2
const THRESHOLD = -REVEAL_WIDTH
const STRIP_TOTAL_PX = STRIP_UNDERLAP_PX + REVEAL_WIDTH

export interface SwipeRevealActionsRowProps {
  onEdit: () => void
  onDelete: () => void
  children: React.ReactNode
  editButtonTestId?: string
  deleteButtonTestId?: string
  className?: string
}

/**
 * Swipe left to reveal edit + delete. No always-visible chrome — actions stay
 * under the row until the user swipes.
 */
export function SwipeRevealActionsRow({
  onEdit,
  onDelete,
  children,
  editButtonTestId = 'swipe-reveal-edit',
  deleteButtonTestId = 'swipe-reveal-delete',
  className,
}: SwipeRevealActionsRowProps) {
  const [dx, setDx] = useState(0)

  const bind = useDrag(
    ({ movement: [mx], last, cancel }) => {
      if (mx > 0) {
        cancel()
        return
      }
      setDx(last ? (mx < THRESHOLD ? THRESHOLD : 0) : Math.max(mx, THRESHOLD))
    },
    { axis: 'x', filterTaps: true },
  )

  const openness = Math.min(1, Math.max(0, Math.abs(dx) / REVEAL_WIDTH))

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
          width: STRIP_TOTAL_PX,
        }}
        aria-hidden
      >
        <div
          className="h-full shrink-0 bg-secondary"
          style={{ width: STRIP_UNDERLAP_PX }}
          aria-hidden
        />
        <Button
          type="button"
          variant="secondary"
          size="iconTouch"
          className="pointer-events-auto h-full min-h-11 w-12 min-w-12 shrink-0 rounded-none border-0 px-0"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          aria-label="Modifier"
          data-testid={editButtonTestId}
        >
          <Pencil className="w-5 h-5" />
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="iconTouch"
          className="pointer-events-auto h-full min-h-11 w-12 min-w-12 shrink-0 rounded-none rounded-r-lg px-0"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
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
