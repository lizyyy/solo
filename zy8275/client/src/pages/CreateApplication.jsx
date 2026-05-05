import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function CreateApplication({ currentUser }) {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    shop_id: '',
    title: '',
    description: '',
    construction_type: '',
    blueprint_url: '',
    start_time: '',
    end_time: '',
  });

  useEffect(() => {
    axios.get('/api/shops')
      .then(response => {
        setShops(response.data);
        if (response.data.length > 0) {
          setFormData(prev => ({ ...prev, shop_id: response.data[0].id }));
        }
        setLoading(false);
      })
      .catch(err => {
        setError('加载店铺列表失败');
        setLoading(false);
      });
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.shop_id || !formData.title || !formData.construction_type || 
        !formData.start_time || !formData.end_time) {
      setError('请填写所有必填字段');
      return;
    }

    if (!currentUser) {
      setError('请先选择当前用户');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const createResponse = await axios.post('/api/applications', {
        ...formData,
        created_by: currentUser.id,
      });

      const submitResponse = await axios.post(`/api/applications/${createResponse.data.id}/actions`, {
        action_type: 'SUBMIT',
        actor_id: currentUser.id,
        actor_role: currentUser.role_id,
        comment: '提交施工申请',
      });

      navigate(`/application/${createResponse.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || '提交申请失败');
      setSubmitting(false);
    }
  };

  const getDefaultTime = (hours) => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(hours, 0, 0, 0);
    return date.toISOString().slice(0, 16);
  };

  if (loading) {
    return <div className="loading"><p>加载中...</p></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/" className="btn btn-secondary btn-sm">← 返回看板</Link>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">新建夜间施工申请</h2>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="detail-grid">
            <div className="form-group">
              <label className="form-label">选择店铺 *</label>
              <select
                className="form-control"
                name="shop_id"
                value={formData.shop_id}
                onChange={handleChange}
                required
              >
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} ({shop.floor} {shop.shop_number})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">施工类型 *</label>
              <select
                className="form-control"
                name="construction_type"
                value={formData.construction_type}
                onChange={handleChange}
                required
              >
                <option value="">请选择施工类型</option>
                <option value="招牌安装">招牌安装</option>
                <option value="室内改造">室内改造</option>
                <option value="装修工程">装修工程</option>
                <option value="设备安装">设备安装</option>
                <option value="水电改造">水电改造</option>
                <option value="墙面翻新">墙面翻新</option>
                <option value="地板铺设">地板铺设</option>
                <option value="其他">其他</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">申请标题 *</label>
            <input
              type="text"
              className="form-control"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="请输入申请标题，如：店铺招牌更换"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">申请描述</label>
            <textarea
              className="form-control"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="请详细描述施工内容、范围和注意事项..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">施工图纸链接</label>
            <input
              type="url"
              className="form-control"
              name="blueprint_url"
              value={formData.blueprint_url}
              onChange={handleChange}
              placeholder="请输入施工图纸或方案的URL链接"
            />
          </div>

          <div className="detail-grid">
            <div className="form-group">
              <label className="form-label">计划开始时间 *</label>
              <input
                type="datetime-local"
                className="form-control"
                name="start_time"
                value={formData.start_time || getDefaultTime(22)}
                onChange={handleChange}
                required
              />
              <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>
                夜间施工时间建议：22:00 至次日 06:00
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">计划结束时间 *</label>
              <input
                type="datetime-local"
                className="form-control"
                name="end_time"
                value={formData.end_time || getDefaultTime(6)}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '20px' }}>
            <div className="card" style={{ backgroundColor: '#f8f9fa' }}>
              <h4 style={{ marginBottom: '10px', color: '#555' }}>注意事项</h4>
              <ul style={{ color: '#666', fontSize: '0.9rem', paddingLeft: '20px' }}>
                <li>夜间施工时间限制在 22:00 至次日 06:00 之间</li>
                <li>单次申请最大施工时长不得超过 8 小时</li>
                <li>施工申请需提前 24 小时提交</li>
                <li>申请需经工程主管审核图纸和时间窗，再经安保放行</li>
              </ul>
            </div>
          </div>

          <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
            <Link to="/" className="btn btn-secondary">取消</Link>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? '提交中...' : '提交申请'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateApplication;
