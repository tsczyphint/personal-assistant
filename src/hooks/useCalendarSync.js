import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { startOfMonth, endOfMonth, addMonths } from 'date-fns'

export function useCalendarSync() {
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(null)

  const syncFromGoogle = useCallback(async () => {
    setSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const googleToken = session?.provider_token
      if (!googleToken) throw new Error('請重新登入以更新權限')

      const { data: { user } } = await supabase.auth.getUser()

      const timeMin = encodeURIComponent(startOfMonth(addMonths(new Date(), -1)).toISOString())
      const timeMax = encodeURIComponent(endOfMonth(addMonths(new Date(), 3)).toISOString())

      // 先抓所有日曆清單
      const calListRes = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        { headers: { Authorization: `Bearer ${googleToken}` } }
      )
      if (!calListRes.ok) throw new Error('無法取得日曆清單，請重新登入')
      const { items: calendars = [] } = await calListRes.json()

      // 逐一同步每個日曆的事件
      let allItems = []
      for (const cal of calendars) {
        
        try {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=500`,
            { headers: { Authorization: `Bearer ${googleToken}` } }
          )
          if (!res.ok) continue
          const { items = [] } = await res.json()
          allItems = allItems.concat(items.map(item => ({ ...item, calendarName: cal.summary })))
        } catch { continue }
      }

      const toUpsert = allItems
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

