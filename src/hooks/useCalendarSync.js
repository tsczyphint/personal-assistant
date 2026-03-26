import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useCalendarSync() {
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(null)

  const syncFromGoogle = useCallback(async () => {
    setSyncing(true)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('google_cal_token')
        .single()

      if (!profile?.google_cal_token) throw new Error('尚未連結 Google 帳號')

      const { data: { user } } = await supabase.auth.getUser()

      // 拉取未來 30 天的事件
      const timeMin = new Date().toISOString()
      const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`,
        { headers: { Authorization: `Bearer ${profile.google_cal_token}` } }
      )

      if (!res.ok) throw new Error('Google Calendar API 錯誤')
      const { items = [] } = await res.json()

      // upsert（有 google_event_id 就更新，沒有就新增）
      const toUpsert = items
        .filter(item => item.status !== 'cancelled')
        .map(item => ({
          user_id: user.id,
          title: item.summary || '(無標題)',
          location: item.location ?? null,
          start_at: item.start?.dateTime ?? `${item.start?.date}T00:00:00+08:00`,
          end_at: item.end?.dateTime ?? `${item.end?.date}T23:59:59+08:00`,
          all_day: !item.start?.dateTime,
          source: 'google_cal',
          google_event_id: item.id,
          is_synced: true
        }))

      if (toUpsert.length > 0) {
        await supabase
          .from('events')
          .upsert(toUpsert, { onConflict: 'google_event_id', ignoreDuplicates: false })
      }

      setLastSynced(new Date())
      return { synced: toUpsert.length }
    } finally {
      setSyncing(false)
    }
  }, [])

  // 拉取本地事件列表
  const getEvents = useCallback(async ({ from, to } = {}) => {
    let query = supabase
      .from('events')
      .select('*')
      .order('start_at', { ascending: true })

    if (from) query = query.gte('start_at', from)
    if (to)   query = query.lte('start_at', to)

    const { data, error } = await query
    if (error) throw error
    return data
  }, [])

  return { syncing, lastSynced, syncFromGoogle, getEvents }
}
