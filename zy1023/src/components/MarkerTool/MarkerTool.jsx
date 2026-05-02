import React from 'react'
import { useProject } from '../../context/ProjectContext'
import { formatTime } from '../../utils/timeUtils'
import { MARKER_TYPES } from '../../constants/markerTypes'
import './MarkerTool.css'

function MarkerTool() {
  const { state, actions } = useProject()
  const { currentTime, audioInfo, markers } = state
  
  const handleAddMarker = (type) => {
    if (!audioInfo) return
    
    actions.addMarker({
      time: currentTime,
      type: type,
      note: ''
    })
  }
  
  const markerTypes = Object.values(MARKER_TYPES)
  
  return (
    <div className="marker-tool">
      <div className="marker-tool-header">
        <h3>快速标记</h3>
        <span className="current-time-badge">{formatTime(currentTime)}</span>
      </div>
      
      <div className="marker-types-grid">
        {markerTypes.map((type) => (
          <button
            key={type.id}
            className="marker-type-button"
            onClick={() => handleAddMarker(type.id)}
            disabled={!audioInfo}
            style={{
              '--type-color': type.color,
              '--type-bg': type.bgColor,
              '--type-border': type.borderColor,
            }}
          >
            <span className="marker-type-icon">{type.icon}</span>
            <span className="marker-type-label">{type.label}</span>
          </button>
        ))}
      </div>
      
      <div className="marker-stats">
        <span>已有 {markers.length} 个标记</span>
      </div>
    </div>
  )
}

export default MarkerTool
