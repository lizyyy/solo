import React, { useState, useEffect, useCallback } from 'react';
import Toast from '../components/Toast.jsx';

function Reports() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    dormBuilding: ''
  });

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });
      
      const response = await fetch(`/api/reports/summary?${params}`);
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      }
    } catch (error) {
      showToast('获取报告失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExportRepairs = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });
      
      const response = await fetch(`/api/export/repairs?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `repairs_report_${Date.now()}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('导出成功', 'success');
      }
    } catch (error) {
      showToast('导出失败', 'error');
    }
  };

  const statusLabels = {
    pending_verification: '待确认',
    discrepancy: '异常待处理',
    completed: '已完成'
  };

  const maxStatusCount = reportData ? Math.max(
    ...Object.values(reportData.statusStats)
  ) : 1;

  const maxDormCount = reportData?.dormStats?.length > 0 
    ? Math.max(...reportData.dormStats.map(s => s.count)) 
    : 1;

  const maxTypeCount = reportData ? Math.max(
    ...Object.values(reportData.repairTypeStats || {})
  ) : 1;

  const maxMaterialAmount = reportData?.topMaterials?.length > 0
    ? Math.max(...reportData.topMaterials.map(m => m.netAmount))
    : 1;

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="card">
        <div className="card-header">
          <h2>统计筛选</h2>
          <button className="btn btn-primary" onClick={handleExportRepairs}>
            导出维修单
          </button>
        </div>
        <div className="search-bar">
          <div className="form-group">
            <label>开始日期</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>结束日期</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>宿舍楼</label>
            <input
              type="text"
              placeholder="如：1号楼"
              value={filters.dormBuilding}
              onChange={(e) => setFilters({ ...filters, dormBuilding: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={fetchReport}>
              刷新数据
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="loading">加载中...</div>
        </div>
      ) : reportData ? (
        <>
          <div className="stats-grid">
            <div className="stat-card primary">
              <h3>维修单总数</h3>
              <div className="value">{reportData.totalRepairs}</div>
            </div>
            <div className="stat-card danger">
              <h3>异常维修单</h3>
              <div className="value">{reportData.discrepancyCount}</div>
              <div style={{ color: '#999', fontSize: 13, marginTop: 4 }}>
                异常率 {reportData.discrepancyRate}
              </div>
            </div>
            <div className="stat-card primary">
              <h3>领用总金额</h3>
              <div className="value">¥{reportData.totalClaimAmount}</div>
            </div>
            <div className="stat-card warning">
              <h3>退回总金额</h3>
              <div className="value">¥{reportData.totalReturnAmount}</div>
            </div>
            <div className="stat-card success">
              <h3>核销净金额</h3>
              <div className="value">¥{reportData.netAmount}</div>
            </div>
          </div>

          <div className="report-card">
            <h3>状态分布</h3>
            <div className="chart-bar">
              {Object.entries(reportData.statusStats || {}).map(([status, count]) => {
                const heightPercent = maxStatusCount > 0 ? (count / maxStatusCount) * 100 : 0;
                return (
                  <div key={status} className="chart-bar-item">
                    <div className="value">{count}</div>
                    <div
                      className="bar"
                      style={{
                        height: `${Math.max(heightPercent, 10)}%`,
                        background: status === 'pending_verification' 
                          ? 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)'
                          : status === 'discrepancy'
                          ? 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)'
                          : 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)'
                      }}
                    />
                    <div className="label">{statusLabels[status] || status}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="stats-grid">
            {Object.keys(reportData.repairTypeStats || {}).length > 0 && (
              <div className="report-card" style={{ gridColumn: 'span 2' }}>
                <h3>维修类型统计</h3>
                <div className="chart-bar">
                  {Object.entries(reportData.repairTypeStats).map(([type, count]) => {
                    const heightPercent = maxTypeCount > 0 ? (count / maxTypeCount) * 100 : 0;
                    return (
                      <div key={type} className="chart-bar-item">
                        <div className="value">{count}</div>
                        <div
                          className="bar"
                          style={{ height: `${Math.max(heightPercent, 10)}%` }}
                        />
                        <div className="label">{type}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {reportData.dormStats?.length > 0 && (
              <div className="report-card" style={{ gridColumn: 'span 2' }}>
                <h3>宿舍楼统计</h3>
                <div className="chart-bar">
                  {reportData.dormStats.slice(0, 6).map((stat, index) => {
                    const heightPercent = maxDormCount > 0 ? (stat.count / maxDormCount) * 100 : 0;
                    return (
                      <div key={stat.dorm} className="chart-bar-item">
                        <div className="value">{stat.count}</div>
                        <div
                          className="bar"
                          style={{ 
                            height: `${Math.max(heightPercent, 10)}%`,
                            background: `linear-gradient(135deg, #${667 + index * 50}eea 0%, #${764 + index * 20}ba2 100%)`
                          }}
                        />
                        <div className="label">{stat.dorm}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {reportData.topMaterials?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2>耗材统计 Top 10</h2>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>材料名称</th>
                      <th>领用数量</th>
                      <th>领用金额</th>
                      <th>退回数量</th>
                      <th>退回金额</th>
                      <th>净用量</th>
                      <th>净金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.topMaterials.map((material, index) => (
                      <tr key={material.name}>
                        <td>
                          <span className="amount-badge" style={{ fontSize: 14 }}>
                            {index + 1}
                          </span>
                        </td>
                        <td><strong>{material.name}</strong></td>
                        <td>{material.claimQty}</td>
                        <td>¥{material.claimAmount.toFixed(2)}</td>
                        <td>{material.returnQty}</td>
                        <td>¥{material.returnAmount.toFixed(2)}</td>
                        <td>{material.netQty}</td>
                        <td>
                          <span className={`amount-badge ${material.netAmount < 0 ? 'negative-amount' : ''}`}>
                            ¥{material.netAmount.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <h2>报告闭环说明</h2>
            </div>
            <div className="alert alert-info">
              <strong>📊 报告数据说明：</strong>
              <ul style={{ marginTop: 12, paddingLeft: 24 }}>
                <li><strong>核销净金额</strong> = 领用总金额 - 退回总金额</li>
                <li><strong>异常率</strong> = 异常维修单数 / 总维修单数</li>
                <li><strong>耗材统计</strong> 按净用量金额排序，帮助识别高频耗材</li>
                <li><strong>状态分布</strong> 显示当前待处理、异常、已完成的维修单数量</li>
              </ul>
            </div>
            <div className="divider" />
            <h4 className="section-title">异常处理流程</h4>
            <div className="timeline" style={{ marginTop: 16 }}>
              <div className="timeline-item">
                <div className="action">检测差异</div>
                <div className="details">系统自动检测退料超过领用、重复记录等异常情况</div>
              </div>
              <div className="timeline-item">
                <div className="action">标记异常</div>
                <div className="details">维修单状态转为"异常待处理"，等待管理员介入</div>
              </div>
              <div className="timeline-item">
                <div className="action">处理异常</div>
                <div className="details">管理员核实情况，调整材料记录或填写处理说明</div>
              </div>
              <div className="timeline-item">
                <div className="action">闭环完成</div>
                <div className="details">异常处理后状态转为"已完成"，形成完整审计记录</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="empty-state">
            <p>暂无统计数据</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;