import React, { useState } from 'react';
import { useApp } from '../store/AppContext';
import { formatDate, exportToCSV } from '../utils';

const PublicList: React.FC = () => {
  const { state } = useApp();
  const [buildingFilter, setBuildingFilter] = useState<string>('all');

  const publicOrders = state.workOrders.filter(wo => wo.isPublic);

  const buildings = [...new Set(
    publicOrders
      .map(wo => state.trees.find(t => t.id === wo.treeId)?.building)
      .filter(Boolean)
  )].sort();

  const filteredOrders = publicOrders.filter(wo => {
    const tree = state.trees.find(t => t.id === wo.treeId);
    return buildingFilter === 'all' || tree?.building === buildingFilter;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (!a.publicAt || !b.publicAt) return 0;
    return new Date(b.publicAt).getTime() - new Date(a.publicAt).getTime();
  });

  const handleExport = () => {
    const exportData = sortedOrders.map(wo => {
      const tree = state.trees.find(t => t.id === wo.treeId);
      return {
        '公示编号': wo.id,
        '树木位置': tree?.location || '-',
        '楼栋': tree?.building || '-',
        '树种': tree?.species || '-',
        '处理结果': wo.result || '-',
        '负责人': wo.assignedTo || '-',
        '完成时间': wo.completedAt ? formatDate(wo.completedAt) : '-',
        '公示时间': wo.publicAt ? formatDate(wo.publicAt) : '-'
      };
    });
    exportToCSV(exportData, `修剪公示清单_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div>
      <div className="page-header">
        <h2>处理结果公示</h2>
        <p>已完成的树木修剪工单公示清单，面向居民公开</p>
      </div>

      <div className="tree-info-panel" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="info-panel">
          <h4>📋 已公示工单</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">总数</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>
                {publicOrders.length}
              </span>
            </li>
            <li>
              <span className="info-label">涉及楼栋</span>
              <span>{buildings.length} 栋</span>
            </li>
          </ul>
        </div>
        <div className="info-panel">
          <h4>🏢 待公示工单</h4>
          <ul className="info-list">
            <li>
              <span className="info-label">已完成未公示</span>
              <span className="badge badge-yellow">
                {state.workOrders.filter(wo => wo.status === 'completed' && !wo.isPublic).length}
              </span>
            </li>
            <li>
              <span className="info-label">处理中</span>
              <span className="badge badge-blue">
                {state.workOrders.filter(wo => wo.status === 'processing').length}
              </span>
            </li>
          </ul>
        </div>
        <div className="info-panel">
          <h4>📊 按楼栋统计</h4>
          <ul className="info-list" style={{ maxHeight: '100px', overflowY: 'auto' }}>
            {buildings.map(b => {
              const count = publicOrders.filter(wo => 
                state.trees.find(t => t.id === wo.treeId)?.building === b
              ).length;
              return (
                <li key={b}>
                  <span className="info-label">{b}</span>
                  <span>{count} 项</span>
                </li>
              );
            })}
            {buildings.length === 0 && (
              <li>
                <span className="info-label">暂无</span>
                <span>-</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="actions">
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
          📥 导出公示清单
        </button>
      </div>

      <div className="public-list-container">
        <div className="public-list-header">
          <h3>🌳 小区树木修剪处理结果公示</h3>
          <p>
            公示日期：{new Date().toLocaleDateString('zh-CN')} | 
            共 {sortedOrders.length} 项处理结果
          </p>
        </div>

        {sortedOrders.length > 0 ? (
          <div>
            {sortedOrders.map((wo, index) => {
              const tree = state.trees.find(t => t.id === wo.treeId);
              const complaints = state.complaints.filter(c => wo.complaintIds.includes(c.id));
              
              return (
                <div key={wo.id} className="public-item">
                  <div className="public-item-title">
                    <span>
                      <span style={{ color: '#059669', marginRight: '0.5rem' }}>#{index + 1}</span>
                      {tree?.location || '未知位置'} - {tree?.species || '未知树种'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      公示编号：{wo.id}
                    </span>
                  </div>
                  
                  <div className="public-item-meta">
                    <span>📍 楼栋：{tree?.building || '-'}</span>
                    <span style={{ marginLeft: '1rem' }}>👤 负责人：{wo.assignedTo || '-'}</span>
                    <span style={{ marginLeft: '1rem' }}>📅 完成时间：{wo.completedAt ? formatDate(wo.completedAt) : '-'}</span>
                    <span style={{ marginLeft: '1rem' }}>📢 公示时间：{wo.publicAt ? formatDate(wo.publicAt) : '-'}</span>
                  </div>

                  {complaints.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginRight: '0.5rem' }}>
                        关联投诉：
                      </span>
                      {complaints.map(c => (
                        <span
                          key={c.id}
                          className={`complaint-tag complaint-tag-${c.type}`}
                        >
                          {c.type === 'shading' ? '楼栋遮光' : 
                           c.type === 'disease' ? '病虫害' : '居民投诉'}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="public-item-content">
                    <strong>处理结果：</strong>
                    {wo.result || '暂无详细描述'}
                  </div>

                  <div style={{ 
                    marginTop: '0.75rem', 
                    paddingTop: '0.75rem', 
                    borderTop: '1px dashed #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    color: '#6b7280'
                  }}>
                    <span>树高：{tree?.height}m | 冠幅：{tree?.crownDiameter}m</span>
                    <span>上次修剪：{tree?.lastTrimDate ? formatDate(tree.lastTrimDate) : '-'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">
              暂无公示记录
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                完成工单处理后，可在"工单优先级排序"模块进行公示
              </div>
            </div>
          </div>
        )}

        <div style={{ 
          marginTop: '2rem', 
          paddingTop: '1rem', 
          borderTop: '2px solid #e5e7eb',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}>
          <p>本公示清单由小区树木修剪工单管理系统自动生成</p>
          <p style={{ marginTop: '0.25rem' }}>
            如有疑问，请联系物业：400-123-4567 转 绿化管理部
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicList;
