import React, { useMemo } from 'react'
import { useProject } from '../../context/ProjectContext'
import { formatTime } from '../../utils/timeUtils'
import { getMarkerType, MARKER_TYPES } from '../../constants/markerTypes'
import { getMarkersStats } from '../../utils/exportUtils'
import './MarkerList.css'

function MarkerList() {
  const { state, dispatch, actions } = useProject()
  const { markers, selectedMarker, filterType, sortBy, audioInfo } = state
  
  const stats = useMemo(() => getMarkersStats(markers), [markers])
  
  const filteredAndSortedMarkers = useMemo(() => {
    let result = [...markers]
    
    if (filterType !== 'ALL') {
      result = result.filter(m => m.type === filterType)
    }
    
    if (sortBy === 'time') {
      result.sort((a, b) => a.time - b.time)
    } else if (sortBy === 'type') {
      result.sort((a, b) => a.type.localeCompare(b.type))
    }
    
    return result
  }, [markers, filterType, sortBy])
  
  const handleFilterChange = (type) => {
    dispatch({ type: 'SET_FILTER_TYPE', payload: type })
  }
  
  const handleSortChange = (sort) => {
    dispatch({ type: 'SET_SORT_BY', payload: sort })
  }
  
  const handleMarkerClick = (marker) => {
    dispatch({ type: 'SET_SELECTED_MARKER', payload: marker.id })
  }
  
  const handleJumpToMarker = (marker, e) => {
    e.stopPropagation()
    dispatch({ type: 'SET_CURRENT_TIME', payload: marker.time })
    dispatch({ type: 'SET_SELECTED_MARKER', payload: marker.id })
  }
  
  const handleDeleteMarker = (marker, e) => {
    e.stopPropagation()
    if (window.confirm('确定要删除这个标记吗？')) {
      actions.deleteMarker(marker.id)
    }
  }
  
  return (
    <div className="marker-list">
      <div className="stats-section">
        <h3 className="section-title">统计概览</h3>
        <div className="stats-grid">
          {Object.entries(MARKER_TYPES).map(([key, type]) => (
            <div
              key={key}
              className={`stat-item ${filterType === key ? 'stat-item-active' : ''}`}
              onClick={() => handleFilterChange(filterType === key ? 'ALL' : key)}
              style={{ '--stat-color': type.color }}
            >
              <div className="stat-icon">{type.icon}</div>
              <div className="stat-info">
                <span className="stat-count">{stats[key] || 0}</span>
                <span className="stat-label">{type.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="filters-section">
        <div className="filter-row">
          <span className="filter-label">筛选:</span>
          <select
            value={filterType}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">全部类型</option>
            {Object.entries(MARKER_TYPES).map(([key, type]) => (
              <option key={key} value={key}>{type.label}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-row">
          <span className="filter-label">排序:</span>
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="filter-select"
          >
            <option value="time">按时间</option>
            <option value="type">按类型</option>
          </select>
        </div>
      </div>
      
      <div className="list-section">
        <div className="list-header">
          <h3 className="section-title">剪辑清单</h3>
          <span className="list-count">
            {filteredAndSortedMarkers.length} / {markers.length}
          </span>
        </div>
        
        {filteredAndSortedMarkers.length === 0 ? (
          <div className="empty-list">
            <div className="empty-icon">📝</div>
            <p>{audioInfo ? '暂无标记' : '请先导入音频'}</p>
          </div>
        ) : (
          <div className="markers-scroll">
            {filteredAndSortedMarkers.map((marker, index) => {
              const type = getMarkerType(marker.type)
              const isSelected = selectedMarker === marker.id
              
              return (
                <div
                  key={marker.id}
                  className={`marker-item ${isSelected ? 'marker-item-selected' : ''}`}
                  onClick={() => handleMarkerClick(marker)}
                  style={{ '--item-color': type.color }}
                >
                  <div className="marker-item-left">
                    <div
                      className="marker-item-type"
                      style={{ backgroundColor: type.bgColor, color: type.color }}
                    >
                      {type.icon}
                    </div>
                    <div className="marker-item-content">
                      <div className="marker-item-header">
                        <span className="marker-item-index">#{index + 1}</span>
                        <span className="marker-item-type-label">{type.label}</span>
                      </div>
                      <div className="marker-item-time">{formatTime(marker.time)}</div>
                      {marker.note && (
                        <div className="marker-item-note">{marker.note}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="marker-item-actions">
                    <button
                      className="action-button jump-btn"
                      onClick={(e) => handleJumpToMarker(marker, e)}
                      title="跳转到该位置"
                    >
                      🎯
                    </button>
                    <button
                      className="action-button delete-btn"
                      onClick={(e) => handleDeleteMarker(marker, e)}
                      title="删除标记"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default MarkerList
