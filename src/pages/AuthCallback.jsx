import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // 建立或更新 profile
        await supabase.from('profiles').upsert({
          id: session.user.id,
          display_name: session.user.user_metadata?.full_name ?? '',
          google_cal_token: session.provider_token ?? null,
        }, { onConflict: 'id' })

        navigate('/', { replace: true })
      }
    })
  }, [navigate])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', flexDirection: 'column', gap: 16 }}>
      <div className="spinner" />
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>登入中⋯</div>
    </div>
  )
}
