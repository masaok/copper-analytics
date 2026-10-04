import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Shell } from '@/components/shell'
import { currentUser } from '@/lib/auth'
import { env } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Docs',
  description:
    'Install the Copper tracker, proxy it through your own domain and read your stats from the API.',
}

const REPO = 'https://github.com/masaok/copper-analytics'

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed">
      <code>{children}</code>
    </pre>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3 border-t border-line pt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

const SECTIONS = [
  ['install', 'Install the tracker'],
  ['frameworks', 'Next.js and Astro'],
  ['proxy', 'Serve it from your own domain'],
  ['opt-out', 'Opting out'],
  ['counted', 'What is counted'],
  ['api', 'Stats API'],
  ['self-hosting', 'Self-hosting'],
] as const

export default async function Docs() {
  const user = await currentUser()
  const host = env().BETTER_AUTH_URL
  return (
    <Shell user={user}>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 text-[15px] leading-relaxed">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Docs</h1>
          <p className="text-muted">
            Copper counts pageviews without cookies. One script tag per site, one dashboard for all
            of them.
          </p>
          <nav aria-label="On this page" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {SECTIONS.map(([id, title]) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-copper underline-offset-4 hover:underline"
              >
                {title}
              </a>
            ))}
          </nav>
        </div>

        <Section id="install" title="Install the tracker">
          <p>
            Create a project, then paste its snippet into the <code>&lt;head&gt;</code> of every
            page. The site key is on the project's settings page.
          </p>
          <Code>{`<script defer src="${host}/c.js" data-site="YOUR_SITE_KEY"></script>`}</Code>
          <p>
            The script is under 1.5 KB gzipped. It sends one request per pageview and follows
            client-side navigation in single-page apps on its own.
          </p>
        </Section>

        <Section id="frameworks" title="Next.js and Astro">
          <p>
            In Next.js, add the component once in the root layout. It comes from the{' '}
            <code>@copper-analytics/next</code> package.
          </p>
          <Code>{`import { CopperAnalytics } from '@copper-analytics/next'

// app/layout.tsx, inside <body>
<CopperAnalytics siteKey="YOUR_SITE_KEY" host="${host}" />`}</Code>
          <p>In Astro, put the tag in a layout's head and keep it inline:</p>
          <Code>{`<script is:inline defer src="${host}/c.js" data-site="YOUR_SITE_KEY"></script>`}</Code>
        </Section>

        <Section id="proxy" title="Serve it from your own domain">
          <p>
            Ad blockers may list any domain that contains the word analytics. Two rewrites on your
            own site avoid that. In <code>next.config.ts</code>:
          </p>
          <Code>{`async rewrites() {
  return [
    { source: '/stats/c.js', destination: '${host}/c.js' },
    { source: '/stats/e', destination: '${host}/api/e' },
  ]
}`}</Code>
          <p>Then load the script from your own path and point it at your own endpoint:</p>
          <Code>{`<script defer src="/stats/c.js" data-site="YOUR_SITE_KEY" data-api="/stats/e"></script>`}</Code>
        </Section>

        <Section id="opt-out" title="Opting out">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              A visitor who runs <code>localStorage.setItem('copper_ignore', '1')</code> in the
              browser console is no longer counted on that site.
            </li>
            <li>
              A page that contains an element with a <code>data-copper-ignore</code> attribute is
              not counted.
            </li>
            <li>
              Pages on <code>localhost</code> and <code>file:</code> pages are not counted, unless
              the script tag has <code>data-dev</code>.
            </li>
          </ul>
        </Section>

        <Section id="counted" title="What is counted">
          <p>
            Visitors, pageviews, visits, bounce rate, top pages, referrer domains, countries,
            devices, browsers, operating systems and UTM sources.
          </p>
          <p>
            A visitor is a hash of a random daily salt, the site key, the IP address and the
            browser's user agent. Only the hash is kept, and the salt is replaced at midnight UTC,
            so a visitor cannot be followed from one day to the next. For the same reason, visitors
            over several days are the sum of each day's unique visitors.
          </p>
          <p>
            No cookie is set, nothing is written to the browser's storage, and no IP address or full
            URL is stored.
          </p>
        </Section>

        <Section id="api" title="Stats API">
          <p>
            Create a token on a project's settings page. It is read-only and works for that project
            alone.
          </p>
          <Code>{`curl -H "Authorization: Bearer <token>" \\
  "${host}/api/v1/stats?site=YOUR_SITE_KEY&range=7d"`}</Code>
          <p>
            <code>range</code> is one of <code>today</code>, <code>24h</code>, <code>7d</code>,{' '}
            <code>30d</code>, <code>12mo</code> or <code>custom</code>. With <code>custom</code>,
            add <code>from</code> and <code>to</code> as <code>YYYY-MM-DD</code>. The response has{' '}
            <code>totals</code>, <code>previous</code> and a <code>series</code> array.
          </p>
        </Section>

        <Section id="self-hosting" title="Self-hosting">
          <p>
            Copper is open source. One command starts a dashboard with a demo account and sample
            data:
          </p>
          <Code>{`git clone ${REPO}.git
cd copper-analytics
docker compose up`}</Code>
          <p>
            The{' '}
            <Link
              href={`${REPO}/blob/main/docs/SELF_HOSTING.md`}
              className="text-copper underline underline-offset-4"
            >
              self-hosting guide
            </Link>{' '}
            covers configuration and the Cloudflare-based mode for hundreds of sites.
          </p>
        </Section>
      </div>
    </Shell>
  )
}
