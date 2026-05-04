import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Risk, RiskType } from '../types';
import { api } from '../services/api';

const riskTypeLabels: Record<RiskType, string> = {
  altitude_too_low: '地平高度不足',
  moon_interference: '月光干扰',
  battery_low: '设备电量不足',
  device_conflict: '设备冲突',
  window_conflict: '观测窗口冲突',
};

const riskTypeIcons: Record<RiskType, string> = {
  altitude_too_low: '📐',
  moon_interference: '🌙',
  battery_low: '🔋',
  device_conflict: '⚠️',
  window_conflict: '📅',
};

export default function RisksPage() {
  const {
    risks,
    sites,
    targets,
    windows,
    devices,
    fetchRisks,
    addRisks,
    updateRisk,
  } = useAppStore((state) => ({
    risks: state.risks,
    sites: state.sites,
    targets: state.targets,
    windows: state.windows,
    devices: state.devices,
    fetchRisks: state.fetchRisks,
    addRisks: state.addRisks,
    updateRisk: state.updateRisk,
  }));

  const [selectedSite, setSelectedSite] = useState<string>('');
  const [detecting, setDetecting] = useState(false);
  const [filterTarget, setFilterTarget] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [overrideRisk, setOverrideRisk] = useState<Risk | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideBy, setOverrideBy] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  useEffect(() => {
    if (sites.length > 0 && !selectedSite) {
      setSelectedSite(sites[0].id);
    }
  }, [sites, selectedSite]);

  const handleDetectRisks = async () => {
    if (targets.length === 0 || windows.length === 0 || devices.length === 0) {
      setMessage({
        type: 'error',
        text: '请先导入目标天体、观测窗口和设备数据',
      });
      return;
    }

    if (!selectedSite && sites.length > 0) {
      setSelectedSite(sites[0].id);
    }

    const site = sites.find((s) => s.id === selectedSite);
    if (!site) {
      setMessage({ type: 'error', text: '请选择观测点' });
      return;
    }

    setDetecting(true);
    setMessage(null);

    try {
      const detectedRisks = await api.detectRisks({
        windows,
        targets,
        devices,
        site,
      });
      addRisks(detectedRisks);
      setMessage({
        type: 'success',
        text: `检测完成，共发现 ${detectedRisks.length} 项风险`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: '风险检测失败' });
    } finally {
      setDetecting(false);
    }
  };

  const handleOverrideRisk = async () => {
    if (!overrideRisk) return;

    try {
      const updatedRisk = await api.overrideRisk(overrideRisk.id, {
        isOverridden: true,
        overrideReason: overrideReason || undefined,
        overrideBy: overrideBy || undefined,
      });
      updateRisk(updatedRisk);
      setMessage({ type: 'success', text: '风险已手动驳回' });
      setOverrideRisk(null);
      setOverrideReason('');
      setOverrideBy('');
    } catch (error) {
      setMessage({ type: 'error', text: '操作失败' });
    }
  };

  const handleRestoreRisk = async (risk: Risk) => {
    try {
      const updatedRisk = await api.overrideRisk(risk.id, {
        isOverridden: false,
      });
      updateRisk(updatedRisk);
      setMessage({ type: 'success', text: '风险已恢复' });
    } catch (error) {
      setMessage({ type: 'error', text: '操作失败' });
    }
  };

  const filteredRisks = risks.filter((risk) => {
    if (filterTarget !== 'all' && risk.targetName !== filterTarget) return false;
    if (filterSeverity !== 'all' && risk.severity !== filterSeverity) return false;
    if (filterType !== 'all' && risk.type !== filterType) return false;
    return true;
  });

  const activeRisks = filteredRisks.filter((r) => !r.isOverridden);
  const overriddenRisks = filteredRisks.filter((r) => r.isOverridden);

  const uniqueTargets = [...new Set(risks.map((r) => r.targetName))];

  const stats = {
    critical: { total: 0, active: 0, overridden: 0 },
    warning: { total: 0, active: 0, overridden: 0 },
    info: { total: 0, active: 0, overridden: 0 },
  };

  for (const risk of risks) {
    const s = stats[risk.severity as keyof typeof stats];
    s.total++;
    if (risk.isOverridden) s.overridden++;
    else s.active++;
  }

  return (
    <div className="risks-page">
      <div className="page-header">
        <h2>⚠️ 风险检测</h2>
        <div className="header-actions">
          {sites.length > 0 && (
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="site-selector"
            >
              <option value="">选择观测点</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="primary-button detect-button"
            onClick={handleDetectRisks}
            disabled={detecting}
          >
            {detecting ? '🔄 检测中...' : '🔍 运行风险检测'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      {risks.length > 0 && (
        <div className="risk-stats">
          <div className="stat-item critical">
            <span className="stat-label">🔴 严重</span>
            <span className="stat-count">{stats.critical.active}</span>
            {stats.critical.overridden > 0 && (
              <span className="stat-overridden">({stats.critical.overridden} 已驳回)</span>
            )}
          </div>
          <div className="stat-item warning">
            <span className="stat-label">🟡 警告</span>
            <span className="stat-count">{stats.warning.active}</span>
            {stats.warning.overridden > 0 && (
              <span className="stat-overridden">({stats.warning.overridden} 已驳回)</span>
            )}
          </div>
          <div className="stat-item info">
            <span className="stat-label">ℹ️ 信息</span>
            <span className="stat-count">{stats.info.active}</span>
            {stats.info.overridden > 0 && (
              <span className="stat-overridden">({stats.info.overridden} 已驳回)</span>
            )}
          </div>
        </div>
      )}

      {risks.length > 0 && (
        <div className="filters">
          <h3>筛选条件</h3>
          <div className="filter-row">
            <div className="filter-item">
              <label>目标天体</label>
              <select
                value={filterTarget}
                onChange={(e) => setFilterTarget(e.target.value)}
              >
                <option value="all">全部</option>
                {uniqueTargets.map((target) => (
                  <option key={target} value={target}>
                    {target}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label>严重程度</label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
              >
                <option value="all">全部</option>
                <option value="critical">🔴 严重</option>
                <option value="warning">🟡 警告</option>
                <option value="info">ℹ️ 信息</option>
              </select>
            </div>
            <div className="filter-item">
              <label>风险类型</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">全部</option>
                {(Object.keys(riskTypeLabels) as RiskType[]).map((type) => (
                  <option key={type} value={type}>
                    {riskTypeLabels[type]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {overrideRisk && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setOverrideRisk(null)}>
          <div className="modal override-modal">
            <h3>手动驳回风险</h3>
            <div className="risk-preview">
              <p><strong>目标:</strong> {overrideRisk.targetName}</p>
              <p><strong>类型:</strong> {riskTypeLabels[overrideRisk.type]}</p>
              <p><strong>严重程度:</strong> {overrideRisk.severity === 'critical' ? '严重' : overrideRisk.severity === 'warning' ? '警告' : '信息'}</p>
              <p><strong>风险描述:</strong> {overrideRisk.message}</p>
            </div>
            <div className="form-group">
              <label>驳回人</label>
              <input
                type="text"
                value={overrideBy}
                onChange={(e) => setOverrideBy(e.target.value)}
                placeholder="例如：张三"
              />
            </div>
            <div className="form-group">
              <label>驳回理由</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="请说明驳回此风险的理由..."
                rows={3}
              />
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOverrideRisk(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleOverrideRisk}
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      {risks.length === 0 ? (
        <div className="empty-state">
          <p>暂无风险数据</p>
          <p>请确保已导入目标天体、观测窗口和设备数据，然后点击"运行风险检测"按钮</p>
        </div>
      ) : (
        <div className="risks-content">
          {activeRisks.length > 0 && (
            <div className="risks-section">
              <h3>🚨 待处理风险 ({activeRisks.length})</h3>
              <div className="risks-list">
                {activeRisks.map((risk) => (
                  <div key={risk.id} className={`risk-card ${risk.severity}`}>
                    <div className="risk-header">
                      <div className="risk-type-badge">
                        {riskTypeIcons[risk.type]} {riskTypeLabels[risk.type]}
                      </div>
                      <span className={`severity-badge ${risk.severity}`}>
                        {risk.severity === 'critical' ? '🔴 严重' : risk.severity === 'warning' ? '🟡 警告' : 'ℹ️ 信息'}
                      </span>
                    </div>
                    <div className="risk-target">
                      <strong>{risk.targetName}</strong>
                    </div>
                    <p className="risk-message">{risk.message}</p>
                    <div className="risk-actions">
                      <button
                        className="action-button override"
                        onClick={() => setOverrideRisk(risk)}
                      >
                        手动驳回
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {overriddenRisks.length > 0 && (
            <div className="risks-section overridden-section">
              <h3>✅ 已手动驳回的风险 ({overriddenRisks.length})</h3>
              <div className="risks-list">
                {overriddenRisks.map((risk) => (
                  <div key={risk.id} className="risk-card overridden">
                    <div className="risk-header">
                      <div className="risk-type-badge">
                        {riskTypeIcons[risk.type]} {riskTypeLabels[risk.type]}
                      </div>
                      <span className="severity-badge overridden">
                        已驳回
                      </span>
                    </div>
                    <div className="risk-target">
                      <strong>{risk.targetName}</strong>
                    </div>
                    <p className="risk-message">{risk.message}</p>
                    {risk.overrideReason && (
                      <p className="override-info">
                        <em>驳回理由: {risk.overrideReason}</em>
                      </p>
                    )}
                    {risk.overrideBy && (
                      <p className="override-info">
                        <em>驳回人: {risk.overrideBy}</em>
                      </p>
                    )}
                    <div className="risk-actions">
                      <button
                        className="action-button restore"
                        onClick={() => handleRestoreRisk(risk)}
                      >
                        恢复风险
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeRisks.length === 0 && overriddenRisks.length > 0 && (
            <div className="all-clear">
              <p>🎉 所有风险已处理完毕！</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
