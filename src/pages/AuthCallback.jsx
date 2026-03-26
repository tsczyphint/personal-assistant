import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await supabase.from('profiles').upsert({
          id: session.user.id,
          display_name: session.user.user_metadata?.full_name ?? '',
          google_cal_token: session.provider_token ?? null,
        }, { onConflict: 'id' })
        navigate('/', { replace: true })
      } else {
        setTimeout(() => {
          supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) {
              await supabase.from('profiles').upsert({
                id: session.user.id,
                display_name: session.user.user_metadata?.full_name ?? '',
                google_cal_token: session.provider_token ?? null,
              }, { onConflict: 'id' })
              navigate('/', { replace: true })
            } else {
              navigate('/login', { replace: true })
            }
          })
        }, 2000)
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
