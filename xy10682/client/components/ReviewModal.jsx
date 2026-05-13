import React, { useState, useEffect } from 'react';

function ReviewModal({ record, onClose, onSave, onUploadPhoto }) {
  const [formData, setFormData] = useState({
    newReading: record.currentReading,
    newEstimateFlag: record.estimateFlag,
    newAbnormalThreshold: record.abnormalThreshold,
    reviewer: '',
    reviewNotes: record.reviewNotes || ''
  });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const response = await fetch(`/api/records/${record.id}/history`);
      const data = await response.json();
      setHistory(data);
    };
    fetchHistory();
  }, [record.id]);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUploadPhoto(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>复核记录 - {record.meterNo}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>客户名称</label>
                <input type="text" value={record.customerName} disabled />
              </div>
              <div className="form-group">
                <label>责任人</label>
                <input type="text" value={record.responsiblePerson} disabled />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>上月读数</label>
                <input type="number" value={record.lastReading} disabled />
              </div>
              <div className="form-group">
                <label>当前读数</label>
                <input 
                  type="number" 
                  value={formData.newReading}
                  onChange={(e) => handleChange('newReading', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>估抄标记</label>
                <select
                  value={formData.newEstimateFlag}
                  onChange={(e) => handleChange('newEstimateFlag', e.target.value === 'true')}
                >
                  <option value={false}>否</option>
                  <option value={true}>是</option>
                </select>
              </div>
              <div className="form-group">
                <label>异常阈值</label>
                <input 
                  type="number" 
                  value={formData.newAbnormalThreshold}
                  onChange={(e) => handleChange('newAbnormalThreshold', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>复核人</label>
                <input 
                  type="text" 
                  value={formData.reviewer}
                  onChange={(e) => handleChange('reviewer', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>用水量</label>
                <input type="number" value={formData.newReading - record.lastReading} disabled />
              </div>
            </div>

            <div className="form-group">
              <label>复核备注</label>
              <textarea
                rows={4}
                value={formData.reviewNotes}
                onChange={(e) => handleChange('reviewNotes', e.target.value)}
                placeholder="输入复核备注..."
              />
            </div>

            <div className="form-group">
              <label>上传复核照片</label>
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </div>

            {record.reviewPhotos && record.reviewPhotos.length > 0 && (
              <div className="photos-section">
              <label>已上传照片</label>
              <div className="photos-grid">
                {record.reviewPhotos.map((photo, index) => (
                  <img key={index} src={`http://localhost:5000${photo}`} alt="" className="photo-thumbnail" />
                ))}
              </div>
            </div>
            )}

            {history.length > 0 && (
              <div className="history-section">
                <h4>修改历史记录</h4>
                {history.map(item => (
                  <div key={item.id} className="history-item">
                    <div className="history-header">
                      <span className="history-operator">操作人：{item.operator}</span>
                      <span className="history-time">{new Date(item.operationTime).toLocaleString()}</span>
                    </div>
                    <div className="history-compare">
                      <div className="history-before">
                        <div>读数：{item.before.reading}</div>
                        <div>估抄：{item.before.estimateFlag ? '是' : '否'}</div>
                        <div>阈值：{item.before.abnormalThreshold}</div>
                        <div>收费差异：¥{item.before.feeDifference.toFixed(2)}</div>
                      </div>
                      <div className="history-arrow">→</div>
                      <div className="history-after">
                        <div>读数：{item.after.reading}</div>
                        <div>估抄：{item.after.estimateFlag ? '是' : '否'}</div>
                        <div>阈值：{item.after.abnormalThreshold}</div>
                        <div>收费差异：¥{item.after.feeDifference.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-success">
              保存复核
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReviewModal;
