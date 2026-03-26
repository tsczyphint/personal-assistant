import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { addMinutes, parseISO } from 'date-fns'

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
  if (data.error) throw new Error(data.error)
  const raw = (data.content || '').replace(/```json\n?|```/g, '').trim()
  if (!raw) throw new Error(`Worker 回傳空內容`)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`找不到 JSON：${raw.substring(0, 100)}`)
  return JSON.parse(jsonMatch[0])
}

async function scheduleNotification(event, minutesBefore) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false

  const fireAt = addMinutes(parseISO(event.start_at), -minutesBefore)
  const delay = fireAt.getTime() - Date.now()
  if (delay <= 0) return false

  await supabase.from('reminders').insert({
    event_id: event.id,
    fire_at: fireAt.toISOString(),
    minutes_before: minutesBefore,
    status: 'pending'
  })

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

export function useVoiceRecorder() {
  const [state, setState] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')

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

    transcriptRef.current = ''

    recognition.onstart = () => setState('recording')

    recognition.onresult = (e) => {
      const text = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setTranscript(text)
      transcriptRef.current = text
    }

    recognition.onend = async () => {
      setState('processing')
      const finalText = transcriptRef.current
      if (!finalText?.trim()) {
        setError('沒有偵測到語音，請重試')
        setState('error')
        return
      }
      try {
        const result = await parseVoiceWithClaude(finalText)
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
  }, [])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

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
        raw_voice_text: transcriptRef.current,
        parsed_by_ai: true,
        is_synced: false
      })
      .select()
      .single()

    if (dbErr) throw dbErr

    await scheduleNotification(event, editedParsed.reminder_minutes)
    syncToGoogleCalendar(event).catch(console.warn)

    setState('done')
    return event
  }, [])

  const reset = useCallback(() => {
    setState('idle')
    setTranscript('')
    transcriptRef.current = ''
    setParsed(null)
    setError(null)
  }, [])

  return { state, transcript, parsed, error, startRecording, stopRecording, confirmEvent, reset }
}

async function syncToGoogleCalendar(event) {
  const { data: { session } } = await supabase.auth.getSession()
  const googleToken = session?.provider_token
  if (!googleToken) return

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
        Authorization: `Bearer ${googleToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gcalEvent)
    }
  )

  if (!res.ok) return
  const created = await res.json()

  await supabase
    .from('events')
    .update({ google_event_id: created.id, is_synced: true })
    .eq('id', event.id)
}
