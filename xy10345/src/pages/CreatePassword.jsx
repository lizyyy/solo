import React, { useState, useEffect } from 'react';
import { propertyApi, passwordApi } from '../services/api';
import { 
  getPropertyStatusBadge, 
  formatDateForInput,
  addDays
} from '../utils/helpers';

function CreatePassword() {
  const [properties, setProperties] = useState([]);
  const [formData, setFormData] = useState({
    propertyId: '',
    type: 'cleaning',
    name: '',
    reason: '',
    validFrom: '',
    validTo: ''
  });
  const [message, setMessage] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (formData.type === 'cleaning') {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setFullYear(endDate.getFullYear() + 1);
      setFormData(prev => ({
        ...prev,
        validFrom: formatDateForInput(today),
        validTo: formatDateForInput(endDate),
        name: '保洁密码'
      }));
    } else if (formData.type === 'maintenance') {
      const today = new Date();
      const endDate = addDays(today, 1);
      setFormData(prev => ({
        ...prev,
        validFrom: formatDateForInput(today),
        validTo: formatDateForInput(endDate),
        name: '维修临时密码',
        reason: '维修期间临时授权'
      }));
    }
  }, [formData.type]);

  const loadProperties = async () => {
    try {
      const res = await propertyApi.getAll();
      setProperties(res.data);
    } catch (error) {
      console.error('加载房源失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.propertyId) {
      setMessage({ type: 'error', text: '请选择房源' });
      return;
    }

    try {
      const res = await passwordApi.generate({
        propertyId: formData.propertyId,
        type: formData.type,
        name: formData.name,
        reason: formData.reason,
        validFrom: new Date(formData.validFrom).toISOString(),
        validTo: new Date(formData.validTo).toISOString()
      });

      if (res.data.success) {
        setGeneratedPassword(res.data.password);
        setMessage({ type: 'success', text: '密码生成成功！' });
        setStep(4);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || '生成密码失败，可能与现有密码时间冲突' 
      });
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>➕ 生成密码</h2>
      </div>

      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <h3 className="card-title">步骤说明</h3>
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? (step > 1 ? 'completed' : 'active') : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">选择房源</div>
          </div>
          <div className={`step ${step >= 2 ? (step > 2 ? 'completed' : 'active') : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">选择密码类型</div>
          </div>
          <div className={`step ${step >= 3 ? (step > 3 ? 'completed' : 'active') : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">设置有效期</div>
          </div>
          <div className={`step ${step >= 4 ? 'active' : ''}`}>
            <div className="step-number">4</div>
            <div className="step-label">完成</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card">
          <h3 className="card-title">密码信息</h3>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">1. 选择房源 *</label>
              <select 
                className="form-select"
                value={formData.propertyId}
                onChange={e => {
                  setFormData({ ...formData, propertyId: e.target.value });
                  if (e.target.value && step === 1) setStep(2);
                }}
              >
                <option value="">请选择房源</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">2. 密码类型 *</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className={`btn ${formData.type === 'cleaning' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setFormData({ ...formData, type: 'cleaning' });
                    if (step === 2) setStep(3);
                  }}
                >
                  🧹 保洁密码
                </button>
                <button
                  type="button"
                  className={`btn ${formData.type === 'maintenance' ? 'btn-warning' : 'btn-secondary'}`}
                  onClick={() => {
                    setFormData({ ...formData, type: 'maintenance' });
                    if (step === 2) setStep(3);
                  }}
                >
                  🔧 维修密码
                </button>
              </div>
            </div>

            {formData.type === 'cleaning' && (
              <div className="explanation-box">
                <h4>🧹 保洁密码说明</h4>
                <ul>
                  <li>长期有效密码，供保洁人员使用</li>
                  <li>默认有效期：1年</li>
                  <li>可随时手动作废</li>
                </ul>
              </div>
            )}

            {formData.type === 'maintenance' && (
              <div className="explanation-box">
                <h4>🔧 维修密码说明</h4>
                <ul>
                  <li>临时密码，仅限维修期间使用</li>
                  <li>默认有效期：1天</li>
                  <li>⚠️ 仅在房源处于"维修中"状态时可用</li>
                  <li>非维修状态下使用会触发越权访问告警</li>
                </ul>
              </div>
            )}

            <div className="form-group mt-4">
              <label className="form-label">3. 密码名称</label>
              <input 
                type="text" 
                className="form-input"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入密码名称"
              />
            </div>

            <div className="form-group">
              <label className="form-label">生效时间 *</label>
              <input 
                type="datetime-local" 
                className="form-input"
                value={formData.validFrom}
                onChange={e => setFormData({ ...formData, validFrom: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">失效时间 *</label>
              <input 
                type="datetime-local" 
                className="form-input"
                value={formData.validTo}
                onChange={e => setFormData({ ...formData, validTo: e.target.value })}
              />
            </div>

            {formData.type === 'maintenance' && (
              <div className="form-group">
                <label className="form-label">维修原因</label>
                <textarea 
                  className="form-input"
                  rows="3"
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="请输入维修原因..."
                />
              </div>
            )}

            <div className="mt-4">
              <button type="submit" className="btn btn-primary">
                🔑 生成密码
              </button>
            </div>
          </form>
        </div>

        <div>
          <div className="card">
            <h3 className="card-title">⚠️ 注意事项</h3>
            <div className="explanation-box">
              <h4>安全机制</h4>
              <ul>
                <li>系统会自动检查时间是否与现有密码重叠</li>
                <li>如果有冲突，生成操作将被拒绝</li>
                <li>所有操作都会记录到审计日志</li>
              </ul>
            </div>

            <div className="explanation-box mt-4">
              <h4>密码类型对比</h4>
              <table className="table" style={{ marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th>特性</th>
                    <th>保洁密码</th>
                    <th>维修密码</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>有效期</td>
                    <td>长期（默认1年）</td>
                    <td>短期（按需设置）</td>
                  </tr>
                  <tr>
                    <td>使用限制</td>
                    <td>无</td>
                    <td>仅维修状态可用</td>
                  </tr>
                  <tr>
                    <td>越权检测</td>
                    <td>否</td>
                    <td>是</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {generatedPassword && (
            <div className="card">
              <h3 className="card-title">✅ 密码生成成功</h3>
              <div className="password-display">
                <span className="password-code">{generatedPassword.code}</span>
                <div className="password-status">
                  <p><strong>{generatedPassword.name}</strong></p>
                  <p>有效期：{new Date(generatedPassword.validFrom).toLocaleString()} - {new Date(generatedPassword.validTo).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="explanation-box">
                <h4>📋 密码说明</h4>
                <ul>
                  <li><strong>类型：</strong>{formData.type === 'cleaning' ? '保洁密码' : '维修临时密码'}</li>
                  <li><strong>状态：</strong>待生效（到生效时间后自动激活）</li>
                  {formData.type === 'maintenance' && (
                    <li>⚠️ 请确保房源状态为"维修中"，否则密码无法使用</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreatePassword;
