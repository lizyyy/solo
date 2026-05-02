import React, { useState, useEffect } from 'react'
import { useProject } from '../../context/ProjectContext'
import { formatTime } from '../../utils/timeUtils'
import { MARKER_TYPES, getMarkerType } from '../../constants/markerTypes'
import './MarkerEditor.css'

function MarkerEditor() {
  const { state, actions, dispatch } = useProject()
  const { selectedMarker, markers, currentTime } = state
  
  const marker = markers.find(m => m.id === selectedMarker)
  
  const [editTime, setEditTime] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editType, setEditType] = useState('')
  
  useEffect(() => {
    if (marker) {
      setEditTime(formatTime(marker.time))
      setEditNote(marker.note || '')
      setEditType(marker.type)
    }
  }, [marker])
  
  if (!marker) {
    return (
      <div className="marker-editor marker-editor-empty">
        <div className="empty-icon">📌</div>
        <p>点击时间轴上的标记</p>
        <p>或在列表中选择来编辑</p>
      </div>
    )
  }
  
  const markerType = getMarkerType(marker.type)
  
  const handleTimeChange = (e) => {
    setEditTime(e.target.value)
  }
  
  const handleTimeBlur = () => {
    const parts = editTime.split(':')
    if (parts.length === 2) {
      const [mins, secsPart] = parts
      const [secs, ms] = secsPart.split('.')
      const newTime = parseInt(mins || 0) * 60 + 
                      parseInt(secs || 0) + 
                      (parseInt(ms || 0) / 1000)
      actions.updateMarker(marker.id, { time: newTime })
    }
  }
  
  const handleTypeChange = (newType) => {
    setEditType(newType)
    actions.updateMarker(marker.id, { type: newType })
  }
  
  const handleNoteChange = (e) => {
    setEditNote(e.target.value)
    actions.updateMarker(marker.id, { note: e.target.value })
  }
  
  const handleDelete = () => {
    if (window.confirm('确定要删除这个标记吗？')) {
      actions.deleteMarker(marker.id)
    }
  }
  
  const handleJumpTo = () => {
    dispatch({ type: 'SET_CURRENT_TIME', payload: marker.time })
  }
  
  return (
    <div className="marker-editor" style={{ '--editor-color': markerType.color }}>
      <div className="editor-header">
        <div className="editor-type-badge" style={{ backgroundColor: markerType.bgColor, color: markerType.color }}>
          <span className="badge-icon">{markerType.icon}</span>
          <span className="badge-label">{markerType.label}</span>
        </div>
        
        <button
          className="jump-button"
          onClick={handleJumpTo}
          title="跳转到标记位置"
        >
          🎯 跳转
        </button>
      </div>
      
      <div className="editor-fields">
        <div className="field">
          <label>时间</label>
          <input
            type="text"
            value={editTime}
            onChange={handleTimeChange}
            onBlur={handleTimeBlur}
            className="time-input"
          />
        </div>
        
        <div className="field">
          <label>类型</label>
          <div className="type-selector">
            {Object.values(MARKER_TYPES).map((type) => (
              <button
                key={type.id}
                className={`type-option ${editType === type.id ? 'type-option-selected' : ''}`}
                onClick={() => handleTypeChange(type.id)}
                title={type.label}
                style={{
                  borderColor: editType === type.id ? type.color : '#e5e7eb',
                  backgroundColor: editType === type.id ? type.bgColor : 'white',
                }}
              >
                <span className="type-option-icon">{type.icon}</span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="field">
          <label>备注</label>
          <textarea
            value={editNote}
            onChange={handleNoteChange}
            placeholder="添加备注说明..."
            className="note-textarea"
            rows={3}
          />
        </div>
      </div>
      
      <div className="editor-actions">
        <button
          className="delete-button"
          onClick={handleDelete}
        >
          🗑️ 删除标记
        </button>
      </div>
    </div>
  )
}

export default MarkerEditor
