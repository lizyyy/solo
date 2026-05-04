import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { RiskType } from '../types';
import { Link } from 'react-router-dom';

const riskTypeLabels: Record<RiskType, string> = {
  altitude_too_low: '地平高度不足',
  moon_interference: '月光干扰',
  battery_low: '设备电量不足',
  device_conflict: '设备冲突',
  window_conflict: '观测窗口冲突',
};

export default function Dashboard() {
  const {
    sites,
    devices,
    targets,
    windows,
    risks,
    riskSummary,
    loading,
    fetchRiskSummary,
  } = useAppStore((state) => ({
    sites: state.sites,
    devices: state.devices,
    targets: state.targets,
    windows: state.windows,
    risks: state.risks,
    riskSummary: state.riskSummary,
    loading: state.loading,
    fetchRiskSummary: state.fetchRiskSummary,
  }));

  useEffect(() => {
    fetchRiskSummary();
  }, [fetchRiskSummary]);

  const criticalRisks = risks.filter((r) => r.severity === 'critical' && !r.isOverridden);
  const warningRisks = risks.filter((r) => r.severity === 'warning' && !r.isOverridden);

  const lowBatteryDevices = devices.filter((d) => d.batteryLevel < 30);
  const unavailableDevices = devices.filter((d) => !d.isAvailable);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="dashboard">
      <h2>📊 仪表盘</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>🌍 观测地点</h3>
          <p className="stat-value">{sites.length}</p>
        </div>

        <div className="stat-card">
          <h3>🔧 设备数量</h3>
          <p className="stat-value">{devices.length}</p>
          {lowBatteryDevices.length > 0 && (
            <p className="stat-warning">
              {lowBatteryDevices.length} 台设备电量不足
            </p>
          )}
          {unavailableDevices.length > 0 && (
            <p className="stat-warning">
              {unavailableDevices.length} 台设备不可用
            </p>
          )}
        </div>

        <div className="stat-card">
          <h3>🎯 观测目标</h3>
          <p className="stat-value">{targets.length}</p>
        </div>

        <div className="stat-card">
          <h3>📅 观测窗口</h3>
          <p className="stat-value">{windows.length}</p>
        </div>
      </div>

      <div className="risks-section">
        <h3>⚠️ 风险状态</h3>
        <div className="risk-summary">
          <div className="risk-item critical">
            <span className="risk-label">🔴 严重风险</span>
            <span className="risk-count">{criticalRisks.length}</span>
          </div>
          <div className="risk-item warning">
            <span className="risk-label">🟡 警告</span>
            <span className="risk-count">{warningRisks.length}</span>
          </div>
        </div>

        {riskSummary && Object.keys(riskSummary.byType).length > 0 && (
          <div className="risk-types">
            <h4>按风险类型统计</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>风险类型</th>
                  <th>总数</th>
                  <th>待处理</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(riskSummary.byType).map(([type, data]) => (
                  <tr key={type}>
                    <td>{riskTypeLabels[type as RiskType] || type}</td>
                    <td>{data.total}</td>
                    <td className={data.total - data.overridden > 0 ? 'text-warning' : ''}>
                      {data.total - data.overridden}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {criticalRisks.length > 0 && (
          <div className="critical-risks">
            <h4>🚨 紧急风险 (需要立即处理)</h4>
            <div className="risk-list">
              {criticalRisks.slice(0, 5).map((risk) => (
                <div key={risk.id} className="risk-card critical">
                  <div className="risk-header">
                    <span className="risk-target">{risk.targetName}</span>
                    <span className="risk-type">
                      {riskTypeLabels[risk.type] || risk.type}
                    </span>
                  </div>
                  <p className="risk-message">{risk.message}</p>
                </div>
              ))}
            </div>
            <Link to="/risks" className="view-all-link">
              查看所有风险 →
            </Link>
          </div>
        )}
      </div>

      {devices.length > 0 && (
        <div className="devices-section">
          <h3>🔋 设备状态概览</h3>
          <div className="devices-grid">
            {devices.slice(0, 8).map((device) => (
              <div key={device.id} className="device-mini-card">
                <div className="device-name">{device.name}</div>
                <div className="device-type">{getDeviceTypeLabel(device.type)}</div>
                <div className={`battery-indicator ${getBatteryStatus(device.batteryLevel)}`}>
                  电量: {device.batteryLevel}%
                </div>
                <div className={`availability ${device.isAvailable ? 'available' : 'unavailable'}`}>
                  {device.isAvailable ? '✅ 可用' : '❌ 不可用'}
                </div>
              </div>
            ))}
          </div>
          {devices.length > 8 && (
            <Link to="/devices" className="view-all-link">
              查看所有设备 →
            </Link>
          )}
        </div>
      )}

      <div className="quick-actions">
        <h3>⚡ 快速操作</h3>
        <div className="action-buttons">
          <Link to="/import" className="action-button import">
            📁 导入数据
          </Link>
          <Link to="/risks" className="action-button detect">
            🔍 运行风险检测
          </Link>
          <Link to="/export" className="action-button export">
            📤 导出报告
          </Link>
        </div>
      </div>
    </div>
  );
}

function getDeviceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    telescope: '望远镜',
    camera: '相机',
    mount: '赤道仪',
    filter: '滤镜',
  };
  return labels[type] || type;
}

function getBatteryStatus(level: number): string {
  if (level < 30) return 'low';
  if (level < 60) return 'medium';
  return 'high';
}
