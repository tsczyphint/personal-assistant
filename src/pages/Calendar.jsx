import { useEffect, useState } from 'react'
import { useCalendarSync } from '@/hooks/useCalendarSync'
import { format, parseISO, isToday, isTomorrow, startOfDay, addDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const SOURCE_COLORS = {
  voice:      'var(--accent)',
  google_cal: 'var(--teal)',
  manual:     'var(--text3)',
}

export default function Calendar() {
  const { syncFromGoogle, getEvents, syncing } = useCalendarSync()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all | voice | google_cal

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getEvents({
        from: startOfDay(new Date()).toISOString(),
        to: addDays(new Date(), 30).toISOString(),
      })
      setEvents(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    await syncFromGoogle()
    await load()
  }

  const filtered = filter === 'all' ? events : events.filter(e => e.source === filter)

  // 依日期分組
  const grouped = filtered.reduce((acc, ev) => {
    const day = format(parseISO(ev.start_at), 'yyyy-MM-dd')
    if (!acc[day]) acc[day] = []
    acc[day].push(ev)
    return acc
  }, {})

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">行事曆</div>
          <button className="btn ghost" onClick={handleSync} disabled={syncing}
            style={{ padding: '7px 12px', fontSize: 12 }}>
            {syncing ? <span className="spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} /> : '同步 Google'}
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['all', '全部'], ['voice', '語音建立'], ['google_cal', 'Google']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className="pill"
            style={{
              cursor: 'pointer', border: 'none',
              background: filter === val ? 'rgba(124,111,247,0.15)' : 'var(--bg2)',
              borderColor: filter === val ? 'rgba(124,111,247,0.35)' : 'var(--border)',
              color: filter === val ? 'var(--accent2)' : 'var(--text2)',
              padding: '5px 12px',
            }}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>未來 30 天沒有行程</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>可以同步 Google Calendar 或語音新增</div>
        </div>
      )}

      {Object.entries(grouped).map(([day, dayEvents]) => {
        const date = parseISO(day)
        const label = isToday(date) ? '今天' : isTomorrow(date) ? '明天' : format(date, 'M/d EEEE', { locale: zhTW })
        return (
          <div key={day} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginBottom: 8 }}>
              {label}
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {dayEvents.map((ev, i) => (
                <div key={ev.id} style={{
                  display: 'flex', gap: 14, alignItems: 'stretch',
                  padding: '12px 16px',
                  borderBottom: i < dayEvents.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ width: 2, borderRadius: 2, background: SOURCE_COLORS[ev.source] ?? 'var(--text3)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{ev.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{ev.all_day ? '全天' : format(parseISO(ev.start_at), 'HH:mm')}</span>
                      {ev.location && <span>· {ev.location}</span>}
                      {ev.reminder_minutes && !ev.all_day && (
                        <span style={{ color: 'var(--text3)' }}>· 提醒 {ev.reminder_minutes} 分前</span>
                      )}
                    </div>
                    {ev.raw_voice_text && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>
                        「{ev.raw_voice_text}」
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0, paddingTop: 2 }}>
                    {ev.source === 'voice' ? '語音' : ev.source === 'google_cal' ? 'Google' : '手動'}
                    {ev.is_synced && <span style={{ color: 'var(--teal)', marginLeft: 4 }}>✓</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
