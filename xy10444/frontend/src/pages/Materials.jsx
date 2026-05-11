import React, { useState, useEffect } from 'react';
import { materialsAPI } from '../api.js';

function Materials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '全部',
    search: ''
  });

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await materialsAPI.getAll(filters);
      if (response.data.success) {
        setMaterials(response.data.data);
      }
    } catch (err) {
      console.error('加载材料失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [filters]);

  if (loading) {
    return <div className="empty-state">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📦 材料库存</h1>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="filters">
            <div className="filter-group">
              <span className="filter-label">类别:</span>
              <select 
                className="select"
                value={filters.category}
                onChange={(e) => setFilters({...filters, category: e.target.value})}
              >
                <option value="全部">全部</option>
                <option value="水管">水管</option>
                <option value="门禁">门禁</option>
                <option value="照明">照明</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div className="filter-group">
              <input 
                type="text" 
                className="input"
                placeholder="搜索材料名称..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {materials.length === 0 ? (
            <div className="empty-state">暂无材料数据</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>材料名称</th>
                    <th>类别</th>
                    <th>单位</th>
                    <th>单价</th>
                    <th>当前库存</th>
                    <th>最低库存</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m._id}>
                      <td>{m.name}</td>
                      <td>
                        <span className={`badge ${
                          m.category === '水管' ? 'badge-public' :
                          m.category === '门禁' ? 'badge-confirm' :
                          m.category === '照明' ? 'badge-progress' : 'badge-cancelled'
                        }`}>
                          {m.category}
                        </span>
                      </td>
                      <td>{m.unit}</td>
                      <td className="number">¥{m.unitPrice.toFixed(2)}</td>
                      <td className="number">
                        <span className={m.stock <= m.minStock ? 'badge badge-warning' : ''}>
                          {m.stock}
                        </span>
                      </td>
                      <td className="number">{m.minStock}</td>
                      <td>
                        {m.stock <= m.minStock ? (
                          <span className="badge badge-danger">库存不足</span>
                        ) : (
                          <span className="badge badge-completed">正常</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Materials;
