import { useEffect, useState } from 'react';
import { courierCompanyApi } from '../api';
import type { CourierCompany } from '../types';

export default function CourierCompaniesPage() {
  const [companies, setCompanies] = useState<CourierCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CourierCompany | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    delivery_fee: 1,
    return_fee: 2,
    storage_fee_per_day: 0.5
  });

  const loadCompanies = async () => {
    try {
      const res = await courierCompanyApi.getAll();
      setCompanies(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCompany) {
        await courierCompanyApi.update(editingCompany.id, formData);
      } else {
        await courierCompanyApi.create(formData);
      }
      setShowModal(false);
      setEditingCompany(null);
      resetForm();
      loadCompanies();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleEdit = (company: CourierCompany) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      code: company.code,
      delivery_fee: company.delivery_fee,
      return_fee: company.return_fee,
      storage_fee_per_day: company.storage_fee_per_day
    });
    setShowModal(true);
  };

  const handleDelete = async (company: CourierCompany) => {
    if (!confirm(`确定要删除 "${company.name}" 吗？\n注意：若存在关联包裹则无法删除`)) {
      return;
    }
    try {
      await courierCompanyApi.delete(company.id);
      loadCompanies();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      delivery_fee: 1,
      return_fee: 2,
      storage_fee_per_day: 0.5
    });
  };

  const openAddModal = () => {
    setEditingCompany(null);
    resetForm();
    setShowModal(true);
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">快递公司管理</h1>
        <button className="btn btn-primary" onClick={openAddModal}>
          + 添加快递公司
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        {companies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <div className="empty-state-text">暂无快递公司</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>公司名称</th>
                  <th>编码</th>
                  <th>派件费</th>
                  <th>退件费</th>
                  <th>保管费/天</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td><code>{c.code}</code></td>
                    <td>¥{c.delivery_fee}</td>
                    <td>¥{c.return_fee}</td>
                    <td>¥{c.storage_fee_per_day}</td>
                    <td>{new Date(c.created_at).toLocaleString()}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-primary" onClick={() => handleEdit(c)}>
                          编辑
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCompany ? '编辑快递公司' : '添加快递公司'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>公司名称 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="如：顺丰快递"
                  />
                </div>
                <div className="form-group">
                  <label>公司编码 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                    placeholder="如：SF、YT"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>派件费 (元/件)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.delivery_fee}
                      onChange={(e) => setFormData({ ...formData, delivery_fee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>退件费 (元/件)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.return_fee}
                      onChange={(e) => setFormData({ ...formData, return_fee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>保管费 (元/天)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.storage_fee_per_day}
                      onChange={(e) => setFormData({ ...formData, storage_fee_per_day: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCompany ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
