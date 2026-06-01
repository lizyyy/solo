import React, { useState, useEffect } from 'react'

function NoteSection({ recordId }) {
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [author, setAuthor] = useState('阿乔')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [recordId])

  const loadNotes = async () => {
    try {
      const res = await fetch(`/api/notes/${recordId}`)
      const data = await res.json()
      setNotes(data.notes || [])
    } catch (e) {
      console.error('Failed to load notes:', e)
    }
  }

  const addNote = async () => {
    if (!newNote.trim()) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          content: newNote,
          author
        })
      })
      
      if (res.ok) {
        setNewNote('')
        loadNotes()
      }
    } catch (e) {
      console.error('Failed to add note:', e)
    }
    setLoading(false)
  }

  const deleteNote = async (noteId) => {
    if (!confirm('确定删除这条备注吗？')) return
    
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        loadNotes()
      }
    } catch (e) {
      console.error('Failed to delete note:', e)
    }
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ 
        fontSize: '14px', 
        fontWeight: '500', 
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        📝 人工备注 ({notes.length})
      </div>

      {notes.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {notes.map(note => (
            <div key={note.id} className="note-box">
              <div className="note-header">
                <span className="note-author">{note.author}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="note-time">{formatTime(note.timestamp)}</span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
              <div className="note-content">{note.content}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="署名"
          style={{
            width: '100px',
            padding: '8px 12px',
            border: '1px solid #e1e8ed',
            borderRadius: '6px',
            fontSize: '13px'
          }}
        />
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addNote()}
          placeholder="输入备注内容，按回车添加"
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #e1e8ed',
            borderRadius: '6px',
            fontSize: '13px'
          }}
        />
        <button
          className="btn btn-primary"
          onClick={addNote}
          disabled={loading || !newNote.trim()}
          style={{ padding: '8px 16px' }}
        >
          {loading ? '添加中...' : '添加'}
        </button>
      </div>
    </div>
  )
}

export default NoteSection
