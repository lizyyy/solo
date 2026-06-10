import React, { useState, useEffect } from 'react';
import api, { setOperator, endpoints } from './api';
import OverviewPage from './components/OverviewPage';
import MaterialsPage from './components/MaterialsPage';
import CollisionsPage from './components/CollisionsPage';
import MinutesPage from './components/MinutesPage';
import DecisionsPanel from './components/DecisionsPanel';

const TABS = [
  { key: 'overview', label: '📊 概览与决策' },
  { key: 'materials', label: '📋 材料复核' },
  { key: 'collisions', label: '💥 碰撞点管理' },
  { key: 'minutes', label: '📝 会议纪要' }
];

export default function App() {
  const [tab, setTab] = useState('overview');
  const [operator, setOperatorName] = useState(localStorage.getItem('operator') || '老叶');
  const [health, setHealth] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  const checkHealth = async () => {
    try {
      const res = await api.get(endpoints.health);
      setHealth(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkHealth();
    const t = setInterval(checkHealth, 30000);
    return () => clearInterval(t);
  }, []);

  const changeOperator = (e) => {
    const v = e.target.value;
    setOperatorName(v);
    if (v) {
      localStorage.setItem('operator', v);
      setOperator(v);
    }
  };

  const bootstrap = async () => {
    if (!confirm('将初始化示例数据（材料/纪要/碰撞），确认？')) return;
    try {
      await api.post(endpoints.bootstrap);
      alert('示例数据初始化完成，请刷新各面板');
      checkHealth();
    } catch (e) { alert(e.message); }
  };

  const jumpToMaterial = (matItem) => {
    const id = (matItem && typeof matItem === 'object')
      ? (matItem.materialId || null)
      : (typeof matItem === 'string' ? matItem : null);
    setSelectedMaterial(id);
    setTab('materials');
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>
            <span>🏗</span>
            日照体量材料追踪
          </h1>
          <div className="subtitle">
            结构工程师复核工作台 · 会议纪要来源可追溯 · 碰撞点不重复 · 决策直接说人话
          </div>
        </div>
        <div className="header-actions">
          <input
            className="operator-input"
            placeholder="当前复核人"
            value={operator}
            onChange={changeOperator}
          />
          {health && (
            <span style={{fontSize: 12, opacity: 0.8}}>
              {health.counts?.materials || 0}材料 / {health.counts?.collisionPoints || 0}碰撞
              {health.lastUpdated && <span style={{opacity:0.6}}> · {health.lastUpdated.slice(0,10)}</span>}
            </span>
          )}
          <button className="btn btn-sm" onClick={bootstrap} title="初始化示例数据">初始化数据</button>
        </div>
      </header>

      <div className="tabs">
        {TABS.map(t => (
          <div
          key={t.key}
          className={`tab ${tab===t.key?'active':''}`}
          onClick={() => { setTab(t.key); setSelectedMaterial(null); }}
        >
          {t.label}
        </div>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewPage onJumpMaterial={jumpToMaterial} />
      )}
      {tab === 'materials' && (
        <MaterialsPage
          selectedMaterialId={selectedMaterial}
          onCloseDetail={() => setSelectedMaterial(null)}
        />
      )}
      {tab === 'collisions' && <CollisionsPage />}
      {tab === 'minutes' && (
        <MinutesPage
          onLinkedMaterial={(item) => item?.materialNo && jumpToMaterial(item)}
        />
      )}
    </div>
  );
}
