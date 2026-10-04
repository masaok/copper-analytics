import Script from 'next/script'

export interface CopperAnalyticsProps {
  /** The project's 10-character site key, from its settings page. */
  siteKey: string
  /** Where your Copper dashboard runs. Defaults to the hosted service. */
  host?: string
  /** Send pageviews to this URL instead, for example a same-origin rewrite that ad blockers do not list. */
  api?: string
  /** Count pageviews on localhost too. Off by default. */
  dev?: boolean
}

export const DEFAULT_HOST = 'https://app.copperanalytics.com'

/** The attributes the tracker reads from its script tag. */
export function trackerAttributes({
  siteKey,
  host = DEFAULT_HOST,
  api,
  dev,
}: CopperAnalyticsProps) {
  return {
    src: `${host.replace(/\/$/, '')}/c.js`,
    'data-site': siteKey,
    ...(api ? { 'data-api': api } : {}),
    ...(dev ? { 'data-dev': '' } : {}),
  }
}

/** Add once, in the root layout. Client-side navigation is counted by the tracker itself. */
export function CopperAnalytics(props: CopperAnalyticsProps) {
  return <Script {...trackerAttributes(props)} strategy="afterInteractive" />
}
