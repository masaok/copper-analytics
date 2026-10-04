# @copper-analytics/next

```tsx
// app/layout.tsx
import { CopperAnalytics } from '@copper-analytics/next'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CopperAnalytics siteKey="k3x9q2m7ab" />
      </body>
    </html>
  )
}
```

| Prop | Default | Use |
| --- | --- | --- |
| `siteKey` | required | The key from the project's settings page |
| `host` | `https://app.copperanalytics.com` | Your own dashboard's URL when self-hosting |
| `api` | the dashboard's ingest endpoint | A same-origin path you rewrite to the ingest endpoint |
| `dev` | `false` | Count pageviews on localhost |
