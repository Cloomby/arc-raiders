import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Discord CDN for user avatars
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
    ],
  },
}

export default nextConfig
