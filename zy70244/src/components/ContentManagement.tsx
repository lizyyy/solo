import { useEffect, useState } from 'react';
import { Content, ContentStatus, ContentType } from '../types';
import { contentStorage, historyStorage } from '../storage';
import { recordHistory } from '../services/history';
import { v4 as uuidv4 } from 'uuid';

const TYPE_MAP: Record<ContentType, { label: string; color: string }> = {
  AD: { label: '广告', color: '#3b82f6' },
  ACTIVITY: { label: '活动', color: '#8b5cf6' },
  EMERGENCY: { label: '紧急通知', color: '#ef4444' },
};

const STATUS_MAP: Record<ContentStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: '#9ca3af' },
  REVIEW: { label: '审核中', color: '#eab308' },
  PUBLISHED: { label: '已发布', color: '#22c55e' },
  ARCHIVED: { label: '已归档', color: '#6b7280' },
};

interface ContentFormProps {
  content?: Content | null;
  onSave: (content: Content) => void;
  onCancel: () => void;
  isFrozen: boolean;
}

function ContentForm({ content, onSave, onCancel, isFrozen }: ContentFormProps) {
  const [formData, setFormData] = useState<Partial<Content>>({
    title: content?.title || '',
    type: content?.type || 'AD',
    description: content?.description || '',
    status: content?.status || 'DRAFT',
    tags: content?.tags || [],
  });
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    if (!formData.tags?.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...(formData.tags || []), tagInput.trim()] });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags?.filter(t => t !== tag) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];
    if (!formData.title) newErrors.push('内容标题不能为空');
    if (!formData.description) newErrors.push('内容描述不能为空');
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    const now = new Date().toISOString();
    const newContent: Content = {
      id: content?.id || uuidv4(),
      title: formData.title!,
      type: formData.type as ContentType,
      description: formData.description!,
      status: formData.status as ContentStatus,
      tags: formData.tags || [],
      createdAt: content?.createdAt || now,
      updatedAt: now,
    };

    onSave(newContent);
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
      <h2>{content ? '编辑内容' : '新建内容'}</h2>
      {errors.length > 0 && (
        <div className="error-box">
          {errors.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}
      <form onSubmit={handleSubmit} className="form">
        <div className="form-row">
          <label>内容标题 *</label>
          <input
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="如：春季促销活动"
          />
        </div>
        <div className="form-row">
          <label>内容类型 *</label>
          <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as ContentType })}>
            <option value="AD">广告</option>
            <option value="ACTIVITY">活动</option>
            <option value="EMERGENCY">紧急通知</option>
          </select>
        </div>
        <div className="form-row">
          <label>内容描述 *</label>
          <textarea
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="请详细描述内容"
            rows={4}
          />
        </div>
        <div className="form-row">
          <label>状态</label>
          <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as ContentStatus })}>
            <option value="DRAFT">草稿</option>
            <option value="REVIEW">审核中</option>
            <option value="PUBLISHED">已发布</option>
            <option value="ARCHIVED">已归档</option>
          </select>
        </div>
        <div className="form-row">
          <label>标签</label>
          <div className="tag-input-group">
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              placeholder="输入标签后按回车添加"
            />
            <button type="button" onClick={handleAddTag}>添加</button>
          </div>
          <div className="tag-list">
            {formData.tags?.map(tag => (
              <span key={tag} className="tag">
                {tag}
                <span onClick={() => handleRemoveTag(tag)} className="tag-remove">×</span>
              </span>
            ))}
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

interface ContentDetailProps {
  content: Content;
  onEdit: () => void;
  onClose: () => void;
  isFrozen: boolean;
}

function ContentDetail({ content, onEdit, onClose, isFrozen }: ContentDetailProps) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    setHistory(historyStorage.getByEntity('content', content.id));
  }, [content.id]);

  return (
    <div className="modal-content">
      <h2>内容详情</h2>
      <div className="detail-grid">
        <div><strong>标题：</strong>{content.title}</div>
        <div><strong>类型：</strong>
          <span className="status-badge" style={{ backgroundColor: TYPE_MAP[content.type].color }}>
            {TYPE_MAP[content.type].label}
          </span>
        </div>
        <div><strong>状态：</strong>
          <span className="status-badge" style={{ backgroundColor: STATUS_MAP[content.status].color }}>
            {STATUS_MAP[content.status].label}
          </span>
        </div>
        <div><strong>标签：</strong>{content.tags.join(', ') || '无'}</div>
        <div style={{ gridColumn: '1 / -1' }}><strong>描述：</strong>{content.description}</div>
        <div><strong>创建时间：</strong>{new Date(content.createdAt).toLocaleString()}</div>
        <div><strong>更新时间：</strong>{new Date(content.updatedAt).toLocaleString()}</div>
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

export default function ContentManagement({ isFrozen }: Props) {
  const [contents, setContents] = useState<Content[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [viewingContent, setViewingContent] = useState<Content | null>(null);
  const [filter, setFilter] = useState<{ keyword: string; type: string; status: string }>({ keyword: '', type: '', status: '' });

  useEffect(() => {
    setContents(contentStorage.getAll());
  }, []);

  const filteredContents = contents.filter(c => {
    const matchKeyword = !filter.keyword || c.title.includes(filter.keyword) || c.description.includes(filter.keyword);
    const matchType = !filter.type || c.type === filter.type;
    const matchStatus = !filter.status || c.status === filter.status;
    return matchKeyword && matchType && matchStatus;
  });

  const handleSave = (newContent: Content) => {
    const allContents = contentStorage.getAll();
    const isNew = !editingContent;
    
    if (isNew) {
      allContents.push(newContent);
      recordHistory('content', newContent.id, 'create', `创建内容：${newContent.title}`, null, newContent);
    } else {
      const oldContent = allContents.find(c => c.id === newContent.id);
      const idx = allContents.findIndex(c => c.id === newContent.id);
      if (idx >= 0) allContents[idx] = newContent;
      recordHistory('content', newContent.id, 'update', `更新内容：${newContent.title}`, oldContent, newContent);
    }
    
    contentStorage.save(allContents);
    setContents(allContents);
    setShowForm(false);
    setEditingContent(null);
  };

  const handleDelete = (content: Content) => {
    if (isFrozen) {
      alert('系统已发布冻结，无法删除');
      return;
    }
    if (!confirm(`确定删除内容 "${content.title}" 吗？`)) return;
    
    const allContents = contentStorage.getAll().filter(c => c.id !== content.id);
    contentStorage.save(allContents);
    setContents(allContents);
    recordHistory('content', content.id, 'delete', `删除内容：${content.title}`, content, null);
  };

  const handleImport = () => {
    if (isFrozen) {
      alert('系统已发布冻结，无法导入');
      return;
    }
    const sampleData = `[
  {"title": "新年促销活动", "type": "ACTIVITY", "description": "全场8折，满1000减200"},
  {"title": "停车场维护通知", "type": "EMERGENCY", "description": "B2停车场将于今晚22:00-06:00维护"},
  {"title": "品牌广告", "type": "AD", "description": "某品牌新品上市推广"}
]`;
    const input = prompt('请输入 JSON 格式的内容数据：', sampleData);
    if (!input) return;
    
    try {
      const parsed = JSON.parse(input);
      const allContents = contentStorage.getAll();
      const now = new Date().toISOString();
      
      for (const item of parsed) {
        const newContent: Content = {
          id: uuidv4(),
          title: item.title,
          type: item.type,
          description: item.description,
          status: 'DRAFT',
          tags: [],
          createdAt: now,
          updatedAt: now,
        };
        allContents.push(newContent);
        recordHistory('content', newContent.id, 'create', `导入内容：${newContent.title}`, null, newContent);
      }
      
      contentStorage.save(allContents);
      setContents(allContents);
      alert(`成功导入 ${parsed.length} 条内容`);
    } catch (e) {
      alert('JSON 格式错误，请检查后重试');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>内容档案管理</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isFrozen && (
            <>
              <button onClick={handleImport}>导入内容</button>
              <button className="primary" onClick={() => { setEditingContent(null); setShowForm(true); }}>
                + 新建内容
              </button>
            </>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <input
          placeholder="搜索标题/描述"
          value={filter.keyword}
          onChange={e => setFilter({ ...filter, keyword: e.target.value })}
        />
        <select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}>
          <option value="">全部类型</option>
          <option value="AD">广告</option>
          <option value="ACTIVITY">活动</option>
          <option value="EMERGENCY">紧急通知</option>
        </select>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">全部状态</option>
          <option value="DRAFT">草稿</option>
          <option value="REVIEW">审核中</option>
          <option value="PUBLISHED">已发布</option>
          <option value="ARCHIVED">已归档</option>
        </select>
        <div className="stats">共 {filteredContents.length} 条内容</div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>标题</th>
            <th>类型</th>
            <th>描述</th>
            <th>标签</th>
            <th>状态</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredContents.map(content => (
            <tr key={content.id}>
              <td>{content.title}</td>
              <td>
                <span className="status-badge" style={{ backgroundColor: TYPE_MAP[content.type].color }}>
                  {TYPE_MAP[content.type].label}
                </span>
              </td>
              <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {content.description}
              </td>
              <td>{content.tags.slice(0, 2).join(', ')}{content.tags.length > 2 ? '...' : ''}</td>
              <td>
                <span className="status-badge" style={{ backgroundColor: STATUS_MAP[content.status].color }}>
                  {STATUS_MAP[content.status].label}
                </span>
              </td>
              <td>{new Date(content.updatedAt).toLocaleString()}</td>
              <td className="actions">
                <button onClick={() => setViewingContent(content)}>详情</button>
                {!isFrozen && (
                  <>
                    <button onClick={() => { setEditingContent(content); setShowForm(true); }}>编辑</button>
                    <button className="danger" onClick={() => handleDelete(content)}>删除</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredContents.length === 0 && (
        <div className="empty-state">暂无内容数据</div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => { setShowForm(false); setEditingContent(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <ContentForm
              content={editingContent}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingContent(null); }}
              isFrozen={isFrozen}
            />
          </div>
        </div>
      )}

      {viewingContent && (
        <div className="modal-backdrop" onClick={() => setViewingContent(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <ContentDetail
              content={viewingContent}
              onEdit={() => { setViewingContent(null); setEditingContent(viewingContent); setShowForm(true); }}
              onClose={() => setViewingContent(null)}
              isFrozen={isFrozen}
            />
          </div>
        </div>
      )}
    </div>
  );
}
