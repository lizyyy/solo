import React from 'react';

const FloorPlan = ({ rooms, points, selectedPoint, onSelectPoint, floorName }) => {
  const width = 800;
  const height = 600;

  return (
    <div className="floor-wrap">
      <div className="floor-svg-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="floor-svg"
          style={{ width: '100%', height: 'auto' }}
        >
          {/* 背景 */}
          <rect x="0" y="0" width={width} height={height} fill="#f8fafc" />

          {/* 房间 */}
          {rooms.map(room => (
            <g key={room.id}>
              <rect
                x={room.x}
                y={room.y}
                width={room.w}
                height={room.h}
                fill={room.color}
                stroke="#94a3b8"
                strokeWidth="2"
                rx="4"
              />
              <text
                x={room.x + room.w / 2}
                y={room.y + 24}
                textAnchor="middle"
                fontSize="13"
                fill="#475569"
                fontWeight="500"
              >
                {room.name}
              </text>
            </g>
          ))}

          {/* 测点 */}
          {points.map(p => {
            const isSelected = selectedPoint?.id === p.id;
            return (
              <g
                key={p.id}
                onClick={() => onSelectPoint(p)}
                style={{ cursor: 'pointer' }}
              >
                {/* 选中光晕 */}
                {isSelected && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="28"
                    fill="rgba(37, 99, 235, 0.15)"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  >
                    <animate
                      attributeName="r"
                      values="22;30;22"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {/* 异常外圆 */}
                {p.hasAnomaly && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 18 : 14}
                    fill={p.anomalyLevel === '高' ? '#fee2e2' : p.anomalyLevel === '中' ? '#fef3c7' : '#dbeafe'}
                    stroke={p.anomalyLevel === '高' ? '#dc2626' : p.anomalyLevel === '中' ? '#d97706' : '#2563eb'}
                    strokeWidth="2"
                    opacity="0.6"
                  />
                )}
                {/* 测点内圆 */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? 10 : 8}
                  fill={p.hasAnomaly
                    ? (p.anomalyLevel === '高' ? '#dc2626' : p.anomalyLevel === '中' ? '#d97706' : '#2563eb')
                    : '#059669'}
                  stroke="#fff"
                  strokeWidth="2"
                />
                {/* 标签 */}
                <g transform={`translate(${p.x + 14}, ${p.y - 4})`}>
                  <rect
                    x="0"
                    y="-12"
                    width={p.itemNo.length * 8 + 12}
                    height="18"
                    rx="4"
                    fill="rgba(255,255,255,0.95)"
                    stroke={isSelected ? '#2563eb' : '#e5e7eb'}
                    strokeWidth="1"
                  />
                  <text
                    x="6"
                    y="1"
                    fontSize="11"
                    fill="#374151"
                    fontFamily="monospace"
                  >
                    {p.itemNo}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 指北针 */}
          <g transform={`translate(${width - 60}, 50)`}>
            <circle cx="0" cy="0" r="22" fill="#fff" stroke="#94a3b8" strokeWidth="1" />
            <polygon points="0,-16 -6,6 6,6" fill="#dc2626" />
            <text x="0" y="-4" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">N</text>
            <text x="0" y="20" textAnchor="middle" fontSize="10" fill="#64748b">{floorName}</text>
          </g>
        </svg>
      </div>

      {/* 图例 */}
      <div className="legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#059669' }} />
          正常测点
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#dc2626' }} />
          高危异常
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#d97706' }} />
          中危异常
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#2563eb' }} />
          低危异常
        </div>
        <div className="legend-item" style={{ marginLeft: 'auto', color: '#9ca3af' }}>
          点击测点查看详情
        </div>
      </div>
    </div>
  );
};

export default FloorPlan;
