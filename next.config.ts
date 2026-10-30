import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Илова кардани конфиги холии turbopack барои бартараф кардани хатогӣ
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'hasi.tj' },
      { protocol: 'http', hostname: 'hasi.tj' },
      { protocol: 'https', hostname: '**.hasi.tj' },
      { protocol: 'http', hostname: '**.hasi.tj' },
      // Unsplash (fallback для product-image onError)
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'http', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;