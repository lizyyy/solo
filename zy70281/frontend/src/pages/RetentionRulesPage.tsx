import { useEffect, useState } from 'react';
import { retentionRuleApi, courierCompanyApi } from '../api';
import type { RetentionRule, CourierCompany } from '../types';

export default function RetentionRulesPage() {
  const [rules, setRules] = useState<RetentionRule[]>([]);
  const [companies, setCompanies] = useState<CourierCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RetentionRule | null>(null);
  const [formData, setFormData] = useState({
    courier_company_id: '',
    free_days: 3,
    storage_fee_per_day: 0.5,
    is_global: false
  });

  const loadData = async () => {
    try {
      const [rulesRes, companiesRes] = await Promise.all([
        retentionRuleApi.getAll(),
        courierCompanyApi.getAll()
      ]);
      setRules(rulesRes.data);
      setCompanies(companiesRes.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        courier_company_id: formData.is_global ? null : parseInt(formData.courier_company_id) || null,
        free_days: formData.free_days,
        storage_fee_per_day: formData.storage_fee_per_day,
        is_global: formData.is_global
      };
      if (editingRule) {
        await retentionRuleApi.update(editingRule.id, data);
      } else {
        await retentionRuleApi.create(data);
      }
      setShowModal(false);
      setEditingRule(null);
      resetForm();
      loadData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleEdit = (rule: RetentionRule) => {
    setEditingRule(rule);
    setFormData({
      courier_company_id: rule.courier_company_id?.toString() || '',
      free_days: rule.free_days,
      storage_fee_per_day: rule.storage_fee_per_day,
      is_global: rule.is_global
    });
    setShowModal(true);
  };

  const handleDelete = async (rule: RetentionRule) => {
    if (!confirm(`确定要删除此规则吗？`)) {
      return;
    }
    try {
      await retentionRuleApi.delete(rule.id);
      loadData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const resetForm = () => {
    setFormData({
      courier_company_id: '',
      free_days: 3,
      storage_fee_per_day: 0.5,
      is_global: false
    });
  };

  const openAddModal = () => {
    setEditingRule(null);
    resetForm();
    setShowModal(true);
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">滞留规则管理</h1>
        <button className="btn btn-primary" onClick={openAddModal}>
          + 添加规则
        </button>
      </div>

      <div className="alert alert-warning">
        <strong>规则说明：</strong> 退件费用 = 退件基础费 + 滞留保管费。
        滞留保管费计算方式：(滞留天数 - 免费天数) × 每日保管费。
        快递公司专属规则优先级高于全局规则。
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        {rules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">暂无滞留规则</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>规则类型</th>
                  <th>适用快递公司</th>
                  <th>免费天数</th>
                  <th>每日保管费</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className={`badge ${r.is_global ? 'badge-confirmed' : 'badge-pending'}`}>
                        {r.is_global ? '全局规则' : '公司规则'}
                      </span>
                    </td>
                    <td>{r.is_global ? '所有公司' : r.courier_company_name}</td>
                    <td>{r.free_days} 天</td>
                    <td>¥{r.storage_fee_per_day}/天</td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-sm btn-primary" onClick={() => handleEdit(r)}>
                          编辑
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r)}>
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
                {editingRule ? '编辑滞留规则' : '添加滞留规则'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_global}
                      onChange={(e) => setFormData({ ...formData, is_global: e.target.checked })}
                    />
                    &nbsp;设为全局规则
                  </label>
                </div>
                {!formData.is_global && (
                  <div className="form-group">
                    <label>适用快递公司 <span className="required">*</span></label>
                    <select
                      value={formData.courier_company_id}
                      onChange={(e) => setFormData({ ...formData, courier_company_id: e.target.value })}
                      required={!formData.is_global}
                    >
                      <option value="">请选择快递公司</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>免费天数 (天)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.free_days}
                      onChange={(e) => setFormData({ ...formData, free_days: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group">
                    <label>每日保管费 (元)</label>
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
                  {editingRule ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
