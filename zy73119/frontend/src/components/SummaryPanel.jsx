import React from 'react';
import { FLOORS } from '../data/mockData';

const SummaryPanel = ({ stats, activeFloor, onSelectFloor, onJumpTo }) => {
  const cards = [
    { key: 'anomalies', label: '异常测点', value: stats.anomalies, level: 'warn', hint: '包含高/中/低三级', jump: 'anomaly' },
    { key: 'highAnomalies', label: '高危异常', value: stats.highAnomalies, level: 'danger', hint: '坐标偏移超限', jump: 'anomaly' },
    { key: 'offsetsExceed', label: '坐标超限', value: stats.offsetsExceed, level: 'danger', hint: '超 ±50mm 容差', jump: 'offset' },
    { key: 'materialGaps', label: '材料缺口', value: stats.materialGaps, level: 'warn', hint: '送审与现场不符', jump: 'material' },
    { key: 'pendingActions', label: '待处理动作', value: stats.pendingActions, level: 'info', hint: '需人跟进的操作', jump: 'action' },
    { key: 'closed', label: '已闭环', value: stats.closed, level: 'ok', hint: '处理完成', jump: null },
  ];

  return (
    <>
      <div className="panel-header">
        <span>📊 汇总统计</span>
      </div>
      <div className="panel-body">
        <div className="summary-list">
          {cards.map(card => (
            <div
              key={card.key}
              className={`summary-card ${card.level}`}
              onClick={() => card.jump && onJumpTo(card.jump)}
              title={card.jump ? '点击查看详情' : ''}
            >
              <div className="label">{card.label}</div>
              <div className="value">{card.value}</div>
              <div className="hint">{card.hint}{card.jump ? ' · 点击下钻' : ''}</div>
            </div>
          ))}
        </div>

        <div className="floor-selector">
          <h4>🏢 楼层选择</h4>
          <div className="floor-list">
            {FLOORS.map(f => (
              <div
                key={f.id}
                className={`floor-item ${f.id === activeFloor ? 'active' : ''}`}
                onClick={() => onSelectFloor(f.id)}
              >
                <span>{f.name}</span>
                <span className="count">{f.anomalyCount} 异常</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default SummaryPanel;
