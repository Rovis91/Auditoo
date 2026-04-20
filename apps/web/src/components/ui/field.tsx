import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="field-group" className={cn('flex flex-col gap-6', className)} {...props} />
  )
}

function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="field" className={cn('flex flex-col gap-2', className)} {...props} />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" className={className} {...props} />
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      className={cn('relative flex items-center gap-4 py-2', className)}
      {...props}
    >
      <div className="h-px flex-1 bg-border" aria-hidden />
      {children != null && children !== '' && (
        <span
          data-slot="field-separator-content"
          className="bg-card px-2 text-xs text-muted-foreground whitespace-nowrap"
        >
          {children}
        </span>
      )}
      <div className="h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}

export { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator }
