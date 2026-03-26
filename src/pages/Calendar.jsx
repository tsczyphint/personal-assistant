import { useEffect, useState } from 'react'
import { useCalendarSync } from '@/hooks/useCalendarSync'
import { format, parseISO, isToday, isTomorrow, startOfMonth, endOfMonth, addMonths, isSameMonth } from 'date-fns'
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
  const [filter, setFilter] = useState('all')
  const [monthOffset, setMonthOffset] = useState(0)
  const [syncMsg, setSyncMsg] = useState(null)

  const currentMonth = addMonths(new Date(), monthOffset)

  useEffect(() => { load() }, [monthOffset])

  async function load() {
    setLoading(true)
    try {
      const from = startOfMonth(currentMonth).toISOString()
      const to = endOfMonth(currentMonth).toISOString()
      const data = await getEvents({ from, to })
      setEvents(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncMsg(null)
    try {
      const result = await syncFromGoogle()
      setSyncMsg(`同步完成，共 ${result.synced} 筆`)
      await load()
    } catch (e) {
      setSyncMsg(e.message)
    }
    setTimeout(() => setSyncMsg(null), 4000)
  }

  const filtered = filter === 'all' ? events : events.filter(e => e.source === filter)

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
        {syncMsg && (
          <div style={{ fontSize: 12, color: syncMsg.includes('完成') ? 'var(--teal)' : 'var(--coral)', marginTop: 6 }}>
            {syncMsg}
          </div>
        )}
      </div>

      {/* 月份切換 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button className="btn ghost" onClick={() => setMonthOffset(m => m - 1)}
          style={{ padding: '6px 12px', fontSize: 18 }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {format(currentMonth, 'yyyy 年 M 月', { locale: zhTW })}
        </div>
        <button className="btn ghost" onClick={() => setMonthOffset(m => m + 1)}
          style={{ padding: '6px 12px', fontSize: 18 }}>›</button>
      </div>

      {monthOffset !== 0 && (
        <button className="btn ghost" onClick={() => setMonthOffset(0)}
          style={{ width: '100%', fontSize: 12, marginBottom: 12, color: 'var(--text2)' }}>
          回到本月
        </button>
      )}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['all', '全部'], ['voice', '語音建立'], ['google_cal', 'Google']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className="pill"
            style={{
              cursor: 'pointer', border: 'none',
              background: filter === val ? 'rgba(124,111,247,0.15)' : 'var(--color-background-secondary)',
              borderColor: filter === val ? 'rgba(124,111,247,0.35)' : 'var(--color-border-tertiary)',
              color: filter === val ? 'var(--accent2)' : 'var(--color-text-secondary)',
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
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>
            {format(currentMonth, 'M 月', { locale: zhTW })} 沒有行程
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            點「同步 Google」拉取最新資料
          </div>
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
