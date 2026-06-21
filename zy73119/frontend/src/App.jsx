import React, { useState, useMemo, useCallback, useEffect } from 'react';
import FloorPlan from './components/FloorPlan';
import SummaryPanel from './components/SummaryPanel';
import AnomalyDetail from './components/AnomalyDetail';
import MaterialHistory from './components/MaterialHistory';
import ActionPanel from './components/ActionPanel';
import {
  STANDARD,
  FLOOR_DATA,
  FLOORS,
  computeStats,
  ANOMALY_TRACES,
  MATERIAL_HISTORY,
  ACTION_DEFS,
} from './data/mockData';
import { generateCsv, downloadCsv } from './utils/csvExport';

const App = () => {
  const [activeFloor, setActiveFloor] = useState('3F');
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [detailTab, setDetailTab] = useState('anomaly'); // anomaly | material | action
  const [filterType, setFilterType] = useState(null); // null | anomaly | offset | material | action

  const floorData = useMemo(() => FLOOR_DATA[activeFloor] || { rooms: [], points: [] }, [activeFloor]);

  const stats = useMemo(() => computeStats(), []);

  const handleSelectFloor = useCallback((floorId) => {
    setActiveFloor(floorId);
    setSelectedPoint(null);
    setFilterType(null);
  }, []);

  const handleSelectPoint = useCallback((point) => {
    setSelectedPoint(point);
  }, []);

  const handleJumpTo = useCallback((jumpType) => {
    setFilterType(jumpType);
    // 找一个对应类型的楼层和测点
    const allPoints = Object.values(FLOOR_DATA).flatMap(f => f.points);
    let target = null;
    let targetFloor = null;

    if (jumpType === 'anomaly') {
      target = allPoints.find(p => p.hasAnomaly);
    } else if (jumpType === 'offset') {
      target = allPoints.find(p => p.offset?.exceeds);
    } else if (jumpType === 'material') {
      target = allPoints.find(p => p.anomalyType === '材料不符');
    } else if (jumpType === 'action') {
      target = allPoints.find(p => (p.actionItems?.length || 0) > 0);
    }

    if (target) {
      targetFloor = target.floorId;
      setActiveFloor(targetFloor);
      setSelectedPoint(target);
      if (jumpType === 'material') setDetailTab('material');
      else if (jumpType === 'action') setDetailTab('action');
      else setDetailTab('anomaly');
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    const content = generateCsv(activeFloor, filterType);
    const timestamp = new Date().toISOString().slice(0, 10);
    const floorStr = activeFloor ? `-${activeFloor}` : '';
    downloadCsv(content, `旧楼测绘交底清单_${STANDARD.version}${floorStr}_${timestamp}.csv`);
  }, [activeFloor, filterType]);

  // 选中第一个测点（演示用）
  useEffect(() => {
    if (!selectedPoint && floorData.points.length > 0) {
      const firstAnomaly = floorData.points.find(p => p.hasAnomaly);
      setSelectedPoint(firstAnomaly || floorData.points[0]);
    }
  }, [activeFloor, floorData.points]);

  const floorName = FLOORS.find(f => f.id === activeFloor)?.name || '';

  const tabs = [
    { key: 'anomaly', label: '异常详情', icon: '⚠️' },
    { key: 'material', label: '材料送审', icon: '📋' },
    { key: 'action', label: '处置动作', icon: '🎯' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* 顶部 */}
      <header className="app-header">
        <div>
          <h1>🏗️ 旧楼测绘交底清单 · 现场测绘交底工作台</h1>
          <div className="subtitle">
            BIM 协调 · 异常追溯 · 材料送审历史 · 坐标偏移处理
          </div>
        </div>
        <div className="header-right">
          <div className="standard-info">
            <div>
              <span className="standard-version">口径 {STANDARD.version}</span>
            </div>
            <div style={{ fontSize: '11px', opacity: '0.8' }}>
              {STANDARD.desc.length > 28 ? STANDARD.desc.slice(0, 28) + '…' : STANDARD.desc}
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleExportCsv}>
            📥 导出 CSV
          </button>
        </div>
      </header>

      {/* 主区域 */}
      <main className="app-main">
        {/* 左：汇总 */}
        <aside className="left-panel">
          <SummaryPanel
            stats={stats}
            activeFloor={activeFloor}
            onSelectFloor={handleSelectFloor}
            onJumpTo={handleJumpTo}
          />
        </aside>

        {/* 中：平面图 */}
        <section className="center-panel">
          <div className="panel-header">
            <span>🗺️ {floorName} · 空间视图</span>
            {filterType && (
              <span className="badge badge-mid">
                筛选：{filterType === 'anomaly' ? '异常测点' :
                  filterType === 'offset' ? '坐标超限' :
                  filterType === 'material' ? '材料缺口' : '待处理动作'}
                <button
                  style={{
                    marginLeft: '8px', background: 'transparent', border: 'none',
                    color: '#92400e', cursor: 'pointer', fontSize: '12px',
                  }}
                  onClick={() => setFilterType(null)}
                >
                  ✕ 清除
                </button>
              </span>
            )}
          </div>
          <div className="panel-body" style={{ padding: '12px', display: 'flex', flexDirection: 'column' }}>
            <FloorPlan
              rooms={floorData.rooms}
              points={floorData.points}
              selectedPoint={selectedPoint}
              onSelectPoint={handleSelectPoint}
              floorName={floorName}
            />
          </div>
        </section>

        {/* 右：详情 */}
        <aside className="right-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="detail-tabs">
            {tabs.map(tab => (
              <div
                key={tab.key}
                className={`detail-tab ${detailTab === tab.key ? 'active' : ''}`}
                onClick={() => setDetailTab(tab.key)}
              >
                {tab.icon} {tab.label}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {detailTab === 'anomaly' && <AnomalyDetail point={selectedPoint} />}
            {detailTab === 'material' && <MaterialHistory point={selectedPoint} />}
            {detailTab === 'action' && (
              <ActionPanel
                point={selectedPoint}
                onActionDone={() => {
                  // 触发重渲染
                  setSelectedPoint({ ...selectedPoint });
                }}
              />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
