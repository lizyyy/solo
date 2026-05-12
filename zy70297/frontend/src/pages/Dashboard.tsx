import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ReportData } from '../types';
import {
  merchantStatusLabels,
  merchantStatusColors,
  problemTypeLabels,
  formatDate,
  statusLabels,
  statusColors,
  priorityLabels,
  priorityColors,
} from '../utils';

export default function Dashboard() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      const data = await api.getReport();
      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  if (error) {
    return (
      <div className="card">
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-primary" onClick={loadReport}>
          重试
        </button>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div>
      <div className="rule-box mb-4">
        <h4>📋 业务规则说明</h4>
        <ul>
          <li>
            <span>整改复查周期：</span>
            <strong>
              软管({report.rules.rectificationDays.hose}天) → 报警器({report.rules.rectificationDays.alarm}天) → 阀门({report.rules.rectificationDays.valve}天)
            </strong>
          </li>
          <li>
            <span>停气触发条件：</span>
            <strong>连续{report.rules.gasCutOffAfterFailedReviews}次复查不通过</strong>
          </li>
        </ul>
      </div>

      <div className="grid grid-4 mb-6">
        <div className="stat-card">
          <div className="number">{report.stats.totalMerchants}</div>
          <div className="label">商户总数</div>
        </div>
        <div className="stat-card">
          <div className="number" style={{ color: '#22c55e' }}>
            {report.stats.normalMerchants}
          </div>
          <div className="label">正常商户</div>
        </div>
        <div className="stat-card">
          <div className="number" style={{ color: '#f59e0b' }}>
            {report.stats.warningMerchants}
          </div>
          <div className="label">整改中商户</div>
        </div>
        <div className="stat-card">
          <div className="number" style={{ color: '#dc2626' }}>
            {report.stats.gasCutOffMerchants}
          </div>
          <div className="label">已停气商户</div>
        </div>
      </div>

      <div className="grid grid-2 mb-6">
        <div className="card">
          <h2>整改任务统计</h2>
          <div className="grid grid-3" style={{ gap: '1rem' }}>
            <div className="stat-card">
              <div className="number">{report.stats.totalTasks}</div>
              <div className="label">总任务数</div>
            </div>
            <div className="stat-card">
              <div className="number" style={{ color: '#f59e0b' }}>
                {report.stats.overdueTasks}
              </div>
              <div className="label">逾期任务</div>
            </div>
            <div className="stat-card">
              <div className="number" style={{ color: '#22c55e' }}>
                {report.stats.tasksByStatus.completed || 0}
              </div>
              <div className="label">已完成</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>问题类型分布</h2>
          <div className="grid grid-3" style={{ gap: '1rem' }}>
            {Object.entries(report.stats.tasksByType).map(([type, count]) => (
              <div key={type} className="stat-card">
                <div className="number">{count}</div>
                <div className="label">{problemTypeLabels[type as any]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ margin: 0 }}>风险预警清单</h2>
          <button className="btn btn-outline" onClick={loadReport}>
            刷新
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>优先级</th>
              <th>商户名称</th>
              <th>问题类型</th>
              <th>问题描述</th>
              <th>状态</th>
              <th>截止日期</th>
              <th>逾期天数</th>
              <th>当前卡点</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {report.riskList.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  暂无待处理的风险任务
                </td>
              </tr>
            ) : (
              report.riskList.map((item) => (
                <tr key={item.taskId}>
                  <td>
                    <span
                      className="badge"
                      style={{ background: priorityColors[item.suggestion.priority] }}
                    >
                      {priorityLabels[item.suggestion.priority]}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{item.merchantName}</td>
                  <td>{problemTypeLabels[item.problemType]}</td>
                  <td className="text-sm text-muted">{item.problemDescription}</td>
                  <td>
                    <span
                      className="badge"
                      style={{ background: statusColors[item.status] }}
                    >
                      {statusLabels[item.status]}
                    </span>
                  </td>
                  <td>{formatDate(item.deadline)}</td>
                  <td>
                    {item.overdueDays > 0 ? (
                      <span style={{ color: '#dc2626', fontWeight: 500 }}>
                        逾期{Math.ceil(item.overdueDays)}天
                      </span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>-</span>
                    )}
                  </td>
                  <td className="text-sm" style={{ maxWidth: '200px' }}>
                    {item.suggestion.currentBlock}
                  </td>
                  <td>
                    <Link to={`/tasks/${item.taskId}`} className="link">
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
