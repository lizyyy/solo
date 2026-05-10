import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ExportReport, AttendanceStatus } from '../types';

export default function ReportsPage() {
  const [report, setReport] = useState<ExportReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      const data = await api.getReport();
      setReport(data);
    } catch (e) {
      console.error('加载报表失败', e);
    } finally {
      setLoading(false);
    }
  }

  function statusLabel(s: AttendanceStatus): string {
    switch (s) {
      case 'present': return '到岗';
      case 'absent': return '缺勤';
      case 'leave': return '请假';
      case 'late': return '迟到';
    }
  }

  function statusBadgeClass(s: AttendanceStatus): string {
    switch (s) {
      case 'present': return 'badge-present';
      case 'absent': return 'badge-absent';
      case 'leave': return 'badge-leave';
      case 'late': return 'badge-late';
    }
  }

  function exceptionLabel(type: 'rule_intercept' | 'data_missing' | 'status_conflict' | null): string {
    switch (type) {
      case 'rule_intercept': return '规则拦截';
      case 'data_missing': return '数据缺失';
      case 'status_conflict': return '状态冲突';
      default: return '正常';
    }
  }

  function exceptionBadgeClass(type: 'rule_intercept' | 'data_missing' | 'status_conflict' | null): string {
    switch (type) {
      case 'rule_intercept': return 'badge-rule';
      case 'data_missing': return 'badge-data';
      case 'status_conflict': return 'badge-conflict';
      default: return 'badge-present';
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div>加载中...</div>;
  }

  if (!report) {
    return <div className="empty-state"><p>无法加载报表数据</p></div>;
  }

  const totalPresent = report.meetingPoints.reduce((sum, mp) => sum + mp.presentCount, 0);
  const totalAbsent = report.meetingPoints.reduce((sum, mp) => sum + mp.absentCount, 0);
  const totalLeave = report.meetingPoints.reduce((sum, mp) => sum + mp.leaveCount, 0);
  const totalLate = report.meetingPoints.reduce((sum, mp) => sum + mp.lateCount, 0);
  const totalExceptions = report.meetingPoints.reduce(
    (sum, mp) => sum + mp.students.filter(s => s.exceptionType !== null).length, 0
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">带队报表</h1>
        <p className="page-subtitle">
          活动：{report.activityName} · 日期：{report.activityDate}
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">导出报表</h2>
          <div className="btn-group">
            <button className="btn btn-outline" onClick={loadReport}>
              🔄 刷新
            </button>
            <button className="btn btn-primary" onClick={() => api.downloadCSV()}>
              📥 导出 CSV
            </button>
          </div>
        </div>

        <div className="info-message mb-4">
          <strong>📋 报表说明：</strong>
          本报表汇总各集合点的点名数据，包含异常情况及其处理动作。异常类型分为：
          <span className="badge badge-rule" style={{ marginLeft: '0.5rem' }}>规则拦截</span>
          <span className="badge badge-data" style={{ marginLeft: '0.25rem' }}>数据缺失</span>
          <span className="badge badge-conflict" style={{ marginLeft: '0.25rem' }}>状态冲突</span>
        </div>

        <div className="stats-grid">
          <div className="stat-card blue">
            <div className="stat-label">集合点数量</div>
            <div className="stat-value">{report.meetingPoints.length}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">总到岗人数</div>
            <div className="stat-value">{totalPresent}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">缺勤 / 迟到</div>
            <div className="stat-value">{totalAbsent + totalLate}</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-label">异常记录</div>
            <div className="stat-value">{totalExceptions}</div>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>集合点</th>
                <th>点名人数</th>
                <th>到岗</th>
                <th>缺勤</th>
                <th>请假</th>
                <th>迟到</th>
              </tr>
            </thead>
            <tbody>
              {report.meetingPoints.map(mp => (
                <tr key={mp.id}>
                  <td><strong>{mp.name}</strong></td>
                  <td>{mp.totalStudents}</td>
                  <td>
                    <span className="badge badge-present">{mp.presentCount}</span>
                  </td>
                  <td>
                    <span className="badge badge-absent">{mp.absentCount}</span>
                  </td>
                  <td>
                    <span className="badge badge-leave">{mp.leaveCount}</span>
                  </td>
                  <td>
                    <span className="badge badge-late">{mp.lateCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {report.meetingPoints.map(mp => {
        const exceptions = mp.students.filter(s => s.exceptionType !== null);
        return (
          <div key={mp.id} className="card">
            <div className="card-header">
              <h2 className="card-title">📍 {mp.name}</h2>
              {exceptions.length > 0 && (
                <span className="badge badge-absent">
                  {exceptions.length} 条异常
                </span>
              )}
            </div>

            {mp.students.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>学号</th>
                      <th>姓名</th>
                      <th>状态</th>
                      <th>处理动作</th>
                      <th>异常类型</th>
                      <th>原始输入</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mp.students.map((s, idx) => (
                      <tr key={idx} style={{
                        background: s.exceptionType ? '#fff5f5' : 'transparent'
                      }}>
                        <td>{s.studentId}</td>
                        <td>
                          <div className="student-row">
                            <span className="student-avatar">{s.name[0]}</span>
                            {s.name}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${statusBadgeClass(s.status)}`}>
                            {statusLabel(s.status)}
                          </span>
                        </td>
                        <td>{s.actionTaken}</td>
                        <td>
                          <span className={`badge ${exceptionBadgeClass(s.exceptionType)}`}>
                            {exceptionLabel(s.exceptionType)}
                          </span>
                        </td>
                        <td style={{ maxWidth: '250px' }}>
                          {s.rawInput ? (
                            <span style={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              background: '#f9fafb',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              display: 'inline-block',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }} title={s.rawInput}>
                              {s.rawInput.length > 60 ? s.rawInput.slice(0, 60) + '...' : s.rawInput}
                            </span>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>该集合点暂无点名记录</p>
              </div>
            )}
          </div>
        );
      })}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">异常类型说明</h2>
        </div>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div style={{ padding: '1rem', background: '#fff1f2', borderRadius: '8px', borderLeft: '4px solid #ec4899' }}>
            <h4 style={{ color: '#9f1239', marginBottom: '0.5rem' }}>🚫 规则拦截 (rule_intercept)</h4>
            <p style={{ fontSize: '0.875rem', color: '#831843' }}>
              操作违反业务规则被系统拦截。例如：标记请假但请假申请未批准，或缺勤后直接标记为安全。
            </p>
          </div>
          <div style={{ padding: '1rem', background: '#fff7ed', borderRadius: '8px', borderLeft: '4px solid #f97316' }}>
            <h4 style={{ color: '#9a3412', marginBottom: '0.5rem' }}>⚠️ 数据缺失 (data_missing)</h4>
            <p style={{ fontSize: '0.875rem', color: '#7c2d12' }}>
              引用的数据不存在。例如：学生ID不存在、集合点不存在、或导入时缺少必要字段。
            </p>
          </div>
          <div style={{ padding: '1rem', background: '#eef2ff', borderRadius: '8px', borderLeft: '4px solid #6366f1' }}>
            <h4 style={{ color: '#3730a3', marginBottom: '0.5rem' }}>⚡ 状态冲突 (status_conflict)</h4>
            <p style={{ fontSize: '0.875rem', color: '#312e81' }}>
              操作与已有状态冲突。例如：已标记缺勤的学生不能直接改为安全状态。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
