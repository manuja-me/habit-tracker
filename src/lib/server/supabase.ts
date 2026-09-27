import { createClient } from '@supabase/supabase-js';

// Server-side private credentials
export function getCleanSupabaseConfig() {
  let url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '');
  let key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '');

  if (!url || !key) return null;

  // Handle accidental dashboard URL paste like https://supabase.com/dashboard/project/abcdefghijklmnop
  const dashboardMatch = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    url = `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Remove any trailing slashes and subpaths like /rest/v1 that cause PostgREST "Invalid path" error
  url = url.replace(/\/+$/, '');
  if (url.includes('/rest/v1')) {
    url = url.replace(/\/rest\/v1.*$/, '');
  }

  if (!url.startsWith('https://') || url.includes('your-project-url')) {
    return null;
  }

  return { url, key };
}

export function getServerSupabase() {
  try {
    const config = getCleanSupabaseConfig();
    if (!config) return null;
    return createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}
