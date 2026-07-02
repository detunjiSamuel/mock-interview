/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const apiBase = process.env.INTERNAL_API_URL ?? 'http://main-api:8000'
    return [
      {
        source: '/backend/:path*',
        destination: `${apiBase}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
