import React, { useState } from 'react';
import dayjs from 'dayjs';
import { transferRequestsAPI } from '../services/api';

function TransferRequestModal({ hospitalization, cages, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    to_cage_id: '',
    request_reason: '',
    requested_by: '当前用户'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const availableCages = cages.filter(cage => {
    if (cage.id === hospitalization.cage_id) return false;
    if (hospitalization.is_infectious && !cage.is_isolation) return false;
    if (!hospitalization.is_infectious && cage.is_isolation) return false;
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.to_cage_id) {
      setError('请选择目标笼位');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await transferRequestsAPI.create(formData);
      alert('转笼申请已提交！');
      onSuccess();
      onClose();
    } catch (error) {
      setError(error.response?.data?.error || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>申请转笼 - {hospitalization.pet_name}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-danger">
              ❌ {error}
            </div>
          )}

          <div style={{
            background: '#f8f9fa',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              当前笼位: <strong>{hospitalization.cage_number}</strong>
            </div>
            {hospitalization.is_infectious && (
              <div className="alert alert-danger" style={{ margin: 0 }}>
                ⚠️ 传染病病例只能转至隔离笼位
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>目标笼位 *</label>
              <select
                value={formData.to_cage_id}
                onChange={(e) => setFormData({ ...formData, to_cage_id: parseInt(e.target.value) })}
              >
                <option value="">请选择笼位</option>
                {availableCages.map(cage => (
                  <option key={cage.id} value={cage.id}>
                    {cage.cage_number} ({cage.location_name})
                    {cage.is_isolation ? ' [隔离]' : ''}
                  </option>
                ))}
              </select>
              {availableCages.length === 0 && (
                <p style={{ fontSize: '12px', color: '#e74c3c', marginTop: '4px' }}>
                  没有可用的目标笼位
                </p>
              )}
            </div>

            <div className="form-group">
              <label>转笼原因</label>
              <textarea
                value={formData.request_reason}
                onChange={(e) => setFormData({ ...formData, request_reason: e.target.value })}
                placeholder="请输入转笼原因..."
              />
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '提交中...' : '提交申请'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TransferRequestModal;
