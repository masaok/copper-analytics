/** What the user picked. `system` is stored as no value and follows the operating system. */
export const themes = ['system', 'light', 'dark'] as const
export type Theme = (typeof themes)[number]

export const themeKey = 'copper-theme'

export function parseTheme(value: string | null | undefined): Theme {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/**
 * Runs in <head> before the first paint, so a stored choice never flashes the other theme.
 * It writes only `data-theme` on <html>; the server renders none, which is `system`.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(themeKey)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`
