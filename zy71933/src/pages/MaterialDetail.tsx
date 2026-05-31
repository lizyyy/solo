import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Material, MaterialStatus, AuthorizationFile } from '../types';
import { getMaterialById, updateMaterialStatus, addAuthorizationFile, checkAuthExpiry, generateId } from '../services/storage';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, exportDeliveryNote } from '../services/export';

export const MaterialDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [material, setMaterial] = useState<Material | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [newStatus, setNewStatus] = useState<MaterialStatus>('pending');
  const [statusReason, setStatusReason] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [authFileName, setAuthFileName] = useState('');
  const [authExpiryDate, setAuthExpiryDate] = useState('');
  const [authNotes, setAuthNotes] = useState('');

  useEffect(() => {
    if (id) {
      const m = getMaterialById(id);
      if (m) {
        setMaterial(m);
        setNewStatus(m.currentStatus);
      }
    }
  }, [id]);

  const handleStatusUpdate = () => {
    if (!id || !statusReason.trim()) {
      alert('请填写状态变更原因');
      return;
    }

    const updated = updateMaterialStatus(id, newStatus, statusReason, statusComment);
    if (updated) {
      setMaterial(updated);
      setShowStatusModal(false);
      setStatusReason('');
      setStatusComment('');
    }
  };

  const handleAddAuthFile = () => {
    if (!id || !authFileName.trim() || !authExpiryDate) {
      alert('请填写文件名和到期日');
      return;
    }

    const authFile: Omit<AuthorizationFile, 'id' | 'uploadDate' | 'uploadedBy'> = {
      name: authFileName,
      expiryDate: authExpiryDate,
      fileHash: generateId(),
      notes: authNotes
    };

    const updated = addAuthorizationFile(id, authFile);
    if (updated) {
      setMaterial(updated);
      setShowAuthModal(false);
      setAuthFileName('');
      setAuthExpiryDate('');
      setAuthNotes('');
    }
  };

  const handleExport = () => {
    if (material) {
      exportDeliveryNote([material]);
    }
  };

  if (!material) {
    return (
      <div className="card empty-state">
        <p>物料不存在</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '20px' }}>返回列表</Link>
      </div>
    );
  }

  const isAuthExpired = checkAuthExpiry(material);

  return (
    <div>
      <Link to="/" className="back-link">← 返回列表</Link>

      {isAuthExpired && (
        <div className="alert alert-danger">
          ⚠️ 该物料存在已过期的授权文件，请及时更新
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{material.name}</h2>
          <div className="actions">
            <StatusBadge status={material.currentStatus} />
            <button className="btn btn-sm btn-secondary" onClick={handleExport}>
              导出
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => setShowStatusModal(true)}>
              更新状态
            </button>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>物料来源</label>
            <p>{material.source}</p>
          </div>
          <div className="form-group">
            <label>批次号</label>
            <p><span className="badge">{material.batchId}</span></p>
          </div>
        </div>

        <div className="form-group">
          <label>状态原因</label>
          <p style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px' }}>
            {material.statusReason || '无'}
          </p>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>创建人</label>
            <p>{material.createdBy}</p>
          </div>
          <div className="form-group">
            <label>创建时间</label>
            <p>{formatDate(material.createdAt)}</p>
          </div>
          <div className="form-group">
            <label>最后修改人</label>
            <p>{material.lastModifiedBy}</p>
          </div>
          <div className="form-group">
            <label>最后修改时间</label>
            <p>{formatDate(material.lastModifiedAt)}</p>
          </div>
        </div>

        {material.tags.length > 0 && (
          <div className="form-group">
            <label>标签</label>
            <div>
              {material.tags.map(tag => (
                <span key={tag} className="badge">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {material.reviewComments && (
          <div className="form-group">
            <label>审稿意见</label>
            <p style={{ background: '#f8f9fa', padding: '10px', borderRadius: '4px' }}>
              {material.reviewComments}
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">授权文件</h3>
          <button className="btn btn-sm btn-success" onClick={() => setShowAuthModal(true)}>
            + 上传授权
          </button>
        </div>

        {material.authorizationFiles.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>暂无授权文件</p>
        ) : (
          <div className="file-list">
            {material.authorizationFiles.map(file => {
              const isExpired = new Date(file.expiryDate) < new Date();
              return (
                <div key={file.id} className="file-item">
                  <div className="file-info">
                    <span className="file-name">
                      📄 {file.name}
                      {isExpired && <span className="expired" style={{ marginLeft: '10px' }}>[已过期]</span>}
                    </span>
                    <span className="file-meta">
                      上传人: {file.uploadedBy} | 上传时间: {formatDate(file.uploadDate)} | 到期日: {file.expiryDate}
                    </span>
                    {file.notes && (
                      <span className="file-meta">备注: {file.notes}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">版本历史 (当前 v{material.currentVersion})</h3>
        </div>

        <div className="timeline">
          {[...material.versionHistory].reverse().map(version => (
            <div key={version.version} className="timeline-item">
              <div className="timeline-header">
                <span className="timeline-version">v{version.version}</span>
                <span className="timeline-date">{formatDate(version.timestamp)}</span>
              </div>
              <div className="timeline-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span><strong>{version.modifiedBy}</strong></span>
                  <StatusBadge status={version.status} />
                </div>
                <p style={{ marginBottom: '8px', fontSize: '14px' }}>{version.comment}</p>
                <div style={{ borderTop: '1px solid #eee', paddingTop: '8px' }}>
                  {version.changes.map((change, idx) => (
                    <div key={idx} className="change-item">
                      <span>{change.field}: </span>
                      {change.oldValue && <span className="old">{change.oldValue}</span>}
                      {change.oldValue && change.newValue && <span> → </span>}
                      <span className="new">{change.newValue}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showStatusModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>更新状态</h3>
              <button className="modal-close" onClick={() => setShowStatusModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label>新状态</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as MaterialStatus)}>
                <option value="pending">待处理</option>
                <option value="approved">已通过</option>
                <option value="rejected">已拒绝</option>
                <option value="needs_revision">需修改</option>
                <option value="auth_expired">授权过期</option>
              </select>
            </div>

            <div className="form-group">
              <label>状态原因 *</label>
              <textarea 
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="请说明为什么变更状态..."
              />
            </div>

            <div className="form-group">
              <label>备注（可选）</label>
              <textarea 
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
                placeholder="其他说明..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleStatusUpdate}>确认更新</button>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>上传授权文件</h3>
              <button className="modal-close" onClick={() => setShowAuthModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label>文件名 *</label>
              <input 
                type="text"
                value={authFileName}
                onChange={(e) => setAuthFileName(e.target.value)}
                placeholder="例如：品牌授权书_2024.pdf"
              />
            </div>

            <div className="form-group">
              <label>授权到期日 *</label>
              <input 
                type="date"
                value={authExpiryDate}
                onChange={(e) => setAuthExpiryDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>备注（可选）</label>
              <textarea 
                value={authNotes}
                onChange={(e) => setAuthNotes(e.target.value)}
                placeholder="授权范围、特殊说明等..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAuthModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleAddAuthFile}>上传</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
