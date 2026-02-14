import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* This ensures that if you use images for markers, 
     Next.js knows where they are coming from */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdnjs.cloudflare.com',
      },
    ],
  },
  // If you experience issues with "window is not defined" during build
  // adding this can help with some problematic Leaflet plugins
  transpilePackages: ['leaflet', 'react-leaflet', 'leaflet-routing-machine'],
};

export default nextConfig;