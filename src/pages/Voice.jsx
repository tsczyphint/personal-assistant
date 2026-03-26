import { useState } from 'react'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const REMINDER_OPTIONS = [5, 10, 15, 30, 60]

export default function Voice() {
  const { state, transcript, parsed, error, startRecording, stopRecording, confirmEvent, reset } = useVoiceRecorder()
  const [editedParsed, setEditedParsed] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 當 parsed 出現時，複製一份可編輯
  if (parsed && !editedParsed) setEditedParsed({ ...parsed })

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await confirmEvent(editedParsed)
      setSaved(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    reset()
    setEditedParsed(null)
    setSaved(false)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">語音紀錄</div>
        <div className="page-sub">說出你的行程，AI 自動整理</div>
      </div>

      {/* ── 錄音按鈕 ── */}
      {(state === 'idle' || state === 'recording') && !saved && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0 24px', gap: 16 }}>
          <button
            onClick={state === 'idle' ? startRecording : stopRecording}
            style={{
              width: 88, height: 88,
              borderRadius: '50%',
              background: state === 'recording' ? 'rgba(224,90,58,0.15)' : 'rgba(124,111,247,0.15)',
              border: `2px solid ${state === 'recording' ? 'var(--coral)' : 'var(--accent)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            {state === 'recording'
              ? <StopIcon />
              : <MicIcon />
            }
          </button>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>
            {state === 'recording' ? '錄音中⋯ 點按停止' : '點按開始說話'}
          </span>

          {state === 'recording' && transcript && (
            <div className="card" style={{ width: '100%', marginTop: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>辨識中⋯</div>
              <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.6 }}>「{transcript}」</div>
            </div>
          )}
        </div>
      )}

      {/* ── 處理中 ── */}
      {state === 'processing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 16 }}>
          <div className="spinner" />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>AI 解析中⋯</span>
        </div>
      )}

      {/* ── 確認畫面 ── */}
      {state === 'confirming' && editedParsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ borderColor: 'rgba(124,111,247,0.25)' }}>
            <div style={{ fontSize: 12, color: 'var(--accent2)', marginBottom: 8 }}>原始語音</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', fontStyle: 'italic' }}>「{transcript}」</div>
          </div>

          <div className="section-label" style={{ marginTop: 4 }}>AI 解析結果</div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="事件名稱">
              <input type="text" value={editedParsed.title}
                onChange={e => setEditedParsed(p => ({ ...p, title: e.target.value }))} />
            </Field>

            <Field label="開始時間">
              <input type="datetime-local" value={editedParsed.start_at?.slice(0, 16)}
                onChange={e => setEditedParsed(p => ({ ...p, start_at: e.target.value + ':00+08:00' }))} />
            </Field>

            <Field label="地點">
              <input type="text" value={editedParsed.location ?? ''}
                placeholder="（選填）"
                onChange={e => setEditedParsed(p => ({ ...p, location: e.target.value || null }))} />
            </Field>

            <Field label="提前提醒">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {REMINDER_OPTIONS.map(m => (
                  <button key={m}
                    onClick={() => setEditedParsed(p => ({ ...p, reminder_minutes: m }))}
                    className="btn"
                    style={{
                      padding: '6px 12px', fontSize: 13,
                      background: editedParsed.reminder_minutes === m ? 'rgba(124,111,247,0.2)' : 'var(--bg3)',
                      borderColor: editedParsed.reminder_minutes === m ? 'var(--accent)' : 'var(--border)',
                      color: editedParsed.reminder_minutes === m ? 'var(--accent2)' : 'var(--text2)',
                    }}>
                    {m < 60 ? `${m} 分` : '1 小時'}
                  </button>
                ))}
              </div>
            </Field>

            {editedParsed.ambiguous && (
              <div style={{ padding: '10px 12px', background: 'rgba(230,168,23,0.1)', borderRadius: 8, border: '1px solid rgba(230,168,23,0.25)' }}>
                <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 2 }}>需要確認</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{editedParsed.clarification_needed}</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn ghost" onClick={handleReset} style={{ flex: 1 }}>重新錄音</button>
            <button className="btn primary" onClick={handleConfirm} disabled={saving} style={{ flex: 2 }}>
              {saving ? '儲存中⋯' : '確認並加入行事曆'}
            </button>
          </div>
        </div>
      )}

      {/* ── 儲存成功 ── */}
      {saved && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(31,168,130,0.15)', border: '2px solid var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckIcon />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 4 }}>已加入行事曆</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {editedParsed?.title}
              {editedParsed?.start_at && (
                <><br />{format(parseISO(editedParsed.start_at), 'M/d (E) HH:mm', { locale: zhTW })}</>
              )}
            </div>
          </div>
          <button className="btn" onClick={handleReset} style={{ marginTop: 8 }}>再記一則</button>
        </div>
      )}

      {/* ── 錯誤 ── */}
      {state === 'error' && (
        <div style={{ padding: '16px', background: 'rgba(224,90,58,0.1)', borderRadius: 10, border: '1px solid rgba(224,90,58,0.25)' }}>
          <div style={{ fontSize: 13, color: 'var(--coral)', marginBottom: 8 }}>{error}</div>
          <button className="btn" onClick={handleReset}>重試</button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

function MicIcon() {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
}
function StopIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--coral)" stroke="none"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>
}
function CheckIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
}
