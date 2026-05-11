import { useEffect, useState } from 'react';
import { Screen, ScreenStatus } from '../types';
import { screenStorage, historyStorage } from '../storage';
import { recordHistory } from '../services/history';
import { v4 as uuidv4 } from 'uuid';

const STATUS_MAP: Record<ScreenStatus, { label: string; color: string }> = {
  ACTIVE: { label: '运行中', color: '#22c55e' },
  MAINTENANCE: { label: '维护中', color: '#eab308' },
  OFFLINE: { label: '离线', color: '#ef4444' },
};

interface ScreenFormProps {
  screen?: Screen | null;
  onSave: (screen: Screen) => void;
  onCancel: () => void;
  isFrozen: boolean;
}

function ScreenForm({ screen, onSave, onCancel, isFrozen }: ScreenFormProps) {
  const [formData, setFormData] = useState<Partial<Screen>>({
    code: screen?.code || '',
    name: screen?.name || '',
    location: screen?.location || '',
    status: screen?.status || 'ACTIVE',
    orientation: screen?.orientation || 'LANDSCAPE',
    width: screen?.width || 1920,
    height: screen?.height || 1080,
  });
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];
    
    if (!formData.code) newErrors.push('屏幕编号不能为空');
    if (!formData.name) newErrors.push('屏幕名称不能为空');
    if (!formData.location) newErrors.push('位置信息不能为空');
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    const now = new Date().toISOString();
    const newScreen: Screen = {
      id: screen?.id || uuidv4(),
      code: formData.code!,
      name: formData.name!,
      location: formData.location!,
      status: formData.status as ScreenStatus,
      orientation: formData.orientation as 'LANDSCAPE' | 'PORTRAIT',
      width: Number(formData.width) || 1920,
      height: Number(formData.height) || 1080,
      createdAt: screen?.createdAt || now,
      updatedAt: now,
    };

    onSave(newScreen);
  };

  if (isFrozen) {
    return (
      <div className="modal-content">
        <div className="frozen-banner">系统已发布冻结，无法操作</div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>关闭</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-content">
      <h2>{screen ? '编辑屏幕' : '新建屏幕'}</h2>
      {errors.length > 0 && (
        <div className="error-box">
          {errors.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <label>屏幕编号 *</label>
          <input
            value={formData.code}
            onChange={e => setFormData({ ...formData, code: e.target.value })}
            placeholder="如：SC-001"
          />
        </div>
        <div className="form-row">
          <label>屏幕名称 *</label>
          <input
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="如：1F主入口大屏"
          />
        </div>
        <div className="form-row">
          <label>位置信息 *</label>
          <input
            value={formData.location}
            onChange={e => setFormData({ ...formData, location: e.target.value })}
            placeholder="如：1层主入口左侧"
          />
        </div>
        <div className="form-row">
          <label>状态</label>
          <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as ScreenStatus })}>
            <option value="ACTIVE">运行中</option>
            <option value="MAINTENANCE">维护中</option>
            <option value="OFFLINE">离线</option>
          </select>
        </div>
        <div className="form-row">
          <label>屏幕方向</label>
          <select value={formData.orientation} onChange={e => setFormData({ ...formData, orientation: e.target.value as 'LANDSCAPE' | 'PORTRAIT' })}>
            <option value="LANDSCAPE">横屏</option>
            <option value="PORTRAIT">竖屏</option>
          </select>
        </div>
        <div className="form-row">
          <label>分辨率 (宽 × 高)</label>
          <div className="inline-fields">
            <input type="number" value={formData.width} onChange={e => setFormData({ ...formData, width: Number(e.target.value) })} />
            <span>×</span>
            <input type="number" value={formData.height} onChange={e => setFormData({ ...formData, height: Number(e.target.value) })} />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>取消</button>
          <button type="submit" className="primary">保存</button>
        </div>
      </form>
    </div>
  );
}

interface ScreenDetailProps {
  screen: Screen;
  onEdit: () => void;
  onClose: () => void;
  isFrozen: boolean;
}

function ScreenDetail({ screen, onEdit, onClose, isFrozen }: ScreenDetailProps) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    setHistory(historyStorage.getByEntity('screen', screen.id));
  }, [screen.id]);

  return (
    <div className="modal-content">
      <h2>屏幕详情</h2>
      <div className="detail-grid">
        <div><strong>编号：</strong>{screen.code}</div>
        <div><strong>名称：</strong>{screen.name}</div>
        <div><strong>位置：</strong>{screen.location}</div>
        <div><strong>状态：</strong>
          <span className="status-badge" style={{ backgroundColor: STATUS_MAP[screen.status].color }}>
            {STATUS_MAP[screen.status].label}
          </span>
        </div>
        <div><strong>方向：</strong>{screen.orientation === 'LANDSCAPE' ? '横屏' : '竖屏'}</div>
        <div><strong>分辨率：</strong>{screen.width} × {screen.height}</div>
        <div><strong>创建时间：</strong>{new Date(screen.createdAt).toLocaleString()}</div>
        <div><strong>更新时间：</strong>{new Date(screen.updatedAt).toLocaleString()}</div>
      </div>
      
      <h3 style={{ marginTop: '24px' }}>变更历史</h3>
      {history.length === 0 ? (
        <p style={{ color: '#888' }}>暂无变更记录</p>
      ) : (
        <div className="history-list">
          {history.slice(0, 10).map(h => (
            <div key={h.id} className="history-item">
              <div className="history-header">
                <span className="history-action">{h.action}</span>
                <span className="history-time">{new Date(h.timestamp).toLocaleString()}</span>
                <span className="history-operator">操作人：{h.operator}</span>
              </div>
              <div className="history-desc">{h.description}</div>
            </div>
          ))}
        </div>
      )}
      
      <div className="modal-actions">
        <button onClick={onClose}>关闭</button>
        {!isFrozen && <button onClick={onEdit} className="primary">编辑</button>}
      </div>
    </div>
  );
}

interface Props {
  isFrozen: boolean;
}

export default function ScreenManagement({ isFrozen }: Props) {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingScreen, setEditingScreen] = useState<Screen | null>(null);
  const [viewingScreen, setViewingScreen] = useState<Screen | null>(null);
  const [filter, setFilter] = useState<{ keyword: string; status: string }>({ keyword: '', status: '' });

  useEffect(() => {
    setScreens(screenStorage.getAll());
  }, []);

  const filteredScreens = screens.filter(s => {
    const matchKeyword = !filter.keyword || 
      s.name.includes(filter.keyword) || 
      s.code.includes(filter.keyword) || 
      s.location.includes(filter.keyword);
    const matchStatus = !filter.status || s.status === filter.status;
    return matchKeyword && matchStatus;
  });

  const handleSave = (newScreen: Screen) => {
    const existing = screenStorage.getByCode(newScreen.code);
    if (existing && existing.id !== newScreen.id) {
      alert('屏幕编号已存在！');
      return;
    }

    const allScreens = screenStorage.getAll();
    const isNew = !editingScreen;
    
    if (isNew) {
      allScreens.push(newScreen);
      recordHistory('screen', newScreen.id, 'create', `创建屏幕：${newScreen.name} (${newScreen.code})`, null, newScreen);
    } else {
      const oldScreen = allScreens.find(s => s.id === newScreen.id);
      const idx = allScreens.findIndex(s => s.id === newScreen.id);
      if (idx >= 0) allScreens[idx] = newScreen;
      recordHistory('screen', newScreen.id, 'update', `更新屏幕：${newScreen.name}`, oldScreen, newScreen);
    }
    
    screenStorage.save(allScreens);
    setScreens(allScreens);
    setShowForm(false);
    setEditingScreen(null);
  };

  const handleDelete = (screen: Screen) => {
    if (isFrozen) {
      alert('系统已发布冻结，无法删除');
      return;
    }
    if (!confirm(`确定删除屏幕 "${screen.name}" 吗？`)) return;
    
    const allScreens = screenStorage.getAll().filter(s => s.id !== screen.id);
    screenStorage.save(allScreens);
    setScreens(allScreens);
    recordHistory('screen', screen.id, 'delete', `删除屏幕：${screen.name}`, screen, null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>屏幕档案管理</h1>
        {!isFrozen && (
          <button className="primary" onClick={() => { setEditingScreen(null); setShowForm(true); }}>
            + 新建屏幕
          </button>
        )}
      </div>

      <div className="filter-bar">
        <input
          placeholder="搜索编号/名称/位置"
          value={filter.keyword}
          onChange={e => setFilter({ ...filter, keyword: e.target.value })}
        />
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">全部状态</option>
          <option value="ACTIVE">运行中</option>
          <option value="MAINTENANCE">维护中</option>
          <option value="OFFLINE">离线</option>
        </select>
        <div className="stats">
          共 {filteredScreens.length} 台，运行中 {filteredScreens.filter(s => s.status === 'ACTIVE').length} 台
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>编号</th>
            <th>名称</th>
            <th>位置</th>
            <th>方向</th>
            <th>分辨率</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredScreens.map(screen => (
            <tr key={screen.id}>
              <td>{screen.code}</td>
              <td>{screen.name}</td>
              <td>{screen.location}</td>
              <td>{screen.orientation === 'LANDSCAPE' ? '横屏' : '竖屏'}</td>
              <td>{screen.width}×{screen.height}</td>
              <td>
                <span className="status-badge" style={{ backgroundColor: STATUS_MAP[screen.status].color }}>
                  {STATUS_MAP[screen.status].label}
                </span>
              </td>
              <td className="actions">
                <button onClick={() => setViewingScreen(screen)}>详情</button>
                {!isFrozen && (
                  <>
                    <button onClick={() => { setEditingScreen(screen); setShowForm(true); }}>编辑</button>
                    <button className="danger" onClick={() => handleDelete(screen)}>删除</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredScreens.length === 0 && (
        <div className="empty-state">暂无屏幕数据，请先添加屏幕</div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => { setShowForm(false); setEditingScreen(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <ScreenForm
              screen={editingScreen}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingScreen(null); }}
              isFrozen={isFrozen}
            />
          </div>
        </div>
      )}

      {viewingScreen && (
        <div className="modal-backdrop" onClick={() => setViewingScreen(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <ScreenDetail
              screen={viewingScreen}
              onEdit={() => { setViewingScreen(null); setEditingScreen(viewingScreen); setShowForm(true); }}
              onClose={() => setViewingScreen(null)}
              isFrozen={isFrozen}
            />
          </div>
        </div>
      )}
    </div>
  );
}
