import { createBrowserClient } from '@supabase/ssr'

// 1. Define a variable to hold the instance
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  // 2. If an instance already exists, return it
  if (client) return client;

  // 3. Otherwise, create it once and store it
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}