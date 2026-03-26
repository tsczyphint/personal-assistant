import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | 'new' | note object
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { loadNotes() }, [])

  async function loadNotes() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    setNotes(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setEditing('new')
    setTitle('')
    setContent('')
  }

  function openEdit(note) {
    setEditing(note)
    setTitle(note.title)
    setContent(note.content)
  }

  function cancelEdit() {
    setEditing(null)
    setTitle('')
    setContent('')
  }

  async function saveNote() {
    if (!title.trim() && !content.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (editing === 'new') {
      await supabase.from('notes').insert({
        user_id: user.id,
        title: title.trim() || '(無標題)',
        content: content.trim(),
      })
    } else {
      await supabase.from('notes').update({
        title: title.trim() || '(無標題)',
        content: content.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id)
    }
    setSaving(false)
    setEditing(null)
    await loadNotes()
  }

  async function deleteNote(id) {
    if (!confirm('確定要刪除這則筆記？')) return
    await supabase.from('notes').delete().eq('id', id)
    await loadNotes()
  }

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  )

  if (editing) {
    return (
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0 12px' }}>
          <button className="btn ghost" onClick={cancelEdit} style={{ padding: '6px 10px' }}>← 返回</button>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{editing === 'new' ? '新增筆記' : '編輯筆記'}</div>
        </div>

        <input
          type="text"
          placeholder="標題"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ marginBottom: 10, fontSize: 16, fontWeight: 500 }}
        />
        <textarea
          placeholder="內容..."
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{
            width: '100%', minHeight: 320,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            fontFamily: 'var(--font)',
            fontSize: 14,
            padding: '12px',
            lineHeight: 1.7,
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn ghost" onClick={cancelEdit} style={{ flex: 1 }}>取消</button>
          <button className="btn primary" onClick={saveNote} disabled={saving} style={{ flex: 2 }}>
            {saving ? '儲存中⋯' : '儲存'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">筆記</div>
          <button className="btn primary" onClick={openNew} style={{ padding: '7px 14px', fontSize: 13 }}>
            + 新增
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="搜尋筆記..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 14 }}
      />

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 16px' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
            {search ? '找不到符合的筆記' : '還沒有筆記'}
          </div>
          {!search && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>記錄重要資訊、開場白模板、備忘事項</div>}
          {!search && <button className="btn primary" onClick={openNew}>建立第一則筆記</button>}
        </div>
      )}

      {filtered.map(note => (
        <div key={note.id} className="card" style={{ marginBottom: 10, cursor: 'pointer' }}
          onClick={() => openEdit(note)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
                {note.title}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--text2)',
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                lineHeight: 1.6,
              }}>
                {note.content || '(無內容)'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                {new Date(note.updated_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <button
              className="btn ghost"
              onClick={e => { e.stopPropagation(); deleteNote(note.id) }}
              style={{ padding: '4px 8px', fontSize: 12, color: 'var(--text3)', marginLeft: 8, flexShrink: 0 }}
            >
              刪除
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
