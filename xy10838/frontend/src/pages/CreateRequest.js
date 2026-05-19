import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CreateRequest() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    reason: '',
    requestedBy: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customerId || !formData.requestedBy) {
      alert('请填写必填项');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const data = await res.json();
        alert('创建成功');
        navigate(`/requests/${data.id}`);
      } else {
        alert('创建失败');
      }
    } catch (error) {
      alert('创建失败: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button className="btn btn-link" onClick={() => navigate('/requests')}>
        ← 返回列表
      </button>

      <div className="card">
        <h2>新建删除申请</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>客户ID *</label>
              <input
                type="text"
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                placeholder="例如：CUST001"
              />
            </div>
            <div className="form-group">
              <label>客户名称</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="客户姓名或公司名"
              />
            </div>
          </div>

          <div className="form-group">
            <label>删除原因</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="例如：GDPR 删除请求、用户主动申请等"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>申请人 *</label>
            <input
              type="text"
              value={formData.requestedBy}
              onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
              placeholder="申请人姓名或工号"
            />
          </div>

          <div className="flex" style={{ gap: '12px', marginTop: '24px' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? '创建中...' : '创建申请'}
            </button>
            <button 
              type="button" 
              className="btn"
              onClick={() => navigate('/requests')}
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateRequest;
