import React from 'react'
import { ShipStatus } from '../models/Ship'
import './ShipPanel.css'

const ShipPanel = ({
  level,
  currentTime,
  selectedShipId,
  onShipSelect,
  onAssignBerth,
  onAssignTugs,
  onSetRoute,
  onSendToWaiting
}) => {
  const entryShips = level?.entryVessels || []
  const departureShips = level?.departureVessels || []
  const tugs = level?.tugs || []
  const berths = level?.berths || []

  const formatTime = (minutes) => {
    if (minutes === null || minutes === undefined) return '--:--'
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (ship) => {
    let statusText = '未知'
    let statusClass = 'status-unknown'

    switch (ship.status) {
      case ShipStatus.WAITING:
        statusText = '等待中'
        statusClass = 'status-waiting'
        break
      case ShipStatus.APPROACHING:
      case ShipStatus.ENTERING:
        statusText = '进港中'
        statusClass = 'status-moving'
        break
      case ShipStatus.BERTHING:
        statusText = '靠泊中'
        statusClass = 'status-berthing'
        break
      case ShipStatus.DOCKED:
        statusText = '已靠泊'
        statusClass = 'status-docked'
        break
      case ShipStatus.UNBERTHING:
        statusText = '离泊中'
        statusClass = 'status-berthing'
        break
      case ShipStatus.EXITING:
        statusText = '离港中'
        statusClass = 'status-moving'
        break
      case ShipStatus.COMPLETED:
        statusText = '已完成'
        statusClass = 'status-completed'
        break
      case ShipStatus.DELAYED:
        statusText = '延误'
        statusClass = 'status-delayed'
        break
    }

    return <span className={`status-badge ${statusClass}`}>{statusText}</span>
  }

  const getPriorityBadge = (ship) => {
    const priorityNames = {
      1: { text: '紧急', class: 'priority-urgent' },
      2: { text: '正常', class: 'priority-normal' },
      3: { text: '低', class: 'priority-low' }
    }
    const priority = priorityNames[ship.priority] || priorityNames[2]
    return <span className={`priority-badge ${priority.class}`}>{priority.text}</span>
  }

  const renderShipCard = (ship, isEntry) => {
    const isSelected = ship.id === selectedShipId
    const isOverdue = ship.isOverdue(currentTime)
    const remainingTime = ship.getRemainingTime(currentTime)

    return (
      <div
        key={ship.id}
        className={`ship-card ${isSelected ? 'selected' : ''} ${isOverdue ? 'overdue' : ''}`}
        onClick={() => onShipSelect(ship)}
      >
        <div className="ship-header">
          <div className="ship-name-row">
            <span className="ship-name">{ship.name}</span>
            {ship.isDangerous && <span className="danger-tag">⚠ 危险品</span>}
            {getPriorityBadge(ship)}
          </div>
          <div className="ship-status-row">
            {getStatusBadge(ship)}
            <span className="ship-type">{ship.getTypeName()}</span>
          </div>
        </div>

        <div className="ship-details">
          <div className="detail-row">
            <span className="detail-label">长度</span>
            <span className="detail-value">{ship.length}m</span>
            <span className="detail-label">吃水</span>
            <span className="detail-value">{ship.draft}m</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">拖轮需求</span>
            <span className="detail-value">{ship.tugsRequired}艘</span>
            <span className="detail-label">已分配</span>
            <span className="detail-value">{ship.assignedTugs.length}艘</span>
          </div>
        </div>

        <div className="ship-time-info">
          {isEntry && (
            <>
              <div className="time-item">
                <span className="time-label">预计到达</span>
                <span className="time-value">{formatTime(ship.arrivalTime)}</span>
              </div>
              <div className="time-item">
                <span className="time-label">最晚时限</span>
                <span className={`time-value ${isOverdue ? 'overdue' : ''}`}>
                  {formatTime(ship.deadlineTime)}
                </span>
              </div>
              {remainingTime !== null && (
                <div className="time-item">
                  <span className="time-label">剩余时间</span>
                  <span className={`time-value ${remainingTime < 30 ? 'urgent' : ''}`}>
                    {Math.round(remainingTime)}分钟
                  </span>
                </div>
              )}
            </>
          )}
          {!isEntry && (
            <>
              <div className="time-item">
                <span className="time-label">计划离港</span>
                <span className="time-value">{formatTime(ship.arrivalTime)}</span>
              </div>
              <div className="time-item">
                <span className="time-label">最晚时限</span>
                <span className={`time-value ${isOverdue ? 'overdue' : ''}`}>
                  {formatTime(ship.deadlineTime)}
                </span>
              </div>
            </>
          )}
        </div>

        {ship.assignedBerth && (
          <div className="ship-assignment">
            <span className="assignment-label">分配泊位:</span>
            <span className="assignment-value">{level?.getBerthById(ship.assignedBerth)?.name || ship.assignedBerth}</span>
          </div>
        )}

        {ship.waitTime > 0 && (
          <div className="ship-wait-time">
            <span className="wait-label">等待时间:</span>
            <span className="wait-value">{Math.round(ship.waitTime)}分钟</span>
          </div>
        )}
      </div>
    )
  }

  const activeEntryShips = entryShips.filter(s => s.status !== ShipStatus.COMPLETED)
  const activeDepartureShips = departureShips.filter(s => s.status !== ShipStatus.COMPLETED)
  const completedShips = [...entryShips, ...departureShips].filter(s => s.status === ShipStatus.COMPLETED)

  return (
    <div className="ship-panel">
      <div className="panel-section">
        <div className="panel-header">
          <h3 className="panel-title">进港船舶 ({activeEntryShips.length})</h3>
        </div>
        <div className="ship-list">
          {activeEntryShips.length === 0 ? (
            <div className="empty-list">暂无进港船舶</div>
          ) : (
            activeEntryShips
              .sort((a, b) => a.priority - b.priority || a.arrivalTime - b.arrivalTime)
              .map(ship => renderShipCard(ship, true))
          )}
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-header">
          <h3 className="panel-title">离港船舶 ({activeDepartureShips.length})</h3>
        </div>
        <div className="ship-list">
          {activeDepartureShips.length === 0 ? (
            <div className="empty-list">暂无离港船舶</div>
          ) : (
            activeDepartureShips
              .sort((a, b) => a.priority - b.priority || a.arrivalTime - b.arrivalTime)
              .map(ship => renderShipCard(ship, false))
          )}
        </div>
      </div>

      {completedShips.length > 0 && (
        <div className="panel-section">
          <div className="panel-header">
            <h3 className="panel-title">已完成 ({completedShips.length})</h3>
          </div>
          <div className="ship-list completed-list">
            {completedShips.map(ship => renderShipCard(ship, ship.isEntry))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ShipPanel
