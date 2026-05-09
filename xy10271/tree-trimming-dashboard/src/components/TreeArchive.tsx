import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { formatDate, exportToCSV, getStatusText, getStatusColor } from '../utils';
import type { TreeRecord } from '../types';

const TreeArchive: React.FC = () => {
  const { state, dispatch } = useApp();
  const [selectedTree, setSelectedTree] = useState<TreeRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [buildingFilter, setBuildingFilter] = useState('all');

  const buildings = [...new Set(state.trees.map(t => t.building))].sort();

  const filteredTrees = state.trees.filter(tree => {
    const matchesSearch = tree.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tree.species.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tree.treeNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tree.status === statusFilter;
    const matchesBuilding = buildingFilter === 'all' || tree.building === buildingFilter;
    return matchesSearch && matchesStatus && matchesBuilding;
  });

  const handleExport = () => {
    const exportData = filteredTrees.map(tree => ({
      '树木编号': tree.treeNo,
      '位置': tree.location,
      '楼栋': tree.building,
      '树种': tree.species,
      '高度(m)': tree.height,
      '冠幅(m)': tree.crownDiameter,
      '种植日期': formatDate(tree.plantingDate),
      '状态': getStatusText(tree.status),
      '遮光程度': tree.shadingLevel + '%',
      '病虫害': tree.hasDisease ? '是' : '否',
      '上次修剪': tree.lastTrimDate ? formatDate(tree.lastTrimDate) : '-',
      '备注': tree.description || ''
    }));
    exportToCSV(exportData, `树木档案_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const getShadingLevel = (level: number) => {
    if (level >= 80) return { text: '严重', class: 'bg-red-100 text-red-800' };
    if (level >= 60) return { text: '较重', class: 'bg-orange-100 text-orange-800' };
    if (level >= 40) return { text: '中等', class: 'bg-yellow-100 text-yellow-800' };
    return { text: '轻微', class: 'bg-green-100 text-green-800' };
  };

  return (
    <div>
      <div className="page-header">
        <h2>树木档案管理</h2>
        <p>管理小区内所有树木的基本信息和健康状况</p>
      </div>

      <div className="actions">
        <input
          type="text"
          className="search-input"
          placeholder="搜索树木位置、编号或树种..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">全部状态</option>
          <option value="healthy">健康</option>
          <option value="needs_trimming">需修剪</option>
          <option value="diseased">病虫害</option>
          <option value="trimmed">已修剪</option>
        </select>
        <select
          className="filter-select"
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
        >
          <option value="all">全部楼栋</option>
          {buildings.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={handleExport}>
          📥 导出CSV
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>🌳 树木列表 ({filteredTrees.length} 棵)</h3>
        </div>
        <div className="card-body">
          {filteredTrees.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>树木编号</th>
                    <th>位置</th>
                    <th>楼栋</th>
                    <th>树种</th>
                    <th>高度/冠幅</th>
                    <th>遮光程度</th>
                    <th>病虫害</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrees.map(tree => {
                    const shading = getShadingLevel(tree.shadingLevel);
                    return (
                      <tr key={tree.id}>
                        <td style={{ fontWeight: 600 }}>{tree.treeNo}</td>
                        <td>{tree.location}</td>
                        <td>{tree.building}</td>
                        <td>{tree.species}</td>
                        <td>{tree.height}m / {tree.crownDiameter}m</td>
                        <td>
                          <span className={`badge ${shading.class}`}>
                            {shading.text} ({tree.shadingLevel}%)
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${tree.hasDisease ? 'badge-red' : 'badge-green'}`}>
                            {tree.hasDisease ? '是' : '否'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getStatusColor(tree.status)}`}>
                            {getStatusText(tree.status)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedTree(tree)}
                          >
                            查看详情
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🌳</div>
              <div className="empty-state-text">没有找到匹配的树木</div>
            </div>
          )}
        </div>
      </div>

      {selectedTree && (
        <div className="modal-overlay" onClick={() => setSelectedTree(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🌳 树木详情</h3>
              <button className="modal-close" onClick={() => setSelectedTree(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="label">树木编号</div>
                  <div className="value">{selectedTree.treeNo}</div>
                </div>
                <div className="detail-item">
                  <div className="label">楼栋</div>
                  <div className="value">{selectedTree.building}</div>
                </div>
                <div className="detail-item">
                  <div className="label">具体位置</div>
                  <div className="value">{selectedTree.location}</div>
                </div>
                <div className="detail-item">
                  <div className="label">树种</div>
                  <div className="value">{selectedTree.species}</div>
                </div>
                <div className="detail-item">
                  <div className="label">树高</div>
                  <div className="value">{selectedTree.height} 米</div>
                </div>
                <div className="detail-item">
                  <div className="label">冠幅</div>
                  <div className="value">{selectedTree.crownDiameter} 米</div>
                </div>
                <div className="detail-item">
                  <div className="label">种植日期</div>
                  <div className="value">{formatDate(selectedTree.plantingDate)}</div>
                </div>
                <div className="detail-item">
                  <div className="label">上次修剪</div>
                  <div className="value">{selectedTree.lastTrimDate ? formatDate(selectedTree.lastTrimDate) : '-'}</div>
                </div>
                <div className="detail-item">
                  <div className="label">当前状态</div>
                  <div className="value">
                    <span className={`badge ${getStatusColor(selectedTree.status)}`}>
                      {getStatusText(selectedTree.status)}
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <div className="label">遮光程度</div>
                  <div className="value">{selectedTree.shadingLevel}%</div>
                </div>
              </div>

              {selectedTree.hasDisease && (
                <div className="detail-item" style={{ marginTop: '1rem' }}>
                  <div className="label">病虫害描述</div>
                  <div className="value">{selectedTree.diseaseDescription || '未记录详细情况'}</div>
                </div>
              )}

              {selectedTree.description && (
                <div className="detail-item" style={{ marginTop: '1rem' }}>
                  <div className="label">备注说明</div>
                  <div className="value">{selectedTree.description}</div>
                </div>
              )}

              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  📋 相关投诉记录
                </h4>
                {state.complaints.filter(c => c.treeId === selectedTree.id).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {state.complaints.filter(c => c.treeId === selectedTree.id).map(c => (
                      <div key={c.id} className="detail-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span className={`complaint-tag complaint-tag-${c.type}`}>
                            {c.type === 'shading' ? '遮光' : c.type === 'disease' ? '病虫害' : '居民投诉'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {formatDate(c.createdAt)}
                          </span>
                        </div>
                        <div className="value" style={{ fontSize: '0.875rem' }}>{c.description}</div>
                        <div style={{ marginTop: '0.25rem' }}>
                          <span className={`badge ${c.resolved ? 'badge-green' : 'badge-yellow'}`}>
                            {c.resolved ? '已解决' : '待处理'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <div className="empty-state-icon" style={{ fontSize: '2rem' }}>📋</div>
                    <div className="empty-state-text">暂无相关投诉</div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedTree(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreeArchive;
