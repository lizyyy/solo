import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Aunt, Skill, Taboo, SKILL_LABELS, TABOO_LABELS } from '../types';

const Aunts = () => {
  const [aunts, setAunts] = useState<Aunt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAunt, setEditingAunt] = useState<Aunt | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    skills: [] as Skill[],
    taboos: [] as Taboo[],
    location: {
      lat: 39.9042,
      lng: 116.4074,
      address: ''
    },
    rating: 4.0,
    experienceYears: 0,
    isAvailable: true
  });

  useEffect(() => {
    loadAunts();
  }, []);

  const loadAunts = async () => {
    setLoading(true);
    const response = await api.aunts.getAll();
    if (response.success) {
      setAunts(response.data as Aunt[]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const response = editingAunt
      ? await api.aunts.update(editingAunt.id, formData)
      : await api.aunts.create(formData);

    if (response.success) {
      setShowModal(false);
      setEditingAunt(null);
      resetForm();
      loadAunts();
    } else {
      setError(response.error || '操作失败');
    }
  };

  const handleEdit = (aunt: Aunt) => {
    setEditingAunt(aunt);
    setFormData({
      name: aunt.name,
      phone: aunt.phone,
      skills: aunt.skills,
      taboos: aunt.taboos,
      location: aunt.location,
      rating: aunt.rating,
      experienceYears: aunt.experienceYears,
      isAvailable: aunt.isAvailable
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除阿姨 ${name} 吗？`)) {
      return;
    }

    const response = await api.aunts.delete(id);
    if (response.success) {
      loadAunts();
    } else {
      alert(response.error || '删除失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      skills: [],
      taboos: [],
      location: {
        lat: 39.9042,
        lng: 116.4074,
        address: ''
      },
      rating: 4.0,
      experienceYears: 0,
      isAvailable: true
    });
    setError('');
  };

  const toggleSkill = (skill: Skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const toggleTaboo = (taboo: Taboo) => {
    setFormData(prev => ({
      ...prev,
      taboos: prev.taboos.includes(taboo)
        ? prev.taboos.filter(t => t !== taboo)
        : [...prev.taboos, taboo]
    }));
  };

  const getStatusClass = (isAvailable: boolean) => {
    return isAvailable ? 'status-tag status-success' : 'status-tag status-danger';
  };

  const getStatusText = (isAvailable: boolean) => {
    return isAvailable ? '可用' : '不可用';
  };

  if (loading) {
    return <div className="card">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">👩 阿姨管理</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingAunt(null);
            resetForm();
            setShowModal(true);
          }}
        >
          + 添加阿姨
        </button>
      </div>

      {aunts.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">👩</div>
          <div className="empty-text">暂无阿姨数据，点击上方按钮添加</div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>电话</th>
                <th>技能</th>
                <th>禁忌</th>
                <th>评分</th>
                <th>经验</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {aunts.map(aunt => (
                <tr key={aunt.id}>
                  <td>{aunt.name}</td>
                  <td>{aunt.phone}</td>
                  <td>
                    {aunt.skills.map(skill => (
                      <span key={skill} className="tag tag-skill">
                        {SKILL_LABELS[skill]}
                      </span>
                    ))}
                  </td>
                  <td>
                    {aunt.taboos.length > 0 ? (
                      aunt.taboos.map(taboo => (
                        <span key={taboo} className="tag tag-taboo">
                          {TABOO_LABELS[taboo]}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: '#999' }}>无</span>
                    )}
                  </td>
                  <td>⭐ {aunt.rating}</td>
                  <td>{aunt.experienceYears}年</td>
                  <td>
                    <span className={getStatusClass(aunt.isAvailable)}>
                      {getStatusText(aunt.isAvailable)}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-default btn-sm"
                        onClick={() => handleEdit(aunt)}
                      >
                        编辑
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(aunt.id, aunt.name)}
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
                {editingAunt ? '编辑阿姨' : '添加阿姨'}
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
                  <label className="form-label">技能 *（至少选择一项）</label>
                  <div className="checkbox-group">
                    {Object.entries(SKILL_LABELS).map(([key, label]) => (
                      <label key={key} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.skills.includes(key as Skill)}
                          onChange={() => toggleSkill(key as Skill)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
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
                  <label className="form-label">评分</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="5"
                    step="0.1"
                    value={formData.rating}
                    onChange={e =>
                      setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">工作年限</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    value={formData.experienceYears}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        experienceYears: parseInt(e.target.value) || 0
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={formData.isAvailable}
                      onChange={e =>
                        setFormData({ ...formData, isAvailable: e.target.checked })
                      }
                    />
                    当前可用
                  </label>
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
                  {editingAunt ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Aunts;
