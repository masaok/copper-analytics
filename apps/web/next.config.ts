import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The workspace packages ship TypeScript source.
  transpilePackages: ['@copper/core', '@copper/db', '@copper/tracker', '@copper/ui'],
  // Off so screenshots and browser-driven checks see the page a user sees.
  devIndicators: false,
  // The Google pages moved under /dashboard with the rest of the sidebar.
  redirects: async () =>
    ['search-console', 'google-analytics'].map((page) => ({
      source: `/${page}`,
      destination: `/dashboard/${page}`,
      permanent: true,
    })),
}

export default nextConfig
