import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Fixture, PatchEntry } from '../../shared/models/types';

interface FixturePanelProps {
  className?: string;
}

export const FixturePanel: React.FC<FixturePanelProps> = ({ className }) => {
  const { state } = useApp();
  const { project } = state;
  
  const [activeTab, setActiveTab] = useState<'fixtures' | 'patches'>('fixtures');

  const getPatchForFixture = (fixtureId: string): PatchEntry | undefined => {
    return project.patches.find(p => p.fixtureId === fixtureId);
  };

  const getFixtureForPatch = (patch: PatchEntry): Fixture | undefined => {
    return project.fixtures.find(f => f.id === patch.fixtureId);
  };

  const getFixtureTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      spot: '聚光灯',
      wash: '染色灯',
      par: 'PAR灯',
      moving: '摇头灯',
      led: 'LED灯',
      other: '其他'
    };
    return labels[type] || type;
  };

  return (
    <div className={`fixture-panel ${className || ''}`}>
      <div className="panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'fixtures' ? 'active' : ''}`}
          onClick={() => setActiveTab('fixtures')}
        >
          灯具 ({project.fixtures.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'patches' ? 'active' : ''}`}
          onClick={() => setActiveTab('patches')}
        >
          Patch ({project.patches.length})
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'fixtures' ? (
          <div className="fixtures-list">
            {project.fixtures.length === 0 ? (
              <div className="empty-state">
                暂无灯具，请从 JSON 文件导入
              </div>
            ) : (
              project.fixtures.map((fixture) => {
                const patch = getPatchForFixture(fixture.id);
                return (
                  <div key={fixture.id} className="fixture-card">
                    <div className="fixture-header">
                      <span className="fixture-name">{fixture.name}</span>
                      <span className={`fixture-type type-${fixture.type}`}>
                        {getFixtureTypeLabel(fixture.type)}
                      </span>
                    </div>
                    <div className="fixture-details">
                      <div className="detail-row">
                        <span className="detail-label">型号:</span>
                        <span className="detail-value">{fixture.model}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">厂商:</span>
                        <span className="detail-value">{fixture.manufacturer}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">通道:</span>
                        <span className="detail-value">{fixture.channelCount}ch</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">功率:</span>
                        <span className="detail-value">{fixture.power}{fixture.powerUnit}</span>
                      </div>
                      {patch && (
                        <div className="detail-row patch-info">
                          <span className="detail-label">Patch:</span>
                          <span className="detail-value">
                            U{patch.universe} Ch{patch.startChannel}-{patch.endChannel}
                          </span>
                        </div>
                      )}
                    </div>
                    {fixture.notes && (
                      <div className="fixture-notes">
                        {fixture.notes}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="patches-list">
            {project.patches.length === 0 ? (
              <div className="empty-state">
                暂无 Patch 配置，请从 JSON 文件导入
              </div>
            ) : (
              <div className="patches-table">
                <div className="patches-header">
                  <div className="col-patch">Patch</div>
                  <div className="col-fixture">灯具</div>
                  <div className="col-universe">Universe</div>
                  <div className="col-channels">通道</div>
                </div>
                {project.patches.map((patch) => {
                  const fixture = getFixtureForPatch(patch);
                  return (
                    <div key={patch.id} className="patch-row">
                      <div className="col-patch">{patch.patchName}</div>
                      <div className="col-fixture">
                        {fixture ? fixture.name : <span className="missing">未找到灯具</span>}
                      </div>
                      <div className="col-universe">{patch.universe}</div>
                      <div className="col-channels">
                        {patch.startChannel} - {patch.endChannel}
                        <span className="channel-count">
                          ({patch.endChannel - patch.startChannel + 1}ch)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .fixture-panel {
          display: flex;
          flex-direction: column;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
          height: 100%;
          overflow: hidden;
        }

        .panel-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
        }

        .tab-btn {
          flex: 1;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          transition: all 0.15s;
          border-bottom: 2px solid transparent;
        }

        .tab-btn:hover {
          color: var(--text-primary);
          background-color: var(--bg-tertiary);
        }

        .tab-btn.active {
          color: var(--accent-primary);
          border-bottom-color: var(--accent-primary);
          background-color: rgba(233, 69, 96, 0.05);
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .fixtures-list {
          padding: 8px;
        }

        .fixture-card {
          padding: 12px;
          margin-bottom: 8px;
          background-color: var(--bg-tertiary);
          border-radius: 6px;
          border: 1px solid var(--border-color);
        }

        .fixture-card:last-child {
          margin-bottom: 0;
        }

        .fixture-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .fixture-name {
          font-size: 14px;
          font-weight: 600;
        }

        .fixture-type {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .fixture-type.type-spot {
          background-color: rgba(233, 69, 96, 0.2);
          color: var(--accent-primary);
        }

        .fixture-type.type-wash {
          background-color: rgba(96, 165, 250, 0.2);
          color: var(--info);
        }

        .fixture-type.type-par {
          background-color: rgba(251, 191, 36, 0.2);
          color: var(--warning);
        }

        .fixture-type.type-moving {
          background-color: rgba(74, 222, 128, 0.2);
          color: var(--success);
        }

        .fixture-type.type-led {
          background-color: rgba(240, 138, 93, 0.2);
          color: var(--accent-secondary);
        }

        .fixture-type.type-other {
          background-color: var(--bg-primary);
          color: var(--text-secondary);
        }

        .fixture-details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px 12px;
          font-size: 12px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
        }

        .detail-label {
          color: var(--text-secondary);
        }

        .detail-value {
          font-weight: 500;
        }

        .patch-info {
          grid-column: span 2;
          background-color: var(--bg-primary);
          padding: 4px 8px;
          border-radius: 4px;
          margin-top: 4px;
        }

        .fixture-notes {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border-color);
          font-size: 11px;
          color: var(--text-secondary);
          font-style: italic;
        }

        .patches-list {
          padding: 8px;
        }

        .patches-table {
          display: flex;
          flex-direction: column;
        }

        .patches-header {
          display: flex;
          padding: 8px 12px;
          background-color: var(--bg-tertiary);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 4px 4px 0 0;
        }

        .col-patch { width: 30%; min-width: 80px; }
        .col-fixture { width: 30%; min-width: 100px; }
        .col-universe { width: 15%; min-width: 60px; text-align: center; }
        .col-channels { width: 25%; min-width: 100px; }

        .patch-row {
          display: flex;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-color);
          font-size: 12px;
          align-items: center;
        }

        .patch-row:hover {
          background-color: var(--bg-tertiary);
        }

        .patch-row:last-child {
          border-bottom: none;
          border-radius: 0 0 4px 4px;
        }

        .missing {
          color: var(--error);
          font-style: italic;
        }

        .channel-count {
          margin-left: 4px;
          color: var(--text-secondary);
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};
