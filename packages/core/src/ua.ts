export interface UserAgentInfo {
  device: 'desktop' | 'mobile' | 'tablet'
  browser: string
  os: string
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
]

const first = (table: [RegExp, string][], ua: string): string =>
  table.find(([re]) => re.test(ua))?.[1] ?? 'Other'

/** Coarse device, browser and OS. Enough for a breakdown panel, small enough for a Worker. */
export function parseUserAgent(ua: string, screenWidth?: number): UserAgentInfo {
  let device: UserAgentInfo['device'] = 'desktop'
  if (/iPad|Tablet|(Android(?!.*Mobile))/.test(ua)) device = 'tablet'
  else if (/Mobi|iPhone|iPod|Android/.test(ua)) device = 'mobile'
  else if (screenWidth !== undefined && screenWidth > 0 && screenWidth < 600) device = 'mobile'
  return { device, browser: first(BROWSERS, ua), os: first(SYSTEMS, ua) }
}
