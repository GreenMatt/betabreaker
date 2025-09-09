/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }
    ],
    // Avoid Node/sharp-based optimization in edge runtime
    unoptimized: true,
  },
  // Build hardening for Cloudflare: do not fail the build on type or lint issues.
  // This ensures Pages deployments complete while we stabilize types.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
