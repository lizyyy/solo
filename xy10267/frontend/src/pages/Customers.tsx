import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Customer, Taboo, TABOO_LABELS } from '../types';

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: {
      lat: 39.9042,
      lng: 116.4074,
      address: ''
    },
    taboos: [] as Taboo[],
    notes: ''
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const response = await api.customers.getAll();
    if (response.success) {
      setCustomers(response.data as Customer[]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const response = editingCustomer
      ? await api.customers.update(editingCustomer.id, formData)
      : await api.customers.create(formData);

    if (response.success) {
      setShowModal(false);
      setEditingCustomer(null);
      resetForm();
      loadCustomers();
    } else {
      setError(response.error || '操作失败');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      location: customer.location,
      taboos: customer.taboos,
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除客户 ${name} 吗？`)) {
      return;
    }

    const response = await api.customers.delete(id);
    if (response.success) {
      loadCustomers();
    } else {
      alert(response.error || '删除失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      location: {
        lat: 39.9042,
        lng: 116.4074,
        address: ''
      },
      taboos: [],
      notes: ''
    });
    setError('');
  };

  const toggleTaboo = (taboo: Taboo) => {
    setFormData(prev => ({
      ...prev,
      taboos: prev.taboos.includes(taboo)
        ? prev.taboos.filter(t => t !== taboo)
        : [...prev.taboos, taboo]
    }));
  };

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👤 客户管理</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingCustomer(null);
            resetForm();
            setShowModal(true);
          }}
        >
          + 添加客户
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">👤</div>
          <div className="empty-text">暂无客户数据，点击上方按钮添加</div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>电话</th>
                <th>地址</th>
                <th>禁忌</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.location.address}</td>
                  <td>
                    {customer.taboos.length > 0 ? (
                      customer.taboos.map(taboo => (
                        <span key={taboo} className="tag tag-taboo">
                          {TABOO_LABELS[taboo]}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#999' }}>无</span>
                    )}
                  </td>
                  <td>{customer.notes || '-'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => handleEdit(customer)}
                      >
                        编辑
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(customer.id, customer.name)}
                      >
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCustomer ? '编辑客户' : '添加客户'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                  <label className="form-label">姓名 *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">电话 *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">地址 *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.location.address}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        location: { ...formData.location, address: e.target.value }
                      })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">禁忌（可选）</label>
                  <div className="checkbox-group">
                    {Object.entries(TABOO_LABELS).map(([key, label]) => (
                      <label key={key} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.taboos.includes(key as Taboo)}
                          onChange={() => toggleTaboo(key as Taboo)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">备注</label>
                  <textarea
                    className="form-textarea"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setShowModal(false)}
                >
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
