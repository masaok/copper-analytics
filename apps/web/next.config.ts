import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The workspace packages ship TypeScript source.
  transpilePackages: ['@copper/core', '@copper/db', '@copper/tracker', '@copper/ui'],
  // Off so screenshots and browser-driven checks see the page a user sees.
  devIndicators: false,
  // Serves /_next under a path, e.g. /_app, when another dev server proxies this one. Without it the
  // proxy's own /_next answers this app's dev websocket, and its pages never hydrate.
  assetPrefix: process.env.COPPER_ASSET_PREFIX || undefined,
  // The Google pages and settings live under /dashboard with the rest of the sidebar.
  redirects: async () =>
    ['search-console', 'google-analytics', 'settings'].map((page) => ({
      source: `/${page}`,
      destination: `/dashboard/${page}`,
      permanent: true,
    })),
}

export default nextConfig
