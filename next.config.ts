import type { NextConfig } from 'next'

const IMMUTABLE = 'public, max-age=31536000, immutable'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/fonts/:file*',
        headers: [{ key: 'Cache-Control', value: IMMUTABLE }],
      },
      {
        // Not content-hashed, so not immutable: a week, then serve stale while
        // revalidating in the background. Swapping an image under the same name
        // becomes visible within a week instead of a year.
        source: '/images/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
    ]
  },
}

export default nextConfig
