import { useState, useEffect } from 'react';
import { reports as reportsApi, invoices } from '../api';
import dayjs from 'dayjs';

function Reports() {
  const [reportList, setReportList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [message, setMessage] = useState(null);

  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadReports();
    loadStats();
  }, []);

  const loadReports = async () => {
    try {
      const res = await reportsApi.list();
      setReportList(res.data);
    } catch (err) {
      console.error('加载报告列表失败:', err);
    }
  };

  const loadStats = async () => {
    try {
      const res = await invoices.stats();
      setStats(res.data);
    } catch (err) {
      console.error('加载统计失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (type, title) => {
    try {
      setGenerating(true);
      const res = await reportsApi.generate({
        reportType: type,
        title,
        generatedBy: '当前用户'
      });
      showMessage('success', '报告生成成功');
      loadReports();
    } catch (err) {
      showMessage('error', '报告生成失败');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const viewReport = async (id) => {
    try {
      const res = await reportsApi.get(id);
      setSelectedReport(res.data);
    } catch (err) {
      showMessage('error', '加载报告失败');
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const reportTypeLabels = {
    review_progress: '复核进度报告',
    exception: '异常分析报告',
    daily: '日报',
    general: '综合报告'
  };

  const overview = stats?.overview || {};

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">复核报告</h1>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">生成报告</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              disabled={generating}
              onClick={() => generateReport('review_progress', '复核进度报告')}
            >
              📊 生成进度报告
            </button>
            <button
              className="btn btn-danger"
              disabled={generating}
              onClick={() => generateReport('exception', '异常分析报告')}
            >
              ⚠️ 生成异常报告
            </button>
            <button
              className="btn btn-success"
              disabled={generating}
              onClick={() => generateReport('daily', '今日复核日报')}
            >
              📅 生成日报
            </button>
            {generating && (
              <span style={{ lineHeight: '36px', color: '#6b7280' }}>
                正在生成...
              </span>
            )}
          </div>
        </div>
      </div>

      {overview && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <div className="card-title">实时数据概览</div>
          </div>
          <div className="card-body">
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 0 }}>
              <div className="stat-card primary" style={{ boxShadow: 'none', padding: 0 }}>
                <div className="stat-label">总票据</div>
                <div className="stat-value">{overview.total || 0}</div>
              </div>
              <div className="stat-card" style={{ boxShadow: 'none', padding: 0 }}>
                <div className="stat-label">待审核</div>
                <div className="stat-value">{overview.pending || 0}</div>
              </div>
              <div className="stat-card danger" style={{ boxShadow: 'none', padding: 0 }}>
                <div className="stat-label">异常</div>
                <div className="stat-value">{overview.exception || 0}</div>
              </div>
              <div className="stat-card success" style={{ boxShadow: 'none', padding: 0 }}>
                <div className="stat-label">已通过</div>
                <div className="stat-value">{overview.approved || 0}</div>
              </div>
              <div className="stat-card" style={{ boxShadow: 'none', padding: 0 }}>
                <div className="stat-label">已拒绝</div>
                <div className="stat-value">{overview.rejected || 0}</div>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <div className="stat-label" style={{ marginBottom: '8px' }}>完成率</div>
              <div className="progress-bar" style={{ height: '16px', borderRadius: '8px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${overview.total > 0
                      ? Math.round(
                          ((overview.approved || 0) / overview.total) * 100
                        )
                      : 0}%`
                  }}
                />
              </div>
              <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600 }}>
                {overview.total > 0
                  ? Math.round(
                      ((overview.approved || 0) / overview.total) * 100
                    )
                  : 0}
                % ({overview.approved || 0}/{overview.total || 0})
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div className="card-title">历史报告</div>
        </div>
        <div className="card-body">
          {reportList.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <div>暂无历史报告，点击上方按钮生成</div>
            </div>
          ) : (
            reportList.map((report) => (
              <div
                key={report.id}
                className="report-card"
                style={{ cursor: 'pointer' }}
                onClick={() => viewReport(report.id)}
              >
                <div className="report-type">
                  {reportTypeLabels[report.report_type] || report.report_type}
                </div>
                <div className="report-title">{report.title}</div>
                <div className="report-meta">
                  生成时间: {report.generated_at} | 生成人: {report.generated_by}
                </div>
                {report.summary && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
                    {report.summary.total !== undefined &&
                      `涉及票据: ${report.summary.total} 张`}
                    {report.summary.completionRate !== undefined &&
                      ` | 完成率: ${report.summary.completionRate}%`}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}

function ReportDetailModal({ report, onClose }) {
  const reportTypeLabels = {
    review_progress: '复核进度报告',
    exception: '异常分析报告',
    daily: '日报',
    general: '综合报告'
  };

  const renderSummary = () => {
    const summary = report.summary || {};

    if (report.report_type === 'review_progress' && summary.statusBreakdown) {
      return (
        <div>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">总票据数</div>
              <div className="detail-value">{summary.statusBreakdown.total}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">完成率</div>
              <div className="detail-value" style={{ color: '#16a34a' }}>
                {summary.completionRate}%
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">总金额</div>
              <div className="detail-value">
                ¥{(summary.totalAmount || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <div className="stat-label" style={{ marginBottom: '12px' }}>
              状态分布
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              {Object.entries(summary.statusBreakdown).map(([key, val]) => {
                if (key === 'total' || val === 0) return null;
                return (
                  <div
                    key={key}
                    style={{
                      background: '#f9fafb',
                      padding: '12px',
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      {{
                        pending: '待审核',
                        reviewing: '审核中',
                        exception: '异常',
                        approved: '已通过',
                        rejected: '已拒绝'
                      }[key] || key}
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px' }}>
                      {val}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {summary.dailyProgress && summary.dailyProgress.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div className="stat-label" style={{ marginBottom: '12px' }}>
                近期趋势
              </div>
              <div className="chart-container">
                <div className="chart-bars">
                  {summary.dailyProgress.map((day, idx) => (
                    <div key={idx} style={{ flex: 1, margin: '0 2px' }}>
                      <div
                        style={{
                          background: '#2563eb',
                          height: `${Math.max((day.uploaded / Math.max(...summary.dailyProgress.map(d => d.uploaded), 1)) * 100, 5)}%`,
                          borderRadius: '4px 4px 0 0'
                        }}
                        title={`上传: ${day.uploaded}, 复核: ${day.reviewed}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="chart-labels">
                  {summary.dailyProgress.map((day, idx) => (
                    <div key={idx} className="chart-label">
                      {day.date?.slice(5)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (report.report_type === 'exception') {
      return (
        <div>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">异常总数</div>
              <div className="detail-value" style={{ color: '#dc2626' }}>
                {summary.total || 0}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">待处理</div>
              <div className="detail-value" style={{ color: '#f59e0b' }}>
                {summary.open || 0}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">已解决</div>
              <div className="detail-value" style={{ color: '#16a34a' }}>
                {summary.resolved || 0}
              </div>
            </div>
          </div>

          {summary.byType && Object.keys(summary.byType).length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div className="stat-label" style={{ marginBottom: '12px' }}>
                异常类型分布
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {Object.entries(summary.byType).map(([type, count]) => (
                  <div
                    key={type}
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      padding: '12px 16px',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      {{
                        amount_mismatch: '金额不匹配',
                        tax_number_invalid: '税号无效',
                        approval_missing: '审批缺失',
                        other: '其他异常'
                      }[type] || type}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#dc2626' }}>
                      {count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (report.report_type === 'daily') {
      return (
        <div>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">日期范围</div>
              <div className="detail-value">
                {summary.dateRange?.from} - {summary.dateRange?.to}
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">票据数量</div>
              <div className="detail-value">{summary.total || 0}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">总金额</div>
              <div className="detail-value" style={{ color: '#2563eb' }}>
                ¥{(summary.totalAmount || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return <pre>{JSON.stringify(summary, null, 2)}</pre>;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{report.title}</div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="report-meta" style={{ marginBottom: '20px' }}>
            报告类型: {reportTypeLabels[report.report_type] || report.report_type} |
            生成时间: {report.generated_at} | 生成人: {report.generated_by}
          </div>
          {renderSummary()}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default Reports;
