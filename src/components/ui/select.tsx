'use client'

// shadcn's Select, on Radix, restyled onto this page's tokens (card / line /
// ink / accent) instead of shadcn's default zinc palette. The trigger
// deliberately mirrors `inputCls` in ApplyForm so it sits flush with the text
// inputs beside it.
//
// Radix earns its place here: keyboard navigation, typeahead, focus return on
// close and the ARIA listbox wiring are all things a hand-rolled div would
// have to reimplement.

import * as SelectPrimitive from '@radix-ui/react-select'
import { CheckIcon, ChevronDown, ChevronUp } from '../icons'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

function SelectTrigger({
  className,
  children,
  invalid,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & { invalid?: boolean }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'tfade flex h-12 w-full items-center justify-between gap-2 rounded-xl border bg-transparent px-4',
        // The trigger keeps the page's global focus outline, exactly like the
        // text inputs beside it — matching `inputCls` in ApplyForm.
        'text-left text-[15.5px] text-ink focus:outline-none',
        'focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
        // Radix renders the placeholder inside a span it owns, so target it
        // rather than using ::placeholder (which only exists on real inputs).
        'data-[placeholder]:text-ink-faint',
        '[&>span]:truncate',
        invalid
          ? 'border-err focus:border-err focus:ring-err/25'
          : 'border-line-strong focus:border-accent focus:ring-accent/25',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn('flex cursor-default items-center justify-center py-1 text-ink-faint', className)}
      {...props}
    >
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn('flex cursor-default items-center justify-center py-1 text-ink-faint', className)}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={6}
        className={cn(
          // `select-panel` carries the open/close keyframes from globals.css.
          'select-panel relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-xl',
          'border border-line bg-card text-ink shadow-2xl shadow-black/40',
          position === 'popper' && 'w-[var(--radix-select-trigger-width)]',
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn('px-3 py-1.5 text-[13px] font-medium text-ink-faint', className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg py-2.5 pl-3 pr-9',
        'text-[15px] leading-snug text-ink-soft transition-colors',
        // Suppresses only the browser's default focus ring. The page's own
        // accent outline is unlayered in globals.css and beats every Tailwind
        // utility regardless of specificity, so it's excluded there instead —
        // by the data-slot above. Both are needed; neither covers the other.
        'focus-visible:outline-none',
        // One rule covers hover and arrow-key navigation — Radix sets
        // data-highlighted for both.
        'data-[highlighted]:bg-accent/15 data-[highlighted]:text-ink',
        'data-[state=checked]:text-ink',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-3 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="h-4 w-4 text-accent" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn('my-1 h-px bg-line', className)} {...props} />
}

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
