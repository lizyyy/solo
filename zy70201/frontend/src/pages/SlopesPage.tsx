import { useEffect, useState } from 'react';
import { slopeApi } from '../services/api';
import type { Slope, SlopeDifficulty, SlopeStatus } from '../types';
import { difficultyLabels, slopeStatusLabels } from '../types';

function SlopesPage() {
  const [slopes, setSlopes] = useState<Slope[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSlope, setEditingSlope] = useState<Slope | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadSlopes();
  }, []);

  async function loadSlopes() {
    try {
      const res = await slopeApi.getAll();
      setSlopes(res.data.data);
    } catch (error: any) {
      setAlert({ type: 'error', message: '加载雪道列表失败: ' + (error.response?.data?.message || error.message) });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get('name') as string,
      difficulty: formData.get('difficulty') as SlopeDifficulty,
      length: parseFloat(formData.get('length') as string),
      area: parseFloat(formData.get('area') as string),
      openWindowStart: formData.get('openWindowStart') as string,
      openWindowEnd: formData.get('openWindowEnd') as string,
      minSnowThickness: parseInt(formData.get('minSnowThickness') as string),
      targetSnowThickness: parseInt(formData.get('targetSnowThickness') as string),
      currentSnowThickness: parseInt(formData.get('currentSnowThickness') as string),
      status: formData.get('status') as SlopeStatus,
      priority: parseInt(formData.get('priority') as string)
    };

    try {
      if (editingSlope) {
        await slopeApi.update(editingSlope.id, data);
        setAlert({ type: 'success', message: '雪道更新成功' });
      } else {
        await slopeApi.create(data);
        setAlert({ type: 'success', message: '雪道创建成功' });
      }
      setShowModal(false);
      setEditingSlope(null);
      loadSlopes();
    } catch (error: any) {
      setAlert({ type: 'error', message: '操作失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这条雪道吗？')) return;
    
    try {
      await slopeApi.delete(id);
      setAlert({ type: 'success', message: '雪道删除成功' });
      loadSlopes();
    } catch (error: any) {
      setAlert({ type: 'error', message: '删除失败: ' + (error.response?.data?.message || error.message) });
    }
  }

  function openEditModal(slope: Slope) {
    setEditingSlope(slope);
    setShowModal(true);
  }

  function openCreateModal() {
    setEditingSlope(null);
    setShowModal(true);
  }

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">雪道档案</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + 新增雪道
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>
          {alert.message}
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>难度</th>
                  <th>长度</th>
                  <th>面积</th>
                  <th>开放窗口</th>
                  <th>当前厚度</th>
                  <th>最小要求</th>
                  <th>优先级</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {slopes.map(slope => {
                  const needsGrooming = slope.currentSnowThickness < slope.minSnowThickness;
                  return (
                    <tr key={slope.id}>
                      <td>{slope.name}</td>
                      <td>
                        <span className="badge" style={{ 
                          backgroundColor: getDifficultyColor(slope.difficulty),
                          color: 'white'
                        }}>
                          {difficultyLabels[slope.difficulty]}
                        </span>
                      </td>
                      <td>{slope.length}m</td>
                      <td>{slope.area.toLocaleString()}㎡</td>
                      <td>{slope.openWindowStart} - {slope.openWindowEnd}</td>
                      <td>
                        <strong style={{ color: needsGrooming ? '#ef4444' : '#10b981' }}>
                          {slope.currentSnowThickness}cm
                        </strong>
                      </td>
                      <td>{slope.minSnowThickness}cm</td>
                      <td>{slope.priority}</td>
                      <td>
                        <span className="badge" style={{ 
                          backgroundColor: getSlopeStatusBgColor(slope.status),
                          color: getSlopeStatusTextColor(slope.status)
                        }}>
                          {slopeStatusLabels[slope.status]}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(slope)}>
                            编辑
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(slope.id)}>
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <SlopeFormModal
          slope={editingSlope}
          onClose={() => { setShowModal(false); setEditingSlope(null); }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function SlopeFormModal({ slope, onClose, onSubmit }: {
  slope: Slope | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{slope ? '编辑雪道' : '新增雪道'}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">雪道名称</label>
              <input 
                type="text" 
                name="name" 
                className="form-input" 
                defaultValue={slope?.name}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">难度级别</label>
              <select name="difficulty" className="form-select" defaultValue={slope?.difficulty || 'EASY'}>
                <option value="EASY">初级</option>
                <option value="MEDIUM">中级</option>
                <option value="HARD">高级</option>
                <option value="EXPERT">专业</option>
              </select>
            </div>
            
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">长度 (米)</label>
                <input 
                  type="number" 
                  name="length" 
                  className="form-input" 
                  defaultValue={slope?.length}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="form-label">面积 (平方米)</label>
                <input 
                  type="number" 
                  name="area" 
                  className="form-input" 
                  defaultValue={slope?.area}
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>
            
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">开放开始时间</label>
                <input 
                  type="time" 
                  name="openWindowStart" 
                  className="form-input" 
                  defaultValue={slope?.openWindowStart || '08:00'}
                  required
                />
              </div>
              <div>
                <label className="form-label">开放结束时间</label>
                <input 
                  type="time" 
                  name="openWindowEnd" 
                  className="form-input" 
                  defaultValue={slope?.openWindowEnd || '18:00'}
                  required
                />
              </div>
            </div>
            
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">最小积雪厚度 (cm)</label>
                <input 
                  type="number" 
                  name="minSnowThickness" 
                  className="form-input" 
                  defaultValue={slope?.minSnowThickness}
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="form-label">目标积雪厚度 (cm)</label>
                <input 
                  type="number" 
                  name="targetSnowThickness" 
                  className="form-input" 
                  defaultValue={slope?.targetSnowThickness}
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="form-label">当前积雪厚度 (cm)</label>
                <input 
                  type="number" 
                  name="currentSnowThickness" 
                  className="form-input" 
                  defaultValue={slope?.currentSnowThickness}
                  min="0"
                  required
                />
              </div>
            </div>
            
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">优先级 (1-10，1最高)</label>
                <input 
                  type="number" 
                  name="priority" 
                  className="form-input" 
                  defaultValue={slope?.priority || 5}
                  min="1"
                  max="10"
                  required
                />
              </div>
              <div>
                <label className="form-label">状态</label>
                <select name="status" className="form-select" defaultValue={slope?.status || 'OPEN'}>
                  <option value="OPEN">开放</option>
                  <option value="CLOSED">关闭</option>
                  <option value="MAINTENANCE">维护中</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getDifficultyColor(difficulty: string) {
  const colors: Record<string, string> = {
    EASY: '#10b981',
    MEDIUM: '#3b82f6',
    HARD: '#f59e0b',
    EXPERT: '#ef4444'
  };
  return colors[difficulty] || '#6b7280';
}

function getSlopeStatusBgColor(status: string) {
  const colors: Record<string, string> = {
    OPEN: '#ecfdf5',
    CLOSED: '#f3f4f6',
    MAINTENANCE: '#fffbeb'
  };
  return colors[status] || '#f3f4f6';
}

function getSlopeStatusTextColor(status: string) {
  const colors: Record<string, string> = {
    OPEN: '#065f46',
    CLOSED: '#374151',
    MAINTENANCE: '#92400e'
  };
  return colors[status] || '#374151';
}

export default SlopesPage;
