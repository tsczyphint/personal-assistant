import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
)

// ── Auth helpers ──────────────────────────────────────────────
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets.readonly',
      redirectTo: `${import.meta.env.VITE_APP_URL}/auth/callback`,
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()
