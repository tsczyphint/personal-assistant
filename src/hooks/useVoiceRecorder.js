import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { addMinutes, parseISO } from 'date-fns'

// ── Claude NLP 解析（透過後端 proxy，避免 API key 外露）────────
async function parseVoiceWithClaude(transcript) {
  const now = new Date().toISOString()

  const prompt = `你是一個行事曆助理。使用者說了這段話：
「${transcript}」

現在時間是 ${now}（台灣時間，UTC+8）。

請從這段話中提取事件資訊，回傳 JSON（只回 JSON，不要其他文字）：
{
  "title": "事件名稱",
  "start_at": "ISO 8601 格式，例如 2026-03-27T15:00:00+08:00",
  "end_at": "ISO 8601 格式，預估結束時間，沒提到就加 1 小時",
  "location": "地點或 null",
  "attendees": ["人名陣列"],
  "reminder_minutes": 30,
  "confidence": 0.95,
  "ambiguous": false,
  "clarification_needed": null
}

如果時間語意模糊（例如「下週」沒指定哪天），設 ambiguous: true 並在 clarification_needed 說明需要確認的點。`

  const res = await fetch(import.meta.env.VITE_CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: 1024 })
  })

  if (!res.ok) throw new Error(`Claude proxy error: ${res.status}`)
  const data = await res.json()

  // 清除可能的 markdown code fence
  const raw = data.content.replace(/```json\n?|```/g, '').trim()
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 回傳格式錯誤，請重試')
  return JSON.parse(jsonMatch[0])
}

// ── 排程本地提醒（Service Worker Notification API）───────────
async function scheduleNotification(event, minutesBefore) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false

  const fireAt = addMinutes(parseISO(event.start_at), -minutesBefore)
  const delay = fireAt.getTime() - Date.now()
  if (delay <= 0) return false

  // 存到 Supabase reminders 表（Service Worker 可輪詢）
  await supabase.from('reminders').insert({
    event_id: event.id,
    fire_at: fireAt.toISOString(),
    minutes_before: minutesBefore,
    status: 'pending'
  })

  // 同時用 setTimeout 做當前 session 的備援提醒
  setTimeout(() => {
    new Notification(`⏰ ${event.title}`, {
      body: `${minutesBefore} 分鐘後開始${event.location ? `・${event.location}` : ''}`,
      icon: '/icons/icon-192.png',
      tag: event.id,
      renotify: true
    })
  }, Math.max(delay, 0))

  return true
}

// ── 主 Hook ───────────────────────────────────────────────────
export function useVoiceRecorder() {
  const [state, setState] = useState('idle') // idle | recording | processing | confirming | done | error
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)

  // 開始錄音
  const startRecording = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('此瀏覽器不支援語音辨識，請使用 Chrome 或 Safari')
      setState('error')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-TW'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => setState('recording')

    recognition.onresult = (e) => {
      const text = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setTranscript(text)
    }

    recognition.onend = async () => {
      setState('processing')
      try {
        const result = await parseVoiceWithClaude(transcript)
        setParsed(result)
        setState('confirming')
      } catch (err) {
        setError(`AI 解析失敗：${err.message}`)
        setState('error')
      }
    }

    recognition.onerror = (e) => {
      setError(`語音辨識錯誤：${e.error}`)
      setState('error')
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [transcript])

  // 停止錄音
  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // 確認並儲存事件
  const confirmEvent = useCallback(async (editedParsed) => {
    setState('processing')
    const { data: { user } } = await supabase.auth.getUser()

    const { data: event, error: dbErr } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        title: editedParsed.title,
        location: editedParsed.location,
        start_at: editedParsed.start_at,
        end_at: editedParsed.end_at,
        reminder_minutes: editedParsed.reminder_minutes,
        source: 'voice',
        raw_voice_text: transcript,
        parsed_by_ai: true,
        is_synced: false
      })
      .select()
      .single()

    if (dbErr) throw dbErr

    // 排程提醒
    await scheduleNotification(event, editedParsed.reminder_minutes)

    // 推送到 Google Calendar（非同步，不阻塞 UI）
    syncToGoogleCalendar(event).catch(console.warn)

    setState('done')
    return event
  }, [transcript])

  const reset = useCallback(() => {
    setState('idle')
    setTranscript('')
    setParsed(null)
    setError(null)
  }, [])

  return { state, transcript, parsed, error, startRecording, stopRecording, confirmEvent, reset }
}

// ── Google Calendar 同步（單向推送）──────────────────────────
async function syncToGoogleCalendar(event) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_cal_token')
    .single()

  if (!profile?.google_cal_token) return

  const gcalEvent = {
    summary: event.title,
    location: event.location,
    start: { dateTime: event.start_at, timeZone: 'Asia/Taipei' },
    end: { dateTime: event.end_at, timeZone: 'Asia/Taipei' },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: event.reminder_minutes }]
    }
  }

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.google_cal_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gcalEvent)
    }
  )

  if (!res.ok) return
  const created = await res.json()

  // 記錄 Google event ID 方便未來雙向同步
  await supabase
    .from('events')
    .update({ google_event_id: created.id, is_synced: true })
    .eq('id', event.id)
}
