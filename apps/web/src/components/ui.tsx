import type { ComponentProps, ReactNode } from 'react'

const BUTTON = {
  primary: 'bg-copper text-bg hover:opacity-90',
  quiet: 'border border-line bg-bg text-ink hover:bg-surface',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
} as const

export const buttonClass = (variant: keyof typeof BUTTON = 'primary') =>
  `inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md px-3.5 text-sm font-medium transition-opacity disabled:cursor-default disabled:opacity-50 ${BUTTON[variant]}`

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof BUTTON }) {
  return <button {...props} className={`${buttonClass(variant)} ${className}`} />
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={htmlFor} className="font-medium">
        {label}
      </label>
      {children}
      {hint ? <span className="text-muted">{hint}</span> : null}
    </div>
  )
}

export const inputClass =
  'w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted'

/** Same drawing as src/app/icon.svg, the favicon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="7" fill="#a8521f" />
      <path
        d="M22.2 9.8A8.6 8.6 0 1 0 22.2 22.2"
        fill="none"
        stroke="#fff"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <circle cx="23" cy="16" r="2.4" fill="#7fd6bf" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <LogoMark className="size-6" />
      Copper
    </span>
  )
}
