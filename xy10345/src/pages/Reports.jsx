import React, { useState, useEffect } from 'react';
import { reportApi, propertyApi, auditApi } from '../services/api';
import { 
  formatDateTime, 
  getPasswordTypeLabel,
  getPasswordStatusBadge
} from '../utils/helpers';

function Reports() {
  const [report, setReport] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedProperty]);

  const loadData = async () => {
    try {
      const [reportRes, propertiesRes, auditRes] = await Promise.all([
        selectedProperty 
          ? reportApi.getPasswordStatus(selectedProperty)
          : reportApi.getPasswordStatus(),
        propertyApi.getAll(),
        auditApi.getAll()
      ]);
      
      setReport(reportRes.data);
      setProperties(propertiesRes.data);
      setAuditLogs(auditRes.data);
    } catch (error) {
      console.error('加载报告失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPropertyName = (propertyId) => {
    const property = properties.find(p => p.id === propertyId);
    return property ? property.name : propertyId;
  };

  const getActionLabel = (action) => {
    const actions = {
      generate: '生成密码',
      revoke: '作废密码',
      extend: '延期密码',
      block: '拦截访问',
      expire: '自动失效'
    };
    return actions[action] || action;
  };

  const exportReport = async (format) => {
    try {
      const res = await reportApi.export(format);
      
      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `password-report-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const dataStr = JSON.stringify(res.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `password-report-${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      
      setMessage({ type: 'success', text: '报告导出成功！' });
    } catch (error) {
      setMessage({ type: 'error', text: '导出失败' });
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>📋 审计报告</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => exportReport('json')}
          >
            📄 导出 JSON
          </button>
          <button 
            className="btn btn-success btn-sm"
            onClick={() => exportReport('csv')}
          >
            📊 导出 CSV
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <h3 className="card-title">筛选房源</h3>
        <select 
          className="form-select"
          style={{ maxWidth: '300px' }}
          value={selectedProperty}
          onChange={e => setSelectedProperty(e.target.value)}
        >
          <option value="">全部房源</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <h3 className="card-title">📊 密码状态报告</h3>
        
        {report && report.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>房源</th>
                <th>密码名称</th>
                <th>类型</th>
                <th>密码</th>
                <th>生效时间</th>
                <th>失效时间</th>
                <th>状态</th>
                <th>状态说明</th>
              </tr>
            </thead>
            <tbody>
              {report.map(pwd => {
                const statusBadge = getPasswordStatusBadge(pwd.validation?.status || pwd.status);
                return (
                  <tr key={pwd.id}>
                    <td>{getPropertyName(pwd.propertyId)}</td>
                    <td>{pwd.name}</td>
                    <td>{getPasswordTypeLabel(pwd.type)}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{pwd.code}</span>
                    </td>
                    <td className="text-sm">{formatDateTime(pwd.validFrom)}</td>
                    <td className="text-sm">{formatDateTime(pwd.validTo)}</td>
                    <td>
                      <span className={`badge ${statusBadge.class}`}>{statusBadge.label}</span>
                    </td>
                    <td className="text-sm text-muted">
                      {pwd.validation?.reason || pwd.reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>暂无密码数据</p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">📝 审计日志</h3>
        
        {auditLogs.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>房源</th>
                <th>操作类型</th>
                <th>描述</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(log => (
                <tr key={log.id}>
                  <td className="text-sm">{formatDateTime(log.timestamp)}</td>
                  <td>{getPropertyName(log.propertyId)}</td>
                  <td>
                    <span className={`badge ${
                      log.action === 'block' ? 'badge-danger' : 
                      log.action === 'generate' ? 'badge-success' : 
                      log.action === 'revoke' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td className="text-sm">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>暂无审计日志</p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">📋 报告说明</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div className="explanation-box">
            <h4>密码状态说明</h4>
            <ul>
              <li><strong>✅ 生效中</strong>：密码在有效期内，可正常使用</li>
              <li><strong>⏳ 待生效</strong>：未到生效时间，密码暂不可用</li>
              <li><strong>❌ 已过期</strong>：已过有效期，密码已失效</li>
              <li><strong>🚫 已作废</strong>：被管理员手动作废</li>
            </ul>
          </div>
          <div className="explanation-box">
            <h4>安全机制说明</h4>
            <ul>
              <li>所有密码操作都记录到审计日志</li>
              <li>异常访问尝试会被拦截并告警</li>
              <li>维修密码仅在维修状态下可用</li>
              <li>密码时间重叠会被自动拦截</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;
