import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zenith Habit Tracker',
    short_name: 'Zenith',
    description: 'High-speed, minimal personal habit tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#1D2021',
    theme_color: '#FE8019',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
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
