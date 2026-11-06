import { describe, expect, it } from 'vitest'
import { parseTheme, themeScript } from '../src/lib/theme'

/** Runs the <head> script against a stored value and returns the `data-theme` it leaves on <html>. */
function runScript(stored: string | null | Error) {
  const dataset: Record<string, string> = {}
  const localStorage = {
    getItem: (key: string) => {
      if (stored instanceof Error) throw stored
      return key === 'copper-theme' ? stored : null
    },
  }
  new Function('localStorage', 'document', themeScript)(localStorage, {
    documentElement: { dataset },
  })
  return dataset.theme
}

describe('parseTheme', () => {
  it('keeps light and dark and reads anything else as system', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('system')).toBe('system')
    expect(parseTheme('sepia')).toBe('system')
    expect(parseTheme(null)).toBe('system')
    expect(parseTheme(undefined)).toBe('system')
  })
})

describe('themeScript', () => {
  it('applies a stored light or dark choice', () => {
    expect(runScript('dark')).toBe('dark')
    expect(runScript('light')).toBe('light')
  })

  it('leaves the system theme when nothing valid is stored or storage throws', () => {
    expect(runScript(null)).toBeUndefined()
    expect(runScript('sepia')).toBeUndefined()
    expect(runScript(new Error('blocked'))).toBeUndefined()
    expect(runScript('dark')).toBe('dark')
  })
})
