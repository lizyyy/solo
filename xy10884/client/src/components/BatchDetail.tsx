import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RenewalBatch, Device, CompensationAttempt } from '../types';
import { api } from '../api';

interface BatchDetailProps {
  onBack: () => void;
  onRefresh: () => void;
}

const BatchDetail: React.FC<BatchDetailProps> = ({ onBack, onRefresh }) => {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<RenewalBatch | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeTab, setActiveTab] = useState('records');
  const [showCompensateModal, setShowCompensateModal] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [operator, setOperator] = useState('admin');
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    const [batchData, devicesData] = await Promise.all([
      api.getBatch(id),
      api.getDevices()
    ]);
    setBatch(batchData);
    setDevices(devicesData);
  };

  const loadReport = async () => {
    if (!id) return;
    const reportData = await api.getReport(id);
    setReport(reportData);
  };

  const getDeviceName = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    return device?.name || deviceId;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待处理',
      success: '续期成功',
      failed: '签发失败',
      revoking: '吊销中',
      revoked: '已吊销',
      revoke_failed: '吊销失败',
      compensating: '待补偿',
      compensated: '补偿成功'
    };
    return labels[status] || status;
  };

  const handleIssueCallback = async (deviceId: string, success: boolean) => {
    if (!id) return;
    await api.simulateIssueCallback(id, deviceId, success);
    await loadData();
    onRefresh();
  };

  const handleRevokeCallback = async (deviceId: string, success: boolean) => {
    if (!id) return;
    await api.simulateRevokeCallback(id, deviceId, success);
    await loadData();
    onRefresh();
  };

  const handleCompensate = async () => {
    if (!id || selectedDevices.length === 0) return;
    await api.compensate(id, selectedDevices, operator);
    await loadData();
    onRefresh();
    setShowCompensateModal(false);
    setSelectedDevices([]);
  };

  const compensatingDevices = batch?.records.filter(r => r.status === 'compensating') || [];
  const revokeRecords = batch?.records.filter(r => 
    r.status === 'revoking' || r.status === 'success' || r.status === 'revoke_failed'
  ) || [];

  if (!batch) {
    return <div className="empty-state"><h3>加载中...</h3></div>;
  }

  return (
    <div className="detail-page">
      <div className="back-btn" onClick={onBack}>
        ← 返回列表
      </div>

      <div className="detail-header">
        <h2>{batch.name}</h2>
        <div className="batch-meta" style={{ marginTop: '8px' }}>
          批次ID: {batch.id} | 创建人: {batch.createdBy} | 创建时间: {new Date(batch.createdAt).toLocaleString()}
        </div>
        <div className="detail-actions">
          <button className="btn btn-primary" onClick={loadData}>🔄 刷新</button>
          <button 
            className="btn btn-success" 
            onClick={() => { loadReport(); setActiveTab('report'); }}
          >
            📊 生成复盘报告
          </button>
          {compensatingDevices.length > 0 && (
            <button className="btn btn-danger" onClick={() => setShowCompensateModal(true)}>
              🔧 发起补偿 ({compensatingDevices.length})
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>
          续期记录
        </button>
        <button className={`tab ${activeTab === 'receipts' ? 'active' : ''}`} onClick={() => setActiveTab('receipts')}>
          签发回执
        </button>
        <button className={`tab ${activeTab === 'offline' ? 'active' : ''}`} onClick={() => setActiveTab('offline')}>
          离线设备
        </button>
        <button className={`tab ${activeTab === 'revoke' ? 'active' : ''}`} onClick={() => setActiveTab('revoke')}>
          吊销记录
        </button>
        <button className={`tab ${activeTab === 'compensation' ? 'active' : ''}`} onClick={() => setActiveTab('compensation')}>
          补偿记录
        </button>
        <button className={`tab ${activeTab === 'report' ? 'active' : ''}`} onClick={() => { loadReport(); setActiveTab('report'); }}>
          复盘报告
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'records' && (
          <table className="table">
            <thead>
              <tr>
                <th>设备名称</th>
                <th>旧证书SN</th>
                <th>新证书SN</th>
                <th>状态</th>
                <th>签发时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {batch.records.map(record => (
                <tr key={record.deviceId}>
                  <td>{getDeviceName(record.deviceId)}</td>
                  <td><code>{record.oldCertSn}</code></td>
                  <td><code>{record.newCertSn || '-'}</code></td>
                  <td>
                    <span className={`status-badge status-${record.status}`}>
                      {getStatusLabel(record.status)}
                    </span>
                  </td>
                  <td>{record.issuedAt ? new Date(record.issuedAt).toLocaleString() : '-'}</td>
                  <td>
                    {record.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm btn-success" onClick={() => handleIssueCallback(record.deviceId, true)}>
                          模拟成功
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleIssueCallback(record.deviceId, false)}>
                          模拟失败
                        </button>
                      </div>
                    )}
                    {record.status === 'revoking' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm btn-success" onClick={() => handleRevokeCallback(record.deviceId, true)}>
                          模拟吊销成功
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleRevokeCallback(record.deviceId, false)}>
                          模拟吊销失败
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'receipts' && (
          <table className="table">
            <thead>
              <tr>
                <th>设备名称</th>
                <th>新证书SN</th>
                <th>CA回执编号</th>
                <th>签发时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {batch.records.filter(r => r.issueReceipt).map(record => (
                <tr key={record.deviceId}>
                  <td>{getDeviceName(record.deviceId)}</td>
                  <td><code>{record.newCertSn}</code></td>
                  <td><code style={{ color: '#10b981' }}>{record.issueReceipt}</code></td>
                  <td>{record.issuedAt ? new Date(record.issuedAt).toLocaleString() : '-'}</td>
                  <td>
                    <span className={`status-badge status-${record.status}`}>
                      {getStatusLabel(record.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {batch.records.filter(r => r.issueReceipt).length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">暂无签发回执记录</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'offline' && (
          <div>
            <h4 style={{ marginBottom: '16px' }}>离线设备 ({compensatingDevices.length})</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>设备名称</th>
                  <th>IP地址</th>
                  <th>位置</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {compensatingDevices.map(record => {
                  const device = devices.find(d => d.id === record.deviceId);
                  return (
                    <tr key={record.deviceId}>
                      <td>{getDeviceName(record.deviceId)}</td>
                      <td>{device?.ipAddress || '-'}</td>
                      <td>{device?.location || '-'}</td>
                      <td>
                        <span className="status-badge status-compensating">待补偿</span>
                      </td>
                    </tr>
                  );
                })}
                {compensatingDevices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">暂无离线设备</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'revoke' && (
          <div>
            <h4 style={{ marginBottom: '16px' }}>旧证吊销链路 ({revokeRecords.length})</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>设备名称</th>
                  <th>旧证书SN</th>
                  <th>新证书SN</th>
                  <th>吊销状态</th>
                  <th>CA吊销回执</th>
                  <th>吊销时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {revokeRecords.map(record => (
                  <tr key={record.deviceId}>
                    <td>{getDeviceName(record.deviceId)}</td>
                    <td><code>{record.oldCertSn}</code></td>
                    <td><code>{record.newCertSn || '-'}</code></td>
                    <td>
                      <span className={`status-badge status-${record.status}`}>
                        {record.status === 'revoking' ? '吊销中' : 
                         record.status === 'success' ? '已吊销' : '吊销失败'}
                      </span>
                    </td>
                    <td>
                      {record.revokeReceipt ? (
                        <code style={{ color: '#10b981' }}>{record.revokeReceipt}</code>
                      ) : record.revokeError ? (
                        <span style={{ color: '#ef4444' }}>{record.revokeError}</span>
                      ) : '-'}
                    </td>
                    <td>{record.revokedAt ? new Date(record.revokedAt).toLocaleString() : '-'}</td>
                    <td>
                      {(record.status === 'revoking' || record.status === 'revoke_failed') && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-sm btn-success" onClick={() => handleRevokeCallback(record.deviceId, true)}>
                            模拟吊销成功
                          </button>
                          {record.status === 'revoking' && (
                            <button className="btn btn-sm btn-danger" onClick={() => handleRevokeCallback(record.deviceId, false)}>
                              模拟吊销失败
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {revokeRecords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">暂无吊销记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'compensation' && (
          <div>
            <h4 style={{ marginBottom: '16px' }}>补偿尝试记录</h4>
            {batch.compensationAttempts.length === 0 ? (
              <div className="empty-state">暂无补偿记录</div>
            ) : (
              <div className="timeline">
                {batch.compensationAttempts
                  .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
                  .map((attempt: CompensationAttempt) => (
                    <div key={attempt.id} className="timeline-item">
                      <div className="timeline-time">
                        {new Date(attempt.attemptedAt).toLocaleString()}
                      </div>
                      <div>
                        <strong>{getDeviceName(attempt.deviceId)}</strong>
                        <span className="timeline-operator"> · 操作人: {attempt.operator}</span>
                        <span className={`status-badge status-${attempt.status === 'success' ? 'success' : 'failed'}`} style={{ marginLeft: '8px' }}>
                          {attempt.status === 'success' ? '补偿成功' : '补偿失败'}
                        </span>
                      </div>
                      {attempt.errorMessage && (
                        <div className="timeline-error">错误: {attempt.errorMessage}</div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'report' && report && (
          <div>
            <h4 style={{ marginBottom: '16px' }}>复盘报告 - 生成时间: {new Date(report.generatedAt).toLocaleString()}</h4>
            
            <div className="stats-grid">
              <div className="stat-card">
                <h4>总设备数</h4>
                <div className="value">{report.stats.total}</div>
              </div>
              <div className="stat-card">
                <h4>续期成功</h4>
                <div className="value" style={{ color: '#10b981' }}>{report.stats.success}</div>
              </div>
              <div className="stat-card">
                <h4>续期失败</h4>
                <div className="value" style={{ color: '#ef4444' }}>{report.stats.failed}</div>
              </div>
              <div className="stat-card">
                <h4>待处理</h4>
                <div className="value" style={{ color: '#f59e0b' }}>{report.stats.pending}</div>
              </div>
              <div className="stat-card">
                <h4>待补偿</h4>
                <div className="value" style={{ color: '#8b5cf6' }}>{report.stats.compensating}</div>
              </div>
              <div className="stat-card">
                <h4>吊销失败</h4>
                <div className="value" style={{ color: '#ef4444' }}>{report.stats.revokeFailed}</div>
              </div>
            </div>

            <h4 style={{ margin: '24px 0 16px' }}>需要关注的离线设备</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>设备名称</th>
                  <th>状态</th>
                  <th>补偿尝试次数</th>
                </tr>
              </thead>
              <tbody>
                {report.offlineDevices.map((item: any) => {
                  const attempts = batch.compensationAttempts.filter(a => a.deviceId === item.deviceId).length;
                  return (
                    <tr key={item.deviceId}>
                      <td>{getDeviceName(item.deviceId)}</td>
                      <td><span className="status-badge status-compensating">待补偿</span></td>
                      <td>{attempts} 次</td>
                    </tr>
                  );
                })}
                {report.offlineDevices.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-state">无需要关注的离线设备</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCompensateModal && (
        <div className="modal-overlay" onClick={() => setShowCompensateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>发起补偿</h3>
            <div className="form-group">
              <label>操作人</label>
              <input
                type="text"
                value={operator}
                onChange={e => setOperator(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>选择要补偿的设备</label>
              <div className="checkbox-group">
                {compensatingDevices.map(record => (
                  <div key={record.deviceId} className="checkbox-item">
                    <input
                      type="checkbox"
                      id={record.deviceId}
                      checked={selectedDevices.includes(record.deviceId)}
                      onChange={() => {
                        if (selectedDevices.includes(record.deviceId)) {
                          setSelectedDevices(selectedDevices.filter(d => d !== record.deviceId));
                        } else {
                          setSelectedDevices([...selectedDevices, record.deviceId]);
                        }
                      }}
                    />
                    <label htmlFor={record.deviceId}>{getDeviceName(record.deviceId)}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCompensateModal(false)}>取消</button>
              <button 
                className="btn btn-primary" 
                onClick={handleCompensate}
                disabled={selectedDevices.length === 0}
              >
                发起补偿
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchDetail;