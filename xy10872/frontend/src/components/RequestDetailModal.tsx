import { useState, useEffect } from 'react';
import { ResetRequest, ResetStatus, RecoveryLog, RetainedFile, ExportReport, LogLevel } from '../types';
import { resetRequestsApi } from '../services/api';
import StatusBadge from './StatusBadge';

interface RequestDetailModalProps {
  request: ResetRequest;
  logs: RecoveryLog[];
  retainedFiles: RetainedFile[];
  exportReport: ExportReport | null;
  onClose: () => void;
  onStatusUpdate: (status: ResetStatus, reason: string) => void;
}

const RequestDetailModal = ({
  request,
  logs,
  retainedFiles,
  exportReport,
  onClose,
  onStatusUpdate,
}: RequestDetailModalProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'files' | 'export'>('overview');
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [newStatus, setNewStatus] = useState<ResetStatus>(ResetStatus.APPROVED);
  const [statusReason, setStatusReason] = useState('');
  const [availableTransitions, setAvailableTransitions] = useState<string[]>([]);
  const [loadingTransitions, setLoadingTransitions] = useState(false);

  useEffect(() => {
    loadAvailableTransitions();
  }, [request.id, request.status]);

  const loadAvailableTransitions = async () => {
    setLoadingTransitions(true);
    try {
      const data = await resetRequestsApi.getAvailableTransitions(request.id);
      setAvailableTransitions(data.available_transitions);
      if (data.available_transitions.length > 0) {
        setNewStatus(data.available_transitions[0] as ResetStatus);
      }
    } catch (error) {
      console.error('Failed to load transitions:', error);
      setAvailableTransitions([]);
    } finally {
      setLoadingTransitions(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const handleExportJson = () => {
    if (!exportReport) return;
    const dataStr = JSON.stringify(exportReport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reset-request-${request.id}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      approved: '批准申请',
      processing: '开始处理',
      success: '标记成功',
      failed: '标记失败',
      blocked: '拦截申请',
      cancelled: '取消申请',
    };
    return labels[status] || status;
  };

  const availableStatuses = availableTransitions as ResetStatus[];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>重置申请 #{request.id} 详情</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <StatusBadge status={request.status} />
            {request.status_reason && (
              <span style={{ fontSize: '13px', color: '#6c757d' }}>
                备注: {request.status_reason}
              </span>
            )}
          </div>

          {exportReport && (
            <div className="alert alert-info">
              <span>ℹ️</span>
              <div>
                <strong>状态说明</strong>
                <p>{exportReport.status.explanation}</p>
              </div>
            </div>
          )}

          {!loadingTransitions && availableStatuses.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              {!showStatusUpdate ? (
                <button 
                  className="btn btn-warning"
                  onClick={() => setShowStatusUpdate(true)}
                >
                  推进状态
                </button>
              ) : (
                <div style={{ padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div className="form-group">
                    <label>选择新状态</label>
                    <select 
                      value={newStatus} 
                      onChange={e => setNewStatus(e.target.value as ResetStatus)}
                    >
                      {availableStatuses.map(status => (
                        <option key={status} value={status}>
                          {getStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>原因说明</label>
                    <textarea 
                      value={statusReason}
                      onChange={e => setStatusReason(e.target.value)}
                      placeholder="请输入状态变更原因..."
                      rows={2}
                    />
                  </div>
                  <div className="btn-group">
                    <button 
                      className="btn btn-primary"
                      onClick={() => {
                        onStatusUpdate(newStatus, statusReason);
                        setShowStatusUpdate(false);
                      }}
                    >
                      确认变更
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => setShowStatusUpdate(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            概览
          </button>
          <button 
            className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            历史轨迹 ({logs.length})
          </button>
          <button 
            className={`tab ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            保留文件 ({retainedFiles.length})
          </button>
          <button 
            className={`tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            导出报告
          </button>
        </div>

        {activeTab === 'overview' && exportReport && (
          <div>
            <div className="detail-row">
              <span className="detail-label">实验空间</span>
              <span className="detail-value">{exportReport.lab_space.name} ({exportReport.lab_space.student_name})</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">目标快照</span>
              <span className="detail-value">{exportReport.snapshot.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">申请人</span>
              <span className="detail-value">{exportReport.request_info.requested_by_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">申请原因</span>
              <span className="detail-value">{exportReport.request_info.reason || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">申请时间</span>
              <span className="detail-value">{formatDate(exportReport.request_info.created_at)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">批准人</span>
              <span className="detail-value">{exportReport.status.approved_by || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">开始时间</span>
              <span className="detail-value">{formatDate(exportReport.status.started_at)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">完成时间</span>
              <span className="detail-value">{formatDate(exportReport.status.completed_at)}</span>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="timeline">
            {logs.map(log => (
              <div 
                key={log.id} 
                className={`timeline-item ${log.level === LogLevel.WARNING ? 'warning' : log.level === LogLevel.ERROR ? 'error' : ''}`}
              >
                <div className="timeline-time">{formatDate(log.created_at)}</div>
                <div className="timeline-message">{log.message}</div>
                {log.details && <div className="timeline-details">{log.details}</div>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'files' && (
          <div>
            {retainedFiles.length === 0 ? (
              <div className="empty-state">
                <p>暂无保留的文件</p>
              </div>
            ) : (
              retainedFiles.map(file => (
                <div key={file.id} className="file-item">
                  <span className="file-icon">📄</span>
                  <div className="file-info">
                    <h4>{file.file_path}</h4>
                    <p>{file.reason || '保留文件'}</p>
                  </div>
                  {file.is_submission && <span className="submission-tag">提交文件</span>}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'export' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button className="btn btn-primary" onClick={handleExportJson}>
                ⬇️ 导出 JSON 报告
              </button>
            </div>
            {exportReport && (
              <pre className="json-preview">
                {JSON.stringify(exportReport, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestDetailModal;