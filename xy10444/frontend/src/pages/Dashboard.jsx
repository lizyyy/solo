import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../api.js';

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(h => {
        const value = row[h];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [month, setMonth] = useState(getCurrentMonth());

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getStats({ month });
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [month]);

  const handleExport = async () => {
    try {
      const response = await dashboardAPI.exportMaterials({ month });
      if (response.data.success && response.data.data.length > 0) {
        exportToCSV(response.data.data, `材料消耗报表_${month}.csv`);
      } else {
        alert('当前月份没有数据可导出');
      }
    } catch (err) {
      alert('导出失败: ' + (err.response?.data?.message || err.message));
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      '待处理': 'badge-pending',
      '处理中': 'badge-progress',
      '待确认': 'badge-confirm',
      '已完成': 'badge-completed',
      '已取消': 'badge-cancelled'
    };
    return badges[status] || 'badge-cancelled';
  };

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  if (error) {
    return (
      <div>
        <div className="alert alert-error">{error}</div>
        <p className="empty-state">请确保后端服务已启动并连接到MongoDB</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📊 核销看板</h1>
        <div className="filters">
          <div className="filter-group">
            <span className="filter-label">月份:</span>
            <input 
              type="month" 
              className="input" 
              value={month} 
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" onClick={handleExport}>
            📥 导出材料消耗报表
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">总工单数</div>
          <div className="stat-value primary">{stats.totalWorkOrders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">待处理</div>
          <div className="stat-value warning">{stats.pendingWorkOrders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">处理中</div>
          <div className="stat-value primary">{stats.inProgressWorkOrders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已完成</div>
          <div className="stat-value success">{stats.completedWorkOrders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">业主付费合计</div>
          <div className="stat-value danger">¥{stats.ownerPayTotal.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">公共维修基金合计</div>
          <div className="stat-value success">¥{stats.fundPayTotal.toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">⚠️ 待退料工单 ({stats.pendingReturnCount})</h3>
        </div>
        <div className="card-body">
          {stats.pendingReturnOrders.length === 0 ? (
            <div className="empty-state">暂无待退料工单</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>工单号</th>
                    <th>维修类型</th>
                    <th>地点</th>
                    <th>维修师傅</th>
                    <th>状态</th>
                    <th>待退材料</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.pendingReturnOrders.map(wo => (
                    <tr key={wo._id}>
                      <td className="number">{wo.orderNumber}</td>
                      <td>{wo.repairType}</td>
                      <td>{wo.location}</td>
                      <td>{wo.technician}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(wo.status)}`}>
                          {wo.status}
                        </span>
                      </td>
                      <td>
                        {wo.materials.map((m, i) => (
                          <div key={i}>
                            {m.materialName}: <span className="number">{m.balance}{m.unit}</span>
                          </div>
                        ))}
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-warning"
                          onClick={() => navigate(`/work-orders/${wo._id}`)}
                        >
                          处理退料
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📝 待业主确认工单 ({stats.pendingConfirmCount})</h3>
        </div>
        <div className="card-body">
          {stats.pendingConfirmOrders.length === 0 ? (
            <div className="empty-state">暂无待确认工单</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>工单号</th>
                    <th>维修类型</th>
                    <th>类别</th>
                    <th>地点</th>
                    <th>报修人</th>
                    <th>维修师傅</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.pendingConfirmOrders.map(wo => (
                    <tr key={wo._id}>
                      <td className="number">{wo.orderNumber}</td>
                      <td>{wo.repairType}</td>
                      <td>
                        <span className={`badge ${wo.repairCategory === '公共区域' ? 'badge-public' : 'badge-private'}`}>
                          {wo.repairCategory}
                        </span>
                      </td>
                      <td>{wo.location}</td>
                      <td>{wo.reporterName}</td>
                      <td>{wo.technician}</td>
                      <td>
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => navigate(`/work-orders/${wo._id}`)}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📈 费用分摊明细</h3>
        </div>
        <div className="card-body">
          {stats.materialCostReport.length === 0 ? (
            <div className="empty-state">当前月份暂无费用数据</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>材料名称</th>
                    <th>单位</th>
                    <th>单价</th>
                    <th>累计用量</th>
                    <th>累计金额</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.materialCostReport.map((item, index) => (
                    <tr key={index}>
                      <td>{item.materialName}</td>
                      <td>{item.unit}</td>
                      <td className="number">¥{item.unitPrice.toFixed(2)}</td>
                      <td className="number">{item.totalQuantity}</td>
                      <td className="number">¥{item.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="totals-row">
                    <td colSpan="4" style={{ textAlign: 'right' }}>合计</td>
                    <td className="number">
                      ¥{stats.materialCostReport.reduce((sum, item) => sum + item.totalAmount, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
