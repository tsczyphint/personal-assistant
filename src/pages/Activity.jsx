import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, parseISO, startOfWeek, eachDayOfInterval, endOfWeek, isSameDay } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const SHEETS_ID = '1NWtpGIYWgAGMSZl8uhPavpW4VozNTg_fXIuYXIU36Sc'
const TYPE_LABEL = { Run: '跑步', Ride: '騎車', Swim: '游泳', Walk: '步行', VirtualRide: '虛擬騎車', TrailRun: '越野跑' }
const TYPE_COLOR = { Run: 'var(--accent)', Ride: 'var(--teal)', Swim: 'var(--amber)', Walk: 'var(--text2)' }

async function fetchStravaFromSheets(googleToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/工作表1?majorDimension=ROWS`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${googleToken}` } })
  if (!res.ok) throw new Error('無法讀取 Google Sheets')
  const data = await res.json()
  const rows = data.values ?? []
  if (rows.length < 2) return []
  const headers = rows[0]
  return rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return {
      id: obj.id,
      title: obj.name,
      activity_type: obj.type,
      distance_km: parseFloat(obj.distance_km) || 0,
      duration_sec: parseInt(obj.duration_sec) || 0,
      avg_pace: parseFloat(obj.avg_pace) || 0,
      avg_heart_rate: parseFloat(obj.avg_heart_rate) || 0,
      calories: parseInt(obj.calories) || 0,
      elevation_m: parseFloat(obj.elevation_m) || 0,
      recorded_at: obj.recorded_at,
      source: 'strava'
    }
  }).filter(a => a.recorded_at)
}

export default function Activity() {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const googleToken = session?.provider_token
      if (googleToken) {
        const sheetsData = await fetchStravaFromSheets(googleToken)
        if (sheetsData.length > 0) {
          sheetsData.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
          setActivities(sheetsData)
          setLoading(false)
          return
        }
      }
      const { data } = await supabase.from('activities').select('*').order('recorded_at', { ascending: false }).limit(30)
      setActivities(data ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const weekActs = activities.filter(a => {
    if (!a.recorded_at) return false
    try { const d = new Date(a.recorded_at); return d >= weekStart && d <= weekEnd } catch { return false }
  })
  const weeklyKm = weekActs.reduce((s, a) => s + (a.distance_km ?? 0), 0)
  const weeklyMin = Math.round(weekActs.reduce((s, a) => s + (a.duration_sec ?? 0), 0) / 60)
  const activeDays = new Set(weekActs.map(a => format(new Date(a.recorded_at), 'yyyy-MM-dd'))).size
  const maxKm = Math.max(...weekDays.map(day =>
    weekActs.filter(a => { try { return isSameDay(new Date(a.recorded_at), day) } catch { return false } })
      .reduce((s, a) => s + (a.distance_km ?? 0), 0)
  ), 1)

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div className="page-title">運動紀錄</div><div className="page-sub">Strava 自動同步</div></div>
          <button className="btn ghost" onClick={load} style={{ padding: '7px 12px', fontSize: 12 }}>重新整理</button>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card"><div className="metric-label">本週距離</div><div className="metric-val">{weeklyKm.toFixed(1)}<span className="metric-unit"> km</span></div></div>
        <div className="metric-card"><div className="metric-label">運動時間</div><div className="metric-val">{weeklyMin}<span className="metric-unit"> 分</span></div></div>
        <div className="metric-card"><div className="metric-label">活躍天數</div><div className="metric-val">{activeDays}<span className="metric-unit"> / 7</span></div></div>
        <div className="metric-card"><div className="metric-label">活動次數</div><div className="metric-val">{weekActs.length}<span className="metric-unit"> 次</span></div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
          {weekDays.map(day => {
            const km = weekActs.filter(a => { try { return isSameDay(new Date(a.recorded_at), day) } catch { return false } }).reduce((s, a) => s + (a.distance_km ?? 0), 0)
            const isToday = isSameDay(day, new Date())
            return (
              <div key={day.toISOString()} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: Math.max((km / maxKm) * 48, km > 0 ? 6 : 2), borderRadius: 3, background: isToday ? 'var(--accent)' : km > 0 ? 'var(--teal)' : 'var(--border)', alignSelf: 'flex-end' }} />
                <span style={{ fontSize: 9, color: isToday ? 'var(--accent2)' : 'var(--text3)' }}>{format(day, 'E', { locale: zhTW })}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="section-label">最近活動</div>
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>}
      {error && <div className="card" style={{ borderColor: 'rgba(224,90,58,0.25)', marginBottom: 10 }}><div style={{ fontSize: 13, color: 'var(--coral)' }}>{error}</div><button className="btn" onClick={load} style={{ marginTop: 8, fontSize: 12 }}>重試</button></div>}
      {!loading && activities.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>還沒有運動紀錄</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>完成一次 Strava 活動後自動同步進來</div>
        </div>
      )}

      {activities.map(act => (
        <div key={act.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{act.title ?? TYPE_LABEL[act.activity_type] ?? '運動'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {act.recorded_at ? (() => { try { return format(new Date(act.recorded_at), 'M/d EEEE HH:mm', { locale: zhTW }) } catch { return act.recorded_at } })() : ''}
              </div>
            </div>
            <span className="pill" style={{ background: `${TYPE_COLOR[act.activity_type] ?? 'var(--text2)'}22`, borderColor: `${TYPE_COLOR[act.activity_type] ?? 'var(--text2)'}44`, color: TYPE_COLOR[act.activity_type] ?? 'var(--text2)' }}>
              {TYPE_LABEL[act.activity_type] ?? act.activity_type}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {act.distance_km > 0 && <Stat label="距離" value={`${act.distance_km.toFixed(2)} km`} />}
            {act.duration_sec > 0 && <Stat label="時間" value={fmtDuration(act.duration_sec)} />}
            {act.avg_pace > 0 && <Stat label="均速" value={`${act.avg_pace.toFixed(1)} kph`} />}
            {act.avg_heart_rate > 0 && <Stat label="平均心率" value={`${Math.round(act.avg_heart_rate)} bpm`} />}
            {act.calories > 0 && <Stat label="卡路里" value={`${act.calories} kcal`} />}
            {act.elevation_m > 0 && <Stat label="爬升" value={`${act.elevation_m.toFixed(0)} m`} />}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>來源：Strava</div>
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

