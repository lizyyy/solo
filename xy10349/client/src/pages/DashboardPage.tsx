import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DashboardData, AbsentAlert } from '../types';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<AbsentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [dashData, alertData] = await Promise.all([
        api.getDashboard(),
        api.getAbsentAlerts(),
      ]);
      setDashboard(dashData);
      setAlerts(alertData);
    } catch (e) {
      console.error('加载数据失败', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !dashboard) {
    return <div className="loading"><div className="spinner"></div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">集合点看板</h1>
        <p className="page-subtitle">实时监控各集合点名状态，异常情况一目了然</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">总学生数</div>
          <div className="stat-value">{dashboard.totalStudents}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">缺勤学生</div>
          <div className="stat-value">{dashboard.absentCount}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">待审批请假</div>
          <div className="stat-value">{dashboard.pendingLeaves}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">集合点数量</div>
          <div className="stat-value">{dashboard.meetingPoints.length}</div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">⚠️ 缺勤告警</h2>
            <span className="badge badge-absent">{alerts.length} 条</span>
          </div>
          {alerts.map(alert => (
            <div key={alert.student.id} className="alert-item">
              <span className="alert-icon">!</span>
              <div className="alert-content">
                <h4>{alert.student.name} ({alert.student.studentId})</h4>
                <p>
                  {alert.lastStatus === 'unknown'
                    ? '尚未进行任何点名登记'
                    : `最后状态：${alert.lastStatus === 'absent' ? '缺勤' : alert.lastStatus}`
                  }
                  {alert.lastMeetingPoint && ` · ${alert.lastMeetingPoint.name}`}
                  {alert.lastTime && ` · ${new Date(alert.lastTime).toLocaleString()}`}
                </p>
                <p className="mt-1">
                  联系电话：{alert.student.phone} | 紧急联系人：{alert.student.emergencyContact}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">集合点状态</h2>
        </div>
        <div className="meeting-points-grid">
          {dashboard.meetingPoints.map(mp => (
            <div key={mp.id} className="meeting-point-card">
              <h3>📍 {mp.name}</h3>
              <div className="location">{mp.location}</div>
              {mp.description && <div className="location">{mp.description}</div>}

              <div className="attendance-bars">
                {mp.presentCount > 0 && (
                  <div className="bar-present" style={{ flex: mp.presentCount }}></div>
                )}
                {mp.absentCount > 0 && (
                  <div className="bar-absent" style={{ flex: mp.absentCount }}></div>
                )}
                {mp.leaveCount > 0 && (
                  <div className="bar-leave" style={{ flex: mp.leaveCount }}></div>
                )}
                {mp.lateCount > 0 && (
                  <div className="bar-late" style={{ flex: mp.lateCount }}></div>
                )}
                <div className="bar-empty"></div>
              </div>

              <div className="status-summary">
                <div className="status-item">
                  <span className="status-dot present"></span>
                  到岗 {mp.presentCount}
                </div>
                <div className="status-item">
                  <span className="status-dot absent"></span>
                  缺勤 {mp.absentCount}
                </div>
                <div className="status-item">
                  <span className="status-dot leave"></span>
                  请假 {mp.leaveCount}
                </div>
                <div className="status-item">
                  <span className="status-dot late"></span>
                  迟到 {mp.lateCount}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
