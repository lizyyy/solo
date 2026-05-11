import React, { useState, useEffect } from 'react';
import { settlementsAPI } from '../api.js';

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

function Settlements() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    settlementType: '全部',
    month: getCurrentMonth()
  });

  const loadSettlements = async () => {
    try {
      setLoading(true);
      const response = await settlementsAPI.getAll(filters);
      if (response.data.success) {
        setSettlements(response.data.data);
      }
    } catch (err) {
      console.error('加载结算记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettlements();
  }, [filters]);

  const totalOwnerPay = settlements
    .filter(s => s.settlementType === '业主付费')
    .reduce((sum, s) => sum + s.totalAmount, 0);
  
  const totalFundPay = settlements
    .filter(s => s.settlementType === '公共维修基金')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">💰 结算记录</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">业主付费合计</div>
          <div className="stat-value danger">¥{totalOwnerPay.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">公共维修基金合计</div>
          <div className="stat-value success">¥{totalFundPay.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">总核销金额</div>
          <div className="stat-value primary">¥{(totalOwnerPay + totalFundPay).toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">结算单数</div>
          <div className="stat-value">{settlements.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="filters">
            <div className="filter-group">
              <span className="filter-label">月份:</span>
              <input 
                type="month" 
                className="input" 
                value={filters.month} 
                onChange={(e) => setFilters({...filters, month: e.target.value})}
              />
            </div>
            <div className="filter-group">
              <span className="filter-label">结算类型:</span>
              <select 
                className="select"
                value={filters.settlementType}
                onChange={(e) => setFilters({...filters, settlementType: e.target.value})}
              >
                <option value="全部">全部</option>
                <option value="业主付费">业主付费</option>
                <option value="公共维修基金">公共维修基金</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {settlements.length === 0 ? (
            <div className="empty-state">暂无结算记录</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>结算单号</th>
                    <th>关联工单</th>
                    <th>维修类型</th>
                    <th>地点</th>
                    <th>房号</th>
                    <th>维修师傅</th>
                    <th>结算类型</th>
                    <th>金额</th>
                    <th>结算时间</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map(s => (
                    <tr key={s._id}>
                      <td className="number">{s.settlementNumber}</td>
                      <td className="number">{s.workOrderNumber}</td>
                      <td>{s.repairType}</td>
                      <td>{s.location}</td>
                      <td>{s.houseNumber || '-'}</td>
                      <td>{s.technician}</td>
                      <td>
                        <span className={`badge ${s.settlementType === '业主付费' ? 'badge-owner' : 'badge-fund'}`}>
                          {s.settlementType}
                        </span>
                      </td>
                      <td className="number">¥{s.totalAmount.toFixed(2)}</td>
                      <td>{new Date(s.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="totals-row">
                    <td colSpan="7" style={{ textAlign: 'right' }}>合计</td>
                    <td className="number">
                      ¥{settlements.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2)}
                    </td>
                    <td></td>
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

export default Settlements;
