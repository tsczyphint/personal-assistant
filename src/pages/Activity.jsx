import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, parseISO, startOfWeek, eachDayOfInterval, endOfWeek, isSameDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const TYPE_LABEL = { run: '跑步', ride: '騎車', swim: '游泳', walk: '步行' }
const TYPE_COLOR = { run: 'var(--accent)', ride: 'var(--teal)', swim: 'var(--amber)', walk: 'var(--text2)' }

export default function Activity() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('activities')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(30)
    setActivities(data ?? [])
    setLoading(false)
  }

  // 本週統計
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const weekActs = activities.filter(a => {
    const d = parseISO(a.recorded_at)
    return d >= weekStart && d <= weekEnd
  })

  const weeklyKm = weekActs.reduce((s, a) => s + (a.distance_km ?? 0), 0)
  const weeklyMin = Math.round(weekActs.reduce((s, a) => s + (a.duration_sec ?? 0), 0) / 60)
  const activeDays = new Set(weekActs.map(a => format(parseISO(a.recorded_at), 'yyyy-MM-dd'))).size

  // 每日距離（for bar chart）
  const maxKm = Math.max(...weekDays.map(day =>
    weekActs.filter(a => isSameDay(parseISO(a.recorded_at), day))
      .reduce((s, a) => s + (a.distance_km ?? 0), 0)
  ), 1)

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">運動紀錄</div>
        <div className="page-sub">Strava · Garmin 同步</div>
      </div>

      {/* Weekly stats */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">本週距離</div>
          <div className="metric-val">{weeklyKm.toFixed(1)}<span className="metric-unit"> km</span></div>
        </div>
        <div className="metric-card">
          <div className="metric-label">運動時間</div>
          <div className="metric-val">{weeklyMin}<span className="metric-unit"> 分</span></div>
        </div>
        <div className="metric-card">
          <div className="metric-label">活躍天數</div>
          <div className="metric-val">{activeDays}<span className="metric-unit"> / 7</span></div>
        </div>
        <div className="metric-card">
          <div className="metric-label">活動次數</div>
          <div className="metric-val">{weekActs.length}<span className="metric-unit"> 次</span></div>
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
          {weekDays.map(day => {
            const km = weekActs.filter(a => isSameDay(parseISO(a.recorded_at), day))
              .reduce((s, a) => s + (a.distance_km ?? 0), 0)
            const isToday = isSameDay(day, new Date())
            const pct = km / maxKm
            return (
              <div key={day.toISOString()} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%',
                  height: Math.max(pct * 48, km > 0 ? 6 : 2),
                  borderRadius: 3,
                  background: isToday ? 'var(--accent)' : km > 0 ? 'var(--teal)' : 'var(--border)',
                  transition: 'height 0.3s ease',
                  alignSelf: 'flex-end',
                }} />
                <span style={{ fontSize: 9, color: isToday ? 'var(--accent2)' : 'var(--text3)' }}>
                  {format(day, 'E', { locale: zhTW })}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Connect services CTA */}
      {activities.length === 0 && !loading && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(124,111,247,0.2)' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>連結運動平台</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            連結 Strava 或 Garmin 後，運動紀錄自動同步進來。
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ flex: 1, fontSize: 13 }}>連結 Strava</button>
            <button className="btn" style={{ flex: 1, fontSize: 13 }}>連結 Garmin</button>
          </div>
        </div>
      )}

      {/* Activity list */}
      <div className="section-label">最近活動</div>
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>}

      {activities.map(act => (
        <div key={act.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{act.title ?? TYPE_LABEL[act.activity_type] ?? '運動'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {format(parseISO(act.recorded_at), 'M/d EEEE HH:mm', { locale: zhTW })}
              </div>
            </div>
            <span className="pill" style={{
              background: `${TYPE_COLOR[act.activity_type]}22`,
              borderColor: `${TYPE_COLOR[act.activity_type]}44`,
              color: TYPE_COLOR[act.activity_type],
            }}>
              {TYPE_LABEL[act.activity_type] ?? act.activity_type}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {act.distance_km && <Stat label="距離" value={`${act.distance_km.toFixed(2)} km`} />}
            {act.duration_sec && <Stat label="時間" value={fmtDuration(act.duration_sec)} />}
            {act.avg_pace && <Stat label="配速" value={`${act.avg_pace.toFixed(2)} /km`} />}
            {act.avg_heart_rate && <Stat label="平均心率" value={`${act.avg_heart_rate} bpm`} />}
            {act.calories && <Stat label="卡路里" value={`${act.calories} kcal`} />}
            {act.elevation_m && <Stat label="爬升" value={`${act.elevation_m.toFixed(0)} m`} />}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
            來源：{act.source === 'strava' ? 'Strava' : act.source === 'garmin' ? 'Garmin' : '手動'}
          </div>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function fmtDuration(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} 分`
}
