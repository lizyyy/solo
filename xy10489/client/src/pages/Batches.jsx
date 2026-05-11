import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter,
  ArrowRight
} from 'lucide-react';
import api, { getStatusBadgeClass } from '../utils/api';

const Batches = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    batch_no: '',
    product_name: '',
    model: '',
    quantity: '',
    production_line: '',
    inspector: '',
    production_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/batches');
      setBatches(res.data);
    } catch (err) {
      setError('加载批次列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredBatches = batches.filter(batch => {
    const matchStatus = !filterStatus || batch.status === filterStatus;
    const matchSearch = !searchTerm || 
      batch.batch_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.product_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/batches', {
        ...formData,
        quantity: Number(formData.quantity)
      });
      setShowCreateModal(false);
      setFormData({
        batch_no: '',
        product_name: '',
        model: '',
        quantity: '',
        production_line: '',
        inspector: '',
        production_date: new Date().toISOString().split('T')[0]
      });
      loadBatches();
    } catch (err) {
      alert(err.response?.data?.error || '创建批次失败');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateBatchNo = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `P${year}-${month}${day}-${random}`;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem' }}>正在加载...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>批次管理</h2>
        <button 
          className="btn btn-primary" 
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={16} /> 新建批次
        </button>
      </div>

      <div className="filter-row">
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input 
            type="text" 
            placeholder="搜索批次号或产品名称..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem', width: '100%', padding: '0.5rem 2.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }}
          />
        </div>
        <select 
          className="filter-select" 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">全部状态</option>
          <option value="待抽检">待抽检</option>
          <option value="抽检中">抽检中</option>
          <option value="待处理">待处理</option>
          <option value="隔离中">隔离中</option>
          <option value="返工中">返工中</option>
          <option value="待复判">待复判</option>
          <option value="完成">完成</option>
          <option value="报废">报废</option>
        </select>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>批次号</th>
                <th>产品名称</th>
                <th>型号</th>
                <th>数量</th>
                <th>生产线</th>
                <th>质检员</th>
                <th>缺陷数</th>
                <th>隔离数量</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.length > 0 ? (
                filteredBatches.map(batch => (
                  <tr key={batch.id}>
                    <td><strong>{batch.batch_no}</strong></td>
                    <td>{batch.product_name}</td>
                    <td>{batch.model || '-'}</td>
                    <td>{batch.quantity.toLocaleString()}</td>
                    <td>{batch.production_line || '-'}</td>
                    <td>{batch.inspector || '-'}</td>
                    <td>{batch.defect_count || 0}</td>
                    <td style={{ color: batch.quarantined_qty > 0 ? '#dc2626' : 'inherit' }}>
                      {batch.quarantined_qty || 0}
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(batch.status)}`}>
                        {batch.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/batches/${batch.id}`)}
                      >
                        详情 <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    暂无批次数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>新建生产批次</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>批次号 *</label>
                  <input 
                    type="text" 
                    name="batch_no"
                    value={formData.batch_no}
                    onChange={handleInputChange}
                    placeholder="如：P2024-0511-001"
                    required
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => setFormData(prev => ({ ...prev, batch_no: generateBatchNo() }))}
                  >
                    自动生成
                  </button>
                </div>
                <div className="form-group">
                  <label>产品名称 *</label>
                  <input 
                    type="text" 
                    name="product_name"
                    value={formData.product_name}
                    onChange={handleInputChange}
                    placeholder="如：精密轴承"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>型号</label>
                  <input 
                    type="text" 
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                    placeholder="如：BR-001"
                  />
                </div>
                <div className="form-group">
                  <label>数量 *</label>
                  <input 
                    type="number" 
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>生产线</label>
                  <input 
                    type="text" 
                    name="production_line"
                    value={formData.production_line}
                    onChange={handleInputChange}
                    placeholder="如：A线"
                  />
                </div>
                <div className="form-group">
                  <label>质检员</label>
                  <input 
                    type="text" 
                    name="inspector"
                    value={formData.inspector}
                    onChange={handleInputChange}
                    placeholder="如：张工"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>生产日期</label>
                <input 
                  type="date" 
                  name="production_date"
                  value={formData.production_date}
                  onChange={handleInputChange}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  创建批次
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Batches;
