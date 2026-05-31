import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Material, MaterialStatus, FilterOptions } from '../types';
import { getAllMaterials, filterMaterials, getExpiringMaterials, checkAuthExpiry, getCurrentUser, setCurrentUser } from '../services/storage';
import { exportDeliveryNote } from '../services/export';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../services/export';

export const MaterialList: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [expiringCount, setExpiringCount] = useState(0);
  const [userName, setUserName] = useState(getCurrentUser().name);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    loadMaterials();
    setExpiringCount(getExpiringMaterials(7).length);
  }, []);

  const loadMaterials = () => {
    const filtered = Object.keys(filters).length > 0 
      ? filterMaterials(filters) 
      : getAllMaterials();
    setMaterials(filtered);
  };

  useEffect(() => {
    loadMaterials();
  }, [filters]);

  const handleFilterChange = (key: keyof FilterOptions, value: string | boolean | undefined) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (value === undefined || value === '') {
        delete newFilters[key];
      } else {
        (newFilters as any)[key] = value;
      }
      return newFilters;
    });
  };

  const handleExportAll = () => {
    exportDeliveryNote(materials);
  };

  const handleUserNameSave = () => {
    setCurrentUser(userName);
    setShowUserModal(false);
  };

  const sources = [...new Set(getAllMaterials().map(m => m.source))];
  const batchIds = [...new Set(getAllMaterials().map(m => m.batchId))];

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-item">
          <label>状态:</label>
          <select 
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value as MaterialStatus || undefined)}
          >
            <option value="">全部</option>
            <option value="pending">待处理</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
            <option value="needs_revision">需修改</option>
            <option value="auth_expired">授权过期</option>
          </select>
        </div>
        
        <div className="filter-item">
          <label>批次:</label>
          <select 
            value={filters.batchId || ''}
            onChange={(e) => handleFilterChange('batchId', e.target.value || undefined)}
          >
            <option value="">全部</option>
            {batchIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>来源:</label>
          <select 
            value={filters.source || ''}
            onChange={(e) => handleFilterChange('source', e.target.value || undefined)}
          >
            <option value="">全部</option>
            {sources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>授权过期:</label>
          <select 
            value={filters.hasAuthExpired === undefined ? '' : String(filters.hasAuthExpired)}
            onChange={(e) => handleFilterChange('hasAuthExpired', e.target.value === '' ? undefined : e.target.value === 'true')}
          >
            <option value="">全部</option>
            <option value="true">已过期</option>
            <option value="false">未过期</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={handleExportAll} style={{ marginRight: '10px' }}>
            导出交付说明
          </button>
          <Link to="/new" className="btn btn-success">
            新增物料
          </Link>
        </div>
      </div>

      {expiringCount > 0 && (
        <div className="alert alert-warning">
          ⚠️ 有 {expiringCount} 个物料的授权将在7天内到期，请及时处理
        </div>
      )}

      {materials.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">📋</div>
          <p>暂无物料记录</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>点击「新增物料」开始录入</p>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>物料名称</th>
                <th>来源</th>
                <th>批次</th>
                <th>状态</th>
                <th>状态原因</th>
                <th>版本</th>
                <th>最后修改</th>
                <th>授权状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {materials.map(material => (
                <tr key={material.id}>
                  <td>
                    <Link to={`/material/${material.id}`} style={{ color: '#667eea', textDecoration: 'none' }}>
                      {material.name}
                    </Link>
                  </td>
                  <td>{material.source}</td>
                  <td><span className="badge">{material.batchId}</span></td>
                  <td><StatusBadge status={material.currentStatus} /></td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {material.statusReason || '-'}
                  </td>
                  <td>v{material.currentVersion}</td>
                  <td>{formatDate(material.lastModifiedAt)}</td>
                  <td>
                    {checkAuthExpiry(material) ? (
                      <span className="expired">已过期</span>
                    ) : material.authorizationFiles.length > 0 ? (
                      <span style={{ color: '#28a745' }}>正常</span>
                    ) : (
                      <span style={{ color: '#999' }}>无授权</span>
                    )}
                  </td>
                  <td>
                    <Link to={`/material/${material.id}`} className="btn btn-sm btn-primary">
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUserModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>设置用户名</h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label>用户名</label>
              <input 
                type="text" 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="请输入您的姓名"
              />
            </div>
            <button className="btn btn-primary" onClick={handleUserNameSave}>保存</button>
          </div>
        </div>
      )}
    </div>
  );
};
