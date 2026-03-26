import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format, parseISO, differenceInDays } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const ITEM_TYPE_ICON = { flight: '✈', train: '🚄', hotel: '🏨', car: '🚗', other: '📌' }
const ITEM_TYPE_LABEL = { flight: '機票', train: '火車/高鐵', hotel: '飯店', car: '租車', other: '其他' }
const STATUS_STYLE = {
  planning: { bg: 'rgba(124,111,247,0.1)', border: 'rgba(124,111,247,0.25)', color: 'var(--accent2)', label: '規劃中' },
  confirmed: { bg: 'rgba(31,168,130,0.1)', border: 'rgba(31,168,130,0.25)', color: '#3ecfa0', label: '已確認' },
  ongoing: { bg: 'rgba(230,168,23,0.1)', border: 'rgba(230,168,23,0.25)', color: '#f0c040', label: '進行中' },
  done: { bg: 'var(--bg3)', border: 'var(--border)', color: 'var(--text3)', label: '已完成' },
}

export default function Trip() {
  const [trips, setTrips] = useState([])
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewTrip, setShowNewTrip] = useState(false)

  useEffect(() => { loadTrips() }, [])

  async function loadTrips() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true })
    setTrips(data ?? [])
    setLoading(false)
  }

  async function loadItems(tripId) {
    const { data } = await supabase
      .from('trip_items')
      .select('*')
      .eq('trip_id', tripId)
      .order('depart_at', { ascending: true })
    setItems(data ?? [])
  }

  async function selectTrip(trip) {
    setSelectedTrip(trip)
    await loadItems(trip.id)
  }

  if (selectedTrip) {
    return <TripDetail trip={selectedTrip} items={items} onBack={() => setSelectedTrip(null)} onRefresh={() => loadItems(selectedTrip.id)} />
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">行程規劃</div>
          <button className="btn primary" style={{ padding: '7px 14px', fontSize: 13 }}
            onClick={() => setShowNewTrip(true)}>
            + 新增行程
          </button>
        </div>
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>}

      {!loading && trips.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 16px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✈</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>還沒有行程</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>新增家庭旅遊或出差行程，整合機票、飯店、車票</div>
          <button className="btn primary" onClick={() => setShowNewTrip(true)}>建立第一個行程</button>
        </div>
      )}

      {trips.map(trip => {
        const nights = differenceInDays(parseISO(trip.end_date), parseISO(trip.start_date))
        const st = STATUS_STYLE[trip.status] ?? STATUS_STYLE.planning
        return (
          <div key={trip.id} className="card" style={{ marginBottom: 10, cursor: 'pointer' }}
            onClick={() => selectTrip(trip)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{trip.title}</div>
                {trip.destination && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{trip.destination}</div>}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                background: st.bg, border: `1px solid ${st.border}`, color: st.color
              }}>{st.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text2)' }}>
              <span>{format(parseISO(trip.start_date), 'M/d', { locale: zhTW })} – {format(parseISO(trip.end_date), 'M/d', { locale: zhTW })}</span>
              <span>·</span>
              <span>{nights} 晚 {nights + 1} 天</span>
              <span>·</span>
              <span>{trip.trip_type === 'family' ? '家庭旅遊' : trip.trip_type === 'business' ? '出差' : '個人'}</span>
            </div>
          </div>
        )
      })}

      {showNewTrip && <NewTripModal onClose={() => setShowNewTrip(false)} onCreated={() => { setShowNewTrip(false); loadTrips() }} />}
    </div>
  )
}

function TripDetail({ trip, items, onBack, onRefresh }) {
  const [showAddItem, setShowAddItem] = useState(false)

  return (
    <div className="page">
      <div style={{ padding: '16px 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn ghost" onClick={onBack} style={{ padding: '6px 10px' }}>← 返回</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{trip.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {format(parseISO(trip.start_date), 'M/d', { locale: zhTW })} – {format(parseISO(trip.end_date), 'M/d', { locale: zhTW })}
          </div>
        </div>
      </div>

      <div className="section-label">行程時間軸</div>

      {items.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '24px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>還沒有行程細項</div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        {items.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', gap: 12, paddingBottom: 12, position: 'relative' }}>
            {i < items.length - 1 && (
              <div style={{ position: 'absolute', left: 15, top: 32, width: 1, height: 'calc(100% - 8px)', background: 'var(--border)' }} />
            )}
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, zIndex: 1 }}>
              {ITEM_TYPE_ICON[item.item_type] ?? '📌'}
            </div>
            <div className="card" style={{ flex: 1, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{item.title}</div>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{ITEM_TYPE_LABEL[item.item_type]}</span>
              </div>
              {item.confirmation_code && (
                <div style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 3, fontFamily: 'var(--mono)' }}>
                  #{item.confirmation_code}
                </div>
              )}
              {item.depart_at && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                  {format(parseISO(item.depart_at), 'M/d HH:mm', { locale: zhTW })}
                  {item.depart_location && ` · ${item.depart_location}`}
                  {item.arrive_location && ` → ${item.arrive_location}`}
                </div>
              )}
              {item.seat_info && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.seat_info}</div>}
            </div>
          </div>
        ))}
      </div>

      <button className="btn" onClick={() => setShowAddItem(true)} style={{ width: '100%', marginBottom: 8 }}>
        + 新增行程細項
      </button>

      {showAddItem && (
        <AddItemModal tripId={trip.id} onClose={() => setShowAddItem(false)} onCreated={() => { setShowAddItem(false); onRefresh() }} />
      )}
    </div>
  )
}

function NewTripModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', trip_type: 'family', start_date: '', end_date: '', destination: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title || !form.start_date || !form.end_date) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('trips').insert({ ...form, user_id: user.id, status: 'planning' })
    setSaving(false)
    onCreated()
  }

  return (
    <Modal title="新增行程" onClose={onClose}>
      <Field label="行程名稱"><input type="text" value={form.title} placeholder="例：東京家庭旅遊" onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
      <Field label="類型">
        <select value={form.trip_type} onChange={e => setForm(p => ({ ...p, trip_type: e.target.value }))}>
          <option value="family">家庭旅遊</option>
          <option value="business">出差</option>
          <option value="personal">個人</option>
        </select>
      </Field>
      <Field label="目的地"><input type="text" value={form.destination} placeholder="例：東京" onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="出發日"><input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></Field>
        <Field label="回程日"><input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></Field>
      </div>
      <button className="btn primary" onClick={save} disabled={saving} style={{ width: '100%', marginTop: 8 }}>
        {saving ? '儲存中⋯' : '建立行程'}
      </button>
    </Modal>
  )
}

function AddItemModal({ tripId, onClose, onCreated }) {
  const [form, setForm] = useState({ item_type: 'flight', title: '', confirmation_code: '', depart_at: '', depart_location: '', arrive_location: '', seat_info: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title) return
    setSaving(true)
    await supabase.from('trip_items').insert({ ...form, trip_id: tripId, depart_at: form.depart_at || null })
    setSaving(false)
    onCreated()
  }

  return (
    <Modal title="新增細項" onClose={onClose}>
      <Field label="類型">
        <select value={form.item_type} onChange={e => setForm(p => ({ ...p, item_type: e.target.value }))}>
          {Object.entries(ITEM_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="名稱"><input type="text" value={form.title} placeholder={`例：BR2196 松山→羽田`} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
      <Field label="確認碼 / 訂單號"><input type="text" value={form.confirmation_code} onChange={e => setForm(p => ({ ...p, confirmation_code: e.target.value }))} /></Field>
      <Field label="出發時間"><input type="datetime-local" value={form.depart_at} onChange={e => setForm(p => ({ ...p, depart_at: e.target.value }))} /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="出發地"><input type="text" value={form.depart_location} onChange={e => setForm(p => ({ ...p, depart_location: e.target.value }))} /></Field>
        <Field label="目的地"><input type="text" value={form.arrive_location} onChange={e => setForm(p => ({ ...p, arrive_location: e.target.value }))} /></Field>
      </div>
      <Field label="座位 / 備註"><input type="text" value={form.seat_info} onChange={e => setForm(p => ({ ...p, seat_info: e.target.value }))} /></Field>
      <button className="btn primary" onClick={save} disabled={saving} style={{ width: '100%', marginTop: 8 }}>
        {saving ? '儲存中⋯' : '加入行程'}
      </button>
    </Modal>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--bg2)', borderRadius: '20px 20px 0 0', padding: '20px 16px 32px', width: '100%', maxHeight: '85dvh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{title}</div>
          <button className="btn ghost" onClick={onClose} style={{ padding: '4px 10px', fontSize: 13 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}
