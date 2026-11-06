'use client'

import { useSyncExternalStore } from 'react'
import { parseTheme, type Theme, themeKey, themes } from '@/lib/theme'

const changeEvent = 'copper-theme-change'

function apply(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  window.dispatchEvent(new Event(changeEvent))
}

/** Follows this tab's clicks and, through `storage`, a choice made in another tab. */
function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === themeKey || event.key === null) apply(parseTheme(event.newValue))
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(changeEvent, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(changeEvent, onChange)
  }
}

function setTheme(theme: Theme) {
  try {
    if (theme === 'system') localStorage.removeItem(themeKey)
    else localStorage.setItem(themeKey, theme)
  } catch {}
  apply(theme)
}

const icon = {
  system: (
    <>
      <rect x="2" y="3" width="12" height="8.5" rx="1.5" />
      <path d="M5.5 14h5M8 11.5V14" />
    </>
  ),
  light: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" />
    </>
  ),
  dark: <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />,
} satisfies Record<Theme, React.ReactNode>

const label = { system: 'System', light: 'Light', dark: 'Dark' } satisfies Record<Theme, string>

/** System, light or dark, remembered in this browser. The page reads it from `data-theme` on <html>. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const current = useSyncExternalStore(
    subscribe,
    () => parseTheme(document.documentElement.dataset.theme),
    () => 'system' as const,
  )
  return (
    <fieldset
      aria-label="Theme"
      className={`inline-flex gap-0.5 rounded-md border border-line bg-bg p-0.5 ${className}`}
    >
      {themes.map((theme) => {
        const active = theme === current
        return (
          <button
            key={theme}
            type="button"
            aria-pressed={active}
            aria-label={`${label[theme]} theme`}
            title={`${label[theme]} theme`}
            onClick={() => setTheme(theme)}
            className={`flex size-6 cursor-pointer items-center justify-center rounded ${
              active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {icon[theme]}
            </svg>
          </button>
        )
      })}
    </fieldset>
  )
}
