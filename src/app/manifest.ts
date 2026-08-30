import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zenith Habit Tracker',
    short_name: 'Zenith',
    description: 'High-speed, minimal personal habit tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#090A0F',
    theme_color: '#10B981',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
