import { useEffect, useState } from 'react';
import { PriorityRule, ContentType } from '../types';
import { priorityRuleStorage } from '../storage';
import { v4 as uuidv4 } from 'uuid';

const TYPE_OPTIONS: ContentType[] = ['AD', 'ACTIVITY', 'EMERGENCY'];
const TYPE_LABELS: Record<ContentType, string> = {
  AD: '广告',
  ACTIVITY: '活动',
  EMERGENCY: '紧急通知',
};

export default function PriorityRules({ isFrozen }: { isFrozen: boolean }) {
  const [rules, setRules] = useState<PriorityRule[]>([]);
  const [editingRule, setEditingRule] = useState<PriorityRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<PriorityRule>>({});

  useEffect(() => {
    setRules(priorityRuleStorage.getAll().sort((a, b) => b.priority - a.priority));
  }, []);

  const startEdit = (rule?: PriorityRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({ ...rule });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        priority: 20,
        isEmergency: false,
        description: '',
      });
    }
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.name || formData.priority === undefined) {
      alert('请填写规则名称和优先级');
      return;
    }

    const allRules = priorityRuleStorage.getAll();
    const now = new Date().toISOString();
    
    if (editingRule) {
      const idx = allRules.findIndex(r => r.id === editingRule.id);
      if (idx >= 0) {
        allRules[idx] = {
          ...editingRule,
          ...formData,
        } as PriorityRule;
      }
    } else {
      allRules.push({
        id: uuidv4(),
        name: formData.name!,
        priority: Number(formData.priority),
        contentType: formData.contentType,
        isEmergency: Boolean(formData.isEmergency),
        description: formData.description || '',
      });
    }

    priorityRuleStorage.save(allRules);
    setRules(allRules.sort((a, b) => b.priority - a.priority));
    setShowForm(false);
  };

  const handleDelete = (rule: PriorityRule) => {
    if (!confirm(`确定删除规则 "${rule.name}" 吗？`)) return;
    
    const allRules = priorityRuleStorage.getAll().filter(r => r.id !== rule.id);
    priorityRuleStorage.save(allRules);
    setRules(allRules.sort((a, b) => b.priority - a.priority));
  };

  const getPriorityLevel = (priority: number): string => {
    if (priority >= 80) return '🔴 极高';
    if (priority >= 50) return '🟠 高';
    if (priority >= 30) return '🟡 中';
    return '🟢 普通';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>优先级规则配置</h1>
        {!isFrozen && (
          <button className="primary" onClick={() => startEdit()}>
            + 新增规则
          </button>
        )}
      </div>

      <div className="info-box">
        <h3>规则说明</h3>
        <ul>
          <li><strong>优先级数值越高，优先级越高</strong>（1-100）</li>
          <li>紧急排期优先级默认 ≥ 80，可覆盖普通排期</li>
          <li>创建排期时，系统自动根据内容类型和是否紧急匹配规则</li>
          <li>时间冲突时，高优先级排期可覆盖低优先级排期</li>
        </ul>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>规则名称</th>
            <th>优先级</th>
            <th>等级</th>
            <th>内容类型</th>
            <th>紧急</th>
            <th>说明</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(rule => (
            <tr key={rule.id}>
              <td>{rule.name}</td>
              <td>
                <div className="priority-bar">
                  <div 
                    className="priority-fill"
                    style={{ 
                      width: `${rule.priority}%`,
                      backgroundColor: rule.priority >= 80 ? '#ef4444' : rule.priority >= 50 ? '#f59e0b' : '#22c55e'
                    }}
                  />
                  <span className="priority-text">{rule.priority}</span>
                </div>
              </td>
              <td>{getPriorityLevel(rule.priority)}</td>
              <td>{rule.contentType ? TYPE_LABELS[rule.contentType] : '通用'}</td>
              <td>{rule.isEmergency ? '🚨 是' : '否'}</td>
              <td>{rule.description}</td>
              <td className="actions">
                {!isFrozen && (
                  <>
                    <button onClick={() => startEdit(rule)}>编辑</button>
                    <button className="danger" onClick={() => handleDelete(rule)}>删除</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <h2>{editingRule ? '编辑规则' : '新增规则'}</h2>
              <div className="form">
                <div className="form-row">
                  <label>规则名称 *</label>
                  <input
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="如：VIP活动排期"
                  />
                </div>
                <div className="form-row">
                  <label>优先级 * (1-100)</label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={formData.priority || 20}
                    onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                  />
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '24px' }}>
                    {formData.priority || 20} - {getPriorityLevel(formData.priority || 20)}
                  </div>
                </div>
                <div className="form-row">
                  <label>适用内容类型</label>
                  <select
                    value={formData.contentType || ''}
                    onChange={e => setFormData({ ...formData, contentType: e.target.value as ContentType || undefined })}
                  >
                    <option value="">通用（所有类型）</option>
                    {TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>是否紧急规则</label>
                  <div className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={formData.isEmergency || false}
                      onChange={e => setFormData({ ...formData, isEmergency: e.target.checked })}
                    />
                    <span>标记为紧急类规则（最高优先级区间）</span>
                  </div>
                </div>
                <div className="form-row">
                  <label>规则说明</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="描述此规则的适用场景"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button onClick={() => setShowForm(false)}>取消</button>
                <button onClick={handleSave} className="primary">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
