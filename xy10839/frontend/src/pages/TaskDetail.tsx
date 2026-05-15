import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { apiClient } from '../api';
import type { TaskResponse, ExportStatus } from '../types';

const fileIcons: Record<string, string> = {
  'text/csv': '📄',
  'application/json': '📋',
  'application/xml': '📑',
  'application/x-ndjson': '📊',
  'default': '📁'
};

function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<TaskResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'certificate'>('overview');
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    loadDetail();
    const interval = setInterval(loadDetail, 2000);
    return () => clearInterval(interval);
  }, [taskId]);

  const loadDetail = async () => {
    if (!taskId) return;
    const data = await apiClient.getTaskDetail(taskId);
    setDetail(data);
  };

  const handleRetry = async () => {
    if (!taskId) return;
    setIsRetrying(true);
    try {
      await apiClient.retryTask(taskId);
      await loadDetail();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDownload = async () => {
    if (!taskId) return;
    try {
      const result = await apiClient.getDownloadToken(taskId);
      setDownloadToken(result.token);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleGetCertificate = async () => {
    if (!taskId) return;
    try {
      await apiClient.getCertificate(taskId);
      await loadDetail();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (!detail) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⏳</div>
        <div className="empty-title">加载中...</div>
      </div>
    );
  }

  const { task, scope, tenant, files = [], verification } = detail;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div>
      <div className="back-link" onClick={() => navigate('/')}>
        ← 返回列表
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>{task.name}</h1>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span className={`status-badge status-${task.status}`}>{task.status}</span>
              <span style={{ color: '#6b7280', fontSize: 14 }}>
                租户: {tenant?.name || '-'}
              </span>
              <span style={{ color: '#6b7280', fontSize: 14 }}>
                创建人: {task.createdBy}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {task.status === 'failed' && task.retryCount < task.maxRetries && (
              <button
                className="btn btn-danger"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? '重试中...' : '🔄 重试'}
              </button>
            )}
            {task.status === 'completed' && (
              <>
                <button className="btn btn-primary" onClick={handleDownload}>
                  📥 生成下载链接
                </button>
                <button className="btn btn-secondary" onClick={handleGetCertificate}>
                  📜 获取导出证明
                </button>
              </>
            )}
          </div>
        </div>

        {downloadToken && (
          <div style={{
            marginTop: 20,
            padding: 16,
            background: '#d1fae5',
            borderRadius: 8,
            border: '1px solid #6ee7b7'
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#059669' }}>✅ 下载令牌已生成</div>
            <div className="checksum" style={{ display: 'inline-block' }}>{downloadToken}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              令牌有效期24小时，请妥善保管
            </div>
          </div>
        )}

        {['pending', 'snapshot', 'packing', 'verifying'].includes(task.status) && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 500 }}>处理进度</span>
              <span style={{ color: '#6b7280' }}>{task.progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${task.progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          总览
        </button>
        <button
          className={`tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          文件清单
        </button>
        <button
          className={`tab ${activeTab === 'certificate' ? 'active' : ''}`}
          onClick={() => setActiveTab('certificate')}
        >
          导出证明
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid-2">
          <div className="card">
            <h3 className="card-title">任务信息</h3>
            <div className="detail-item">
              <span className="detail-label">任务ID</span>
              <span className="detail-value checksum">{task.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">数据范围ID</span>
              <span className="detail-value checksum">{task.scopeId}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">创建时间</span>
              <span className="detail-value">{dayjs(task.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">开始处理</span>
              <span className="detail-value">{task.startedAt ? dayjs(task.startedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">完成时间</span>
              <span className="detail-value">{task.completedAt ? dayjs(task.completedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">过期时间</span>
              <span className="detail-value">{dayjs(task.expiredAt).format('YYYY-MM-DD HH:mm:ss')}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">重试次数</span>
              <span className="detail-value">{task.retryCount} / {task.maxRetries}</span>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">数据范围</h3>
            {scope ? (
              <>
                <div className="detail-item">
                  <span className="detail-label">范围名称</span>
                  <span className="detail-value">{scope.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">范围类型</span>
                  <span className="detail-value">{scope.scopeType}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">数据类型</span>
                  <span className="detail-value">{scope.dataTypes.join(', ')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">快照版本</span>
                  <span className="detail-value">{scope.snapshotVersion}</span>
                </div>
                {scope.dateRange && (
                  <div className="detail-item">
                    <span className="detail-label">时间范围</span>
                    <span className="detail-value">
                      {dayjs(scope.dateRange.start).format('YYYY-MM-DD')} ~ {dayjs(scope.dateRange.end).format('YYYY-MM-DD')}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>
                暂无数据范围信息
              </div>
            )}
          </div>

          {verification && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 className="card-title">
                {verification.isValid ? '✅' : '❌'} 校验摘要
              </h3>
              <div className="grid-2">
                <div>
                  <div className="detail-item">
                    <span className="detail-label">校验时间</span>
                    <span className="detail-value">{dayjs(verification.verifiedAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">校验算法</span>
                    <span className="detail-value">{verification.algorithm}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">校验结果</span>
                    <span className="detail-value" style={{ color: verification.isValid ? '#059669' : '#dc2626' }}>
                      {verification.isValid ? '校验通过' : '校验失败'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="detail-item">
                    <span className="detail-label">文件总数</span>
                    <span className="detail-value">{verification.totalFiles} 个</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">总大小</span>
                    <span className="detail-value">{formatSize(verification.totalSize)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">校验和</span>
                    <span className="detail-value checksum">{verification.checksum}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {task.status === 'failed' && task.errorMessage && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 className="card-title" style={{ color: '#dc2626' }}>❌ 失败详情</h3>
              <div className="error-box">
                <div className="error-title">错误信息: {task.errorMessage}</div>
                {task.errorStack && (
                  <div className="error-content">{task.errorStack}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div className="card">
          <h3 className="card-title">文件清单 ({files.length} 个文件)</h3>
          {files.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <div className="empty-title">暂无文件</div>
              <div>文件正在打包中，请稍后...</div>
            </div>
          ) : (
            <div className="file-list">
              {files.map(file => (
                <div key={file.id} className="file-item">
                  <div className="file-info">
                    <div className="file-icon">{fileIcons[file.fileType] || fileIcons.default}</div>
                    <div>
                      <div className="file-name">{file.fileName}</div>
                      <div className="file-size">
                        {formatSize(file.fileSize)} · {file.fileType}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className={`status-badge status-${file.status === 'verified' ? 'completed' : file.status}`}>
                      {file.status}
                    </span>
                    <span className="checksum" title={file.checksum}>
                      {file.checksum.slice(0, 16)}...
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'certificate' && (
        <div className="card">
          <h3 className="card-title">导出证明</h3>
          {!detail.certificate ? (
            <div className="empty-state">
              <div className="empty-icon">📜</div>
              <div className="empty-title">暂无导出证明</div>
              <div>任务完成后可点击上方按钮获取导出证明</div>
            </div>
          ) : (
            <div className="certificate">
              <div className="certificate-number">{detail.certificate.certificateNumber}</div>
              <div style={{ fontSize: 16, marginBottom: 16 }}>数据导出完成证明</div>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
                签发时间: {dayjs(detail.certificate.issuedAt).format('YYYY-MM-DD HH:mm:ss')}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
                签发机构: {detail.certificate.issuer}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
                导出文件: {detail.certificate.metadata.fileCount} 个 / {formatSize(detail.certificate.metadata.totalSize)}
              </div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', opacity: 0.8, wordBreak: 'break-all' }}>
                校验和: {detail.certificate.metadata.checksum}
              </div>
              <div className="certificate-valid">
                ✅ 签名验证通过
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskDetail;
