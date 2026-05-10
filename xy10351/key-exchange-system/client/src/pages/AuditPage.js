import React, { useState, useEffect } from 'react';
import { auditApi } from '../services/api';
import moment from 'moment';

const AuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs');
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    startDate: '',
    endDate: '',
  });
  const [historyFilter, setHistoryFilter] = useState({
    keyId: '',
    operator: '',
  });
  const [message, setMessage] = useState(null);
  const [showDiff, setShowDiff] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [logsRes, historyRes] = await Promise.all([
        auditApi.getLogs(filters),
        auditApi.getHistory(historyFilter),
      ]);
      setLogs(logsRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleExport = async (format) => {
    try {
      const res = await auditApi.exportReport(format, filters);
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      showMessage('success', `导出${format.toUpperCase()}成功！`);
    } catch (error) {
      showMessage('error', '导出失败');
    }
  };

  const handleViewDiff = async (entityType, entityId) => {
    try {
      const res = await auditApi.getDiff(entityType, entityId);
      setShowDiff({ data: res, entityType, entityId });
    } catch (error) {
      showMessage('error', '获取差异记录失败');
    }
  };

  const getActionText = (action) => {
    const map = {
      CREATE: '创建',
      UPDATE: '更新',
      PICKUP: '领取',
      RETURN: '归还',
      CANCEL: '取消',
      MODIFY: '修改',
      CANCEL_RELATED: '关联取消',
    };
    return map[action] || action;
  };

  const getEntityTypeText = (type) => {
    const map = {
      Key: '钥匙',
      Order: '订单',
      ExchangeRecord: '交接记录',
    };
    return map[type] || type;
  };

  const formatJSON = (jsonStr) => {
    if (!jsonStr) return '-';
    try {
      const obj = JSON.parse(jsonStr);
      return Object.entries(obj)
        .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
        .map(([key, value]) => {
          if (key === 'status') {
            const statusMap = {
              available: '可用',
              in_use: '使用中',
              overdue: '逾期',
              maintenance: '维护中',
              pending: '待处理',
              completed: '已完成',
              cancelled: '已取消',
              active: '进行中',
            };
            value = statusMap[value] || value;
          }
          return `${key}: ${value}`;
        })
        .join('; ');
    } catch {
      return jsonStr;
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">审计追踪</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-info btn-sm" onClick={() => handleExport('csv')}>
              📊 导出CSV
            </button>
            <button className="btn btn-success btn-sm" onClick={() => handleExport('json')}>
              📋 导出JSON
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <button 
            className={`btn ${activeTab === 'logs' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            审计日志
          </button>
          <button 
            className={`btn ${activeTab === 'history' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{ marginLeft: '0.5rem' }}
          >
            交接历史
          </button>
        </div>

        {activeTab === 'logs' && (
          <>
            <div className="filter-bar">
              <select
                className="select-dropdown"
                value={filters.entityType}
                onChange={(e) => setFilters({...filters, entityType: e.target.value})}
              >
                <option value="">全部实体</option>
                <option value="Key">钥匙</option>
                <option value="Order">订单</option>
                <option value="ExchangeRecord">交接记录</option>
              </select>
              <select
                className="select-dropdown"
                value={filters.action}
                onChange={(e) => setFilters({...filters, action: e.target.value})}
              >
                <option value="">全部操作</option>
                <option value="CREATE">创建</option>
                <option value="UPDATE">更新</option>
                <option value="PICKUP">领取</option>
                <option value="RETURN">归还</option>
                <option value="CANCEL">取消</option>
                <option value="MODIFY">修改</option>
              </select>
              <input
                type="date"
                className="form-control"
                style={{ maxWidth: '150px' }}
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                placeholder="开始日期"
              />
              <input
                type="date"
                className="form-control"
                style={{ maxWidth: '150px' }}
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                placeholder="结束日期"
              />
              <button className="btn btn-primary" onClick={loadData}>
                🔍 查询
              </button>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作</th>
                  <th>实体类型</th>
                  <th>操作人</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss')}</td>
                    <td>
                      <span className="badge badge-primary">
                        {getActionText(log.action)}
                      </span>
                    </td>
                    <td>{getEntityTypeText(log.entityType)}</td>
                    <td>{log.operator}</td>
                    <td>{log.remarks || '-'}</td>
                    <td>
                      <button 
                        className="btn btn-sm btn-info"
                        onClick={() => handleViewDiff(log.entityType, log.entityId)}
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {logs.length === 0 && (
              <div className="text-center text-muted py-5">
                暂无审计日志
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            <div className="filter-bar">
              <input
                type="text"
                className="search-input"
                style={{ maxWidth: '200px' }}
                placeholder="操作人姓名..."
                value={historyFilter.operator}
                onChange={(e) => setHistoryFilter({...historyFilter, operator: e.target.value})}
              />
              <button className="btn btn-primary" onClick={loadData}>
                🔍 查询
              </button>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>钥匙</th>
                  <th>操作人</th>
                  <th>订单</th>
                  <th>状态</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {history.map(record => (
                  <tr key={record.id}>
                    <td>{moment(record.timestamp).format('YYYY-MM-DD HH:mm:ss')}</td>
                    <td>
                      <span className="badge badge-primary">
                        {record.type === 'pickup' ? '领取' : 
                         record.type === 'return' ? '归还' : '临时借用'}
                      </span>
                    </td>
                    <td>
                      {record.Key ? (
                        <div>
                          <div><strong>{record.Key.keyCode}</strong></div>
                          <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {record.Key.customerName}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <div>{record.operator}</div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        ({record.operatorRole})
                      </div>
                    </td>
                    <td>
                      {record.Order ? record.Order.orderNumber : '-'}
                    </td>
                    <td>
                      <span className={`badge ${
                        record.status === 'completed' ? 'badge-success' :
                        record.status === 'active' ? 'badge-warning' :
                        record.status === 'cancelled' ? 'badge-danger' : 'badge-primary'
                      }`}>
                        {record.status === 'active' ? '进行中' :
                         record.status === 'completed' ? '已完成' :
                         record.status === 'cancelled' ? '已取消' :
                         record.status === 'modified' ? '已修改' : record.status}
                      </span>
                      {record.isOverdue && (
                        <span className="badge badge-danger" style={{ marginLeft: '4px' }}>
                          逾期
                        </span>
                      )}
                    </td>
                    <td>{record.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {history.length === 0 && (
              <div className="text-center text-muted py-5">
                暂无交接记录
              </div>
            )}
          </>
        )}
      </div>

      {showDiff && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                状态差异记录 - {getEntityTypeText(showDiff.entityType)}
              </h3>
              <button className="modal-close" onClick={() => setShowDiff(null)}>
                ×
              </button>
            </div>
            
            {showDiff.data.length > 0 ? (
              <div>
                {showDiff.data.map((diff, index) => (
                  <div key={index} style={{ marginBottom: '1.5rem' }}>
                    <div className="card" style={{ marginBottom: '0.5rem' }}>
                      <div style={{ marginBottom: '1rem', fontWeight: '600' }}>
                        {moment(diff.timestamp).format('YYYY-MM-DD HH:mm:ss')} - 
                        {getActionText(diff.action)} - {diff.operator}
                      </div>
                      
                      <div className="diff-container">
                        <div className="diff-box old">
                          <div className="diff-title">变更前</div>
                          <div style={{ fontSize: '0.875rem' }}>
                            {formatJSON(diff.oldValue)}
                          </div>
                        </div>
                        <div className="diff-box new">
                          <div className="diff-title">变更后</div>
                          <div style={{ fontSize: '0.875rem' }}>
                            {formatJSON(diff.newValue)}
                          </div>
                        </div>
                      </div>
                      
                      {diff.remarks && (
                        <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#6c757d' }}>
                          备注：{diff.remarks}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted">暂无差异记录</p>
            )}

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowDiff(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🔍 审计功能说明</h3>
        </div>
        <div style={{ lineHeight: '1.8' }}>
          <p><strong>审计日志：</strong></p>
          <ul>
            <li>记录所有钥匙、订单的创建、更新操作</li>
            <li>记录钥匙领取、归还的完整流程</li>
            <li>支持按实体类型、操作类型、时间范围筛选</li>
            <li>可导出CSV和JSON格式，方便给客户或主管查看</li>
          </ul>
          
          <p><strong>状态差异追踪：</strong></p>
          <ul>
            <li>每次修改都会记录旧值和新值</li>
            <li>撤销或修正记录不会直接覆盖，而是保留历史</li>
            <li>可以查看任意时间点的状态变化</li>
            <li>包含操作人和修改原因</li>
          </ul>
          
          <p><strong>导出报告内容：</strong></p>
          <ul>
            <li>时间戳、操作类型、实体类型</li>
            <li>操作人、旧状态、新状态</li>
            <li>备注信息</li>
            <li>可用于给客户说明钥匙去向和使用记录</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AuditPage;
