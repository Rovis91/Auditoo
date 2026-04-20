import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

/** Shared surface for inspection list items and inspection detail level/space rows. */
export const entityCardClassName =
  'rounded-lg border border-border bg-card shadow-xs'

export type EntityCardProps = ComponentPropsWithoutRef<'div'>

export const EntityCard = forwardRef<HTMLDivElement, EntityCardProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(entityCardClassName, className)} {...props} />
  ),
)
EntityCard.displayName = 'EntityCard'
