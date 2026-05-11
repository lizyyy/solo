import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, RefreshCw, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import api, { getSeverityBadgeClass, getStatusBadgeClass } from '../utils/api';

const Reports = () => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadReport();
  }, [year, month]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/reports/monthly?year=${year}&month=${month}`);
      setReport(res.data);
    } catch (err) {
      console.error('加载月报失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      const res = await api.get(`/api/reports/monthly/export?year=${year}&month=${month}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `质量月报_${year}${month}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const maxDefectValue = Math.max(
    ...(report?.defectStats || []).map(d => d.total_quantity),
    1
  );

  return (
    <div>
      <div className="page-header">
        <h2>质量月报</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select 
            className="filter-select" 
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select 
            className="filter-select" 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months.map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={loadReport}>
            <RefreshCw size={14} /> 刷新
          </button>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={exportToExcel}
            disabled={exporting}
          >
            <Download size={14} /> 
            {exporting ? '导出中...' : '导出Excel'}
          </button>
        </div>
      </div>

      {loading && !report && (
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem' }}>正在加载月报...</p>
        </div>
      )}

      {report && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <FileSpreadsheet size={24} style={{ color: '#2563eb', marginBottom: '0.5rem' }} />
              <div className="stat-label">总批次数</div>
              <div className="stat-value">{report.summary.total_batches}</div>
            </div>
            <div className="stat-card">
              <CheckCircle size={24} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
              <div className="stat-label">完成批次</div>
              <div className="stat-value">{report.summary.completed_batches}</div>
            </div>
            <div className="stat-card">
              <AlertTriangle size={24} style={{ color: '#ef4444', marginBottom: '0.5rem' }} />
              <div className="stat-label">报废批次</div>
              <div className="stat-value">{report.summary.scrapped_batches}</div>
            </div>
            <div className="stat-card">
              <TrendingUp size={24} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
              <div className="stat-label">缺陷总数</div>
              <div className="stat-value">{report.summary.total_defect_quantity}</div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">缺陷统计</h3>
            {report.defectStats.length > 0 ? (
              <div>
                <div className="bar">
                  {report.defectStats.map((item, idx) => {
                    const height = (item.total_quantity / maxDefectValue) * 150;
                    return (
                      <div key={idx} className="bar-item">
                        <div className="bar-value">{item.total_quantity}</div>
                        <div 
                          className="bar-bar" 
                          style={{ 
                            height: `${height}px`,
                            background: item.severity === '严重' ? '#ef4444' : 
                                       item.severity === '轻微' ? '#10b981' : '#f59e0b'
                          }}
                        ></div>
                        <div className="bar-label">{item.defect_type}</div>
                        <div className="bar-label">
                          <span className={`status-badge ${getSeverityBadgeClass(item.severity)}`}>
                            {item.severity}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="table-container" style={{ marginTop: '2rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>缺陷类型</th>
                        <th>严重程度</th>
                        <th>出现次数</th>
                        <th>总数量</th>
                        <th>产品/生产线</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.defectStats.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.defect_type}</td>
                          <td>
                            <span className={`status-badge ${getSeverityBadgeClass(item.severity)}`}>
                              {item.severity}
                            </span>
                          </td>
                          <td>{item.defect_count}</td>
                          <td>{item.total_quantity}</td>
                          <td>{item.product_name} / {item.production_line}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-state">本月暂无缺陷数据</div>
            )}
          </div>

          <div className="chart-container">
            <div className="card">
              <h3 className="card-title">返工统计</h3>
              {report.reworkStats.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>返工方法</th>
                        <th>次数</th>
                        <th>返工总量</th>
                        <th>合格</th>
                        <th>不合格</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.reworkStats.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.rework_method}</td>
                          <td>{item.rework_count}</td>
                          <td>{item.total_reworked}</td>
                          <td style={{ color: '#10b981' }}>{item.pass_count}</td>
                          <td style={{ color: '#dc2626' }}>{item.fail_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">本月暂无返工数据</div>
              )}
            </div>

            <div className="card">
              <h3 className="card-title">复判决定分布</h3>
              {report.decisionStats.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>复判决定</th>
                        <th>次数</th>
                        <th>总数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.decisionStats.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className={`status-badge ${
                              item.decision === '入库' ? 'status-success' :
                              item.decision === '返工' ? 'status-warning' :
                              item.decision === '让步放行' ? 'status-active' :
                              'status-danger'
                            }`}>
                              {item.decision}
                            </span>
                          </td>
                          <td>{item.decision_count}</td>
                          <td>{item.total_quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">本月暂无复判数据</div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">隔离库存统计</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div className="batch-info">
                <label>隔离记录数</label>
                <span className="stat-value">{report.quarantineStats.quarantine_count}</span>
              </div>
              <div className="batch-info" style={{ color: '#dc2626' }}>
                <label>隔离中数量</label>
                <span className="stat-value">{report.quarantineStats.quarantined}</span>
              </div>
              <div className="batch-info" style={{ color: '#10b981' }}>
                <label>已释放数量</label>
                <span className="stat-value">{report.quarantineStats.released}</span>
              </div>
            </div>
          </div>

          <div className="alert alert-success">
            <strong>报表生成时间:</strong> {new Date(report.generatedAt).toLocaleString('zh-CN')}
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
