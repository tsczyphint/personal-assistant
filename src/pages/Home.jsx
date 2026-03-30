import { useEffect, useState } from 'react'
import { useCalendarSync } from '@/hooks/useCalendarSync'
import { supabase, signOut } from '@/lib/supabase'
import { format, isToday, isTomorrow, parseISO, startOfDay, endOfDay, addDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'

export default function Home() {
  const { syncFromGoogle, getEvents } = useCalendarSync()
  const [events, setEvents] = useState([])
  const [activities, setActivities] = useState([])
  const [profile, setProfile] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [completing, setCompleting] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    const today = new Date()
    const todayEvents = await getEvents({
      from: startOfDay(today).toISOString(),
      to: endOfDay(addDays(today, 1)).toISOString()
    })
    setEvents(todayEvents ?? [])
    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(3)
    setActivities(acts ?? [])
  }

  async function handleSync() {
    setSyncing(true)
    try { await syncFromGoogle(); await loadData() }
    catch (e) { console.error(e) }
    finally { setSyncing(false) }
  }

  async function handleToggleComplete(ev) {
    setCompleting(ev.id)
    const newCompleted = !ev.completed
    try {
      const { error } = await supabase
        .from('events')
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        })
        .eq('id', ev.id)

      if (!error) {
        setEvents(prev =>
          prev.map(e =>
            e.id === ev.id
              ? { ...e, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
              : e
          )
        )
      }
    } finally {
      setCompleting(null)
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安'
  const name = profile?.display_name?.split(' ')[0] ?? ''
  const todayEvents = events.filter(e => isToday(parseISO(e.start_at)))
  const tomorrowEvents = events.filter(e => isTomorrow(parseISO(e.start_at)))
  const weeklyKm = activities.reduce((s, a) => s + (a.distance_km ?? 0), 0)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 20px' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 500 }}>{greeting}{name ? `，${name}` : ''}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
              {format(new Date(), 'M 月 d 日 EEEE', { locale: zhTW })}
            </div>
          </div>
          <button onClick={handleSync} className="btn ghost" style={{ padding: '8px 12px', fontSize: 12, gap: 5 }} disabled={syncing}>
            {syncing ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} /> : <SyncIcon />}
            同步
          </button>
        </div>

        {/* Activity summary */}
        {activities.length > 0 && (
          <>
            <div className="section-label">本週運動</div>
            <div className="metric-grid" style={{ marginBottom: 16 }}>
              <div className="metric-card">
                <div className="metric-label">累積距離</div>
                <div className="metric-val">{weeklyKm.toFixed(1)}<span className="metric-unit"> km</span></div>
              </div>
              <div className="metric-card">
                <div className="metric-label">最近活動</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginTop: 4 }}>
                  {activities[0]?.activity_type === 'Run' ? '跑步' :
                   activities[0]?.activity_type === 'Ride' ? '騎車' : '運動'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  {activities[0] && format(new Date(activities[0].recorded_at), 'M/d')}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Today events */}
        <div className="section-label">今日行程</div>
        {todayEvents.length === 0
          ? <EmptyState text="今天沒有行程" sub="按語音頁快速新增" />
          : (
            <div className="card" style={{ marginBottom: 12 }}>
              {todayEvents.map((ev, i) => (
                <EventRow
                  key={ev.id} event={ev} last={i === todayEvents.length - 1}
                  completing={completing} onToggleComplete={handleToggleComplete}
                />
              ))}
            </div>
          )
        }

        {/* Tomorrow events */}
        {tomorrowEvents.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 8 }}>明日行程</div>
            <div className="card" style={{ marginBottom: 12 }}>
              {tomorrowEvents.map((ev, i) => (
                <EventRow
                  key={ev.id} event={ev} last={i === tomorrowEvents.length - 1} muted
                  completing={completing} onToggleComplete={handleToggleComplete}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 登出按鈕置底 */}
      <div style={{ paddingTop: 16, paddingBottom: 8 }}>
        <button className="btn ghost" onClick={signOut}
          style={{ width: '100%', fontSize: 13, color: 'var(--text3)' }}>
          登出
        </button>
      </div>
    </div>
  )
}

function EventRow({ event, last, muted, completing, onToggleComplete }) {
  const color = event.source === 'voice' ? 'var(--accent)' :
                event.source === 'google_cal' ? 'var(--teal)' : 'var(--text3)'
  const isCompleting = completing === event.id

  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'flex-start',
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      opacity: event.completed ? 0.55 : muted ? 0.65 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ width: 3, height: 36, borderRadius: 2, background: color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: 'var(--text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textDecoration: event.completed ? 'line-through' : 'none',
        }}>
          {event.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
          {event.all_day ? '全天' : format(parseISO(event.start_at), 'HH:mm')}
          {event.location && ` · ${event.location}`}
        </div>
        {event.completed && event.completed_at && (
          <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 2 }}>
            ✓ 完成於 {format(parseISO(event.completed_at), 'HH:mm')}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 2 }}>
          {event.source === 'voice' ? '語音' : event.source === 'google_cal' ? 'Google' : '手動'}
        </div>
        <button
          onClick={() => onToggleComplete(event)}
          disabled={isCompleting}
          style={{
            border: event.completed ? '1.5px solid var(--teal)' : '1.5px solid var(--border)',
            borderRadius: 6,
            background: event.completed ? 'rgba(32,178,140,0.12)' : 'transparent',
            color: event.completed ? 'var(--teal)' : 'var(--text3)',
            fontSize: 11,
            padding: '3px 8px',
            cursor: isCompleting ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
            minWidth: 52,
          }}
        >
          {isCompleting ? '...' : event.completed ? '✓ 完成' : '確認完成'}
        </button>
      </div>
    </div>
  )
}

function EmptyState({ text, sub }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 12 }}>
      <div style={{ fontSize: 14, color: 'var(--text2)' }}>{text}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SyncIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
}

