import React from 'react'
import { TugStatus } from '../models/Resource'
import './ResourcePanel.css'

const ResourcePanel = ({
  level,
  currentTime,
  onTugSelect
}) => {
  const tugs = level?.tugs || []
  const weather = level?.getCurrentWeather(currentTime)
  const berths = level?.berths || []
  const waitingZones = level?.waitingZones || []

  const getTugStatusBadge = (tug) => {
    let statusText = '可用'
    let statusClass = 'status-available'

    switch (tug.status) {
      case TugStatus.AVAILABLE:
        statusText = '可用'
        statusClass = 'status-available'
        break
      case TugStatus.ASSIGNED:
        statusText = '已分配'
        statusClass = 'status-assigned'
        break
      case TugStatus.BUSY:
        statusText = '作业中'
        statusClass = 'status-busy'
        break
      case TugStatus.MAINTENANCE:
        statusText = '维护中'
        statusClass = 'status-maintenance'
        break
    }

    return <span className={`tug-status ${statusClass}`}>{statusText}</span>
  }

  const getWeatherIcon = (weather) => {
    if (!weather) return '☀️'
    
    const visibility = weather.visibility
    const windSpeed = weather.windSpeed

    if (visibility < 20) return '🌫️'
    if (visibility < 50) return '🌫️'
    if (windSpeed > 30) return '🌪️'
    if (windSpeed > 20) return '💨'
    if (weather.waveHeight > 3) return '🌊'
    if (weather.waveHeight > 1.5) return '🌊'
    
    return '🌤️'
  }

  const getDangerLevelClass = (weather) => {
    if (!weather) return 'danger-low'
    const level = weather.getDangerLevel()
    return `danger-${level}`
  }

  const getDangerLevelText = (weather) => {
    if (!weather) return '良好'
    const texts = {
      low: '良好',
      medium: '中等',
      high: '危险'
    }
    return texts[weather.getDangerLevel()] || '良好'
  }

  const availableBerths = berths.filter(b => !b.occupiedBy).length
  const totalBerths = berths.length

  return (
    <div className="resource-panel">
      <div className="panel-section weather-section">
        <div className="panel-header">
          <h3 className="panel-title">当前天气</h3>
          <div className={`danger-indicator ${getDangerLevelClass(weather)}`}>
            {getDangerLevelText(weather)}
          </div>
        </div>
        
        <div className="weather-display">
          <div className="weather-icon">{getWeatherIcon(weather)}</div>
          <div className="weather-details">
            {weather ? (
              <>
                <div className="weather-row">
                  <span className="weather-label">能见度</span>
                  <span className="weather-value">{weather.visibility}%</span>
                </div>
                <div className="weather-row">
                  <span className="weather-label">风速</span>
                  <span className="weather-value">{weather.windSpeed}节</span>
                </div>
                <div className="weather-row">
                  <span className="weather-label">浪高</span>
                  <span className="weather-value">{weather.waveHeight}米</span>
                </div>
                {weather.affectsNavigation && (
                  <div className="weather-warning">
                    ⚠️ 天气影响航行效率
                  </div>
                )}
              </>
            ) : (
              <div className="weather-no-data">暂无天气数据</div>
            )}
          </div>
        </div>
      </div>

      <div className="panel-section tug-section">
        <div className="panel-header">
          <h3 className="panel-title">拖轮资源</h3>
          <span className="resource-count">
            {tugs.filter(t => t.status === TugStatus.AVAILABLE).length}/{tugs.length} 可用
          </span>
        </div>
        
        <div className="tug-list">
          {tugs.length === 0 ? (
            <div className="empty-list">暂无拖轮</div>
          ) : (
            tugs.map(tug => (
              <div 
                key={tug.id} 
                className="tug-card"
                onClick={() => onTugSelect?.(tug)}
              >
                <div className="tug-header">
                  <span className="tug-name">{tug.name}</span>
                  {getTugStatusBadge(tug)}
                </div>
                <div className="tug-details">
                  <span className="tug-power">功率: {tug.power}HP</span>
                  <span className="tug-speed">速度: {tug.speed}节</span>
                </div>
                {tug.assignedShipId && (
                  <div className="tug-assignment">
                    已分配: {level?.getVesselById(tug.assignedShipId)?.name || tug.assignedShipId}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel-section berth-section">
        <div className="panel-header">
          <h3 className="panel-title">泊位状态</h3>
          <span className="resource-count">
            {availableBerths}/{totalBerths} 可用
          </span>
        </div>
        
        <div className="berth-list">
          {berths.map(berth => (
            <div key={berth.id} className="berth-item">
              <div className={`berth-indicator ${berth.occupiedBy ? 'occupied' : 'available'} ${berth.isDangerousBerth ? 'danger-berth' : ''} ${berth.isPassengerBerth ? 'passenger-berth' : ''}`}></div>
              <div className="berth-info">
                <span className="berth-name">{berth.name}</span>
                <span className="berth-capacity">{berth.length}m / {berth.maxDraft}m</span>
              </div>
              <div className="berth-tags">
                {berth.isDangerousBerth && <span className="tag danger-tag">危险品</span>}
                {berth.isPassengerBerth && <span className="tag passenger-tag">客船</span>}
              </div>
              {berth.occupiedBy && (
                <div className="berth-occupied-by">
                  {level?.getVesselById(berth.occupiedBy)?.name || '已占用'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section waiting-section">
        <div className="panel-header">
          <h3 className="panel-title">等待区</h3>
        </div>
        
        <div className="waiting-zone-list">
          {waitingZones.map(zone => (
            <div key={zone.id} className="waiting-zone-item">
              <div className="waiting-zone-info">
                <span className="zone-name">{zone.name}</span>
                <div className="zone-capacity-bar">
                  <div 
                    className="zone-capacity-fill"
                    style={{ width: `${(zone.currentVessels.length / zone.maxCapacity) * 100}%` }}
                  ></div>
                </div>
                <span className="zone-count">
                  {zone.currentVessels.length}/{zone.maxCapacity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ResourcePanel
