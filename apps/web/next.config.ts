import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The workspace packages ship TypeScript source.
  transpilePackages: ['@copper/core', '@copper/db', '@copper/tracker', '@copper/ui'],
  // Off so screenshots and browser-driven checks see the page a user sees.
  devIndicators: false,
}

export default nextConfig
