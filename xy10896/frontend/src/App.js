import React, { useState, useEffect } from 'react';
import { 
  getConfirmations, 
  confirmImpact, 
  markAsUnaffected, 
  exportUnconfirmed,
  getSubscriptions,
  createSubscription,
  getChanges,
  createChange
} from './api';

function App() {
  const [activeTab, setActiveTab] = useState('pending');
  const [activePage, setActivePage] = useState('dashboard');
  
  const [confirmations, setConfirmations] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState({});

  const [newSubscription, setNewSubscription] = useState({
    serviceName: '',
    teamName: '',
    apiPath: '',
    fields: ''
  });

  const [newChange, setNewChange] = useState({
    apiPath: '',
    oldSchema: '{}',
    newSchema: '{}',
    commitAuthor: '',
    commitMessage: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadAllData();
  }, [activePage, activeTab]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      if (activePage === 'dashboard') {
        const params = activeTab === 'all' ? {} : { status: activeTab };
        const res = await getConfirmations(params);
        setConfirmations(res.data);
      } else if (activePage === 'subscriptions') {
        const res = await getSubscriptions();
        setSubscriptions(res.data);
      } else if (activePage === 'changes') {
        const res = await getChanges();
        setChanges(res.data);
      }
    } catch (err) {
      console.error('加载失败:', err);
    }
    setLoading(false);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleConfirm = async (id, note) => {
    await confirmImpact(id, note);
    loadAllData();
    showMessage('success', '已确认影响');
  };

  const handleUnaffected = async (id, note) => {
    await markAsUnaffected(id, note);
    loadAllData();
    showMessage('success', '已标记为不受影响');
  };

  const handleExport = async () => {
    const res = await exportUnconfirmed();
    const blob = new Blob([res.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unconfirmed-list.json';
    a.click();
  };

  const handleCreateSubscription = async () => {
    try {
      const fields = newSubscription.fields.split(',').map(f => f.trim()).filter(f => f);
      await createSubscription({
        ...newSubscription,
        fields
      });
      setNewSubscription({ serviceName: '', teamName: '', apiPath: '', fields: '' });
      loadAllData();
      showMessage('success', '订阅创建成功');
    } catch (err) {
      showMessage('error', '创建订阅失败');
    }
  };

  const handleCreateChange = async () => {
    try {
      const oldSchema = JSON.parse(newChange.oldSchema);
      const newSchema = JSON.parse(newChange.newSchema);
      await createChange({
        ...newChange,
        oldSchema,
        newSchema
      });
      setNewChange({ apiPath: '', oldSchema: '{}', newSchema: '{}', commitAuthor: '', commitMessage: '' });
      loadAllData();
      showMessage('success', '变更提交成功');
    } catch (err) {
      showMessage('error', '提交变更失败，请检查JSON格式');
    }
  };

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groupByTeam = (items) => {
    return items.reduce((groups, item) => {
      const team = item.teamName || '未分组';
      if (!groups[team]) groups[team] = [];
      groups[team].push(item);
      return groups;
    }, {});
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return '#dc2626';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const getRiskLabel = (level) => {
    switch (level) {
      case 'high': return '高风险';
      case 'medium': return '中风险';
      case 'low': return '低风险';
      default: return level;
    }
  };

  const getChangeTypeLabel = (type) => {
    switch (type) {
      case 'field_deleted': return '字段删除';
      case 'field_type_changed': return '类型变更';
      case 'field_description_changed': return '描述变更';
      case 'field_added': return '新增字段';
      default: return type;
    }
  };

  const getChangeTypeColor = (type) => {
    switch (type) {
      case 'field_deleted': return { bg: '#fee2e2', text: '#991b1b' };
      case 'field_type_changed': return { bg: '#fef3c7', text: '#92400e' };
      case 'field_description_changed': return { bg: '#e0e7ff', text: '#3730a3' };
      case 'field_added': return { bg: '#d1fae5', text: '#065f46' };
      default: return { bg: '#e5e7eb', text: '#374151' };
    }
  };

  const isOverdue = (deadline) => new Date(deadline) < new Date();

  const grouped = groupByTeam(confirmations);
  const teams = Object.keys(grouped).sort();

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, color: '#1f2937' }}>依赖破坏提醒系统</h1>
        {activePage === 'dashboard' && (
          <button 
            onClick={handleExport}
            style={{ padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            导出未确认清单
          </button>
        )}
      </div>

      {message.text && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '6px',
          backgroundColor: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b'
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
        {[
          { key: 'dashboard', label: '待确认清单' },
          { key: 'subscriptions', label: '订阅管理' },
          { key: 'changes', label: '变更记录' }
        ].map(page => (
          <button
            key={page.key}
            onClick={() => setActivePage(page.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activePage === page.key ? '2px solid #3b82f6' : '2px solid transparent',
              color: activePage === page.key ? '#3b82f6' : '#6b7280',
              fontWeight: activePage === page.key ? 600 : 400
            }}
          >
            {page.label}
          </button>
        ))}
      </div>

      {activePage === 'dashboard' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[
              { key: 'pending', label: '待确认' },
              { key: 'confirmed', label: '已确认' },
              { key: 'unaffected', label: '不受影响' },
              { key: 'all', label: '全部' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: activeTab === tab.key ? '#3b82f6' : 'white',
                  color: activeTab === tab.key ? 'white' : '#374151',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
                {tab.key === 'pending' && confirmations.filter(c => c.status === 'pending').length > 0 && 
                  <span style={{ marginLeft: '6px', backgroundColor: activeTab === tab.key ? 'white' : '#dc2626', color: activeTab === tab.key ? '#dc2626' : 'white', borderRadius: '10px', padding: '2px 8px', fontSize: '12px' }}>
                    {confirmations.filter(c => c.status === 'pending').length}
                  </span>
                }
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>加载中...</div>
          ) : confirmations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>暂无数据</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {teams.map(team => (
                <div key={team} style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', color: '#1f2937' }}>{team}</h2>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      {grouped[team].filter(c => c.status === 'pending').length} 项待确认 / {grouped[team].length} 项总计
                    </span>
                  </div>
                  <div style={{ padding: '12px' }}>
                    {grouped[team].map(item => (
                      <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '8px', overflow: 'hidden' }}>
                        <div 
                          onClick={() => toggleExpand(item.id)}
                          style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ 
                              padding: '4px 10px', 
                              borderRadius: '4px', 
                              fontSize: '12px', 
                              fontWeight: 500,
                              color: 'white',
                              backgroundColor: getRiskColor(item.riskLevel)
                            }}>
                              {getRiskLabel(item.riskLevel)}
                            </span>
                            <span style={{ fontWeight: 500, color: '#1f2937' }}>{item.serviceName}</span>
                            <span style={{ color: '#6b7280', fontSize: '14px' }}>{item.apiPath}</span>
                            {isOverdue(item.deadline) && item.status === 'pending' && (
                              <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: 500 }}>⚠️ 已超时</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>
                              截止: {new Date(item.deadline).toLocaleDateString('zh-CN')}
                            </span>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              backgroundColor: item.status === 'pending' ? '#fef3c7' : item.status === 'confirmed' ? '#dbeafe' : '#d1fae5',
                              color: item.status === 'pending' ? '#92400e' : item.status === 'confirmed' ? '#1e40af' : '#065f46'
                            }}>
                              {item.status === 'pending' ? '待确认' : item.status === 'confirmed' ? '已确认' : '不受影响'}
                            </span>
                            <span>{expandedItems[item.id] ? '▼' : '▶'}</span>
                          </div>
                        </div>
                        
                        {expandedItems[item.id] && (
                          <div style={{ padding: '16px' }}>
                            <div style={{ marginBottom: '16px' }}>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151' }}>受影响字段:</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {item.affectedFields.map((field, idx) => {
                                  const colors = getChangeTypeColor(field.type);
                                  return (
                                    <div key={idx} style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: '4px', fontSize: '13px' }}>
                                      <span style={{ 
                                        padding: '2px 8px', 
                                        borderRadius: '3px', 
                                        fontSize: '11px', 
                                        marginRight: '8px',
                                        backgroundColor: colors.bg,
                                        color: colors.text
                                      }}>
                                        {getChangeTypeLabel(field.type)}
                                      </span>
                                      <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '3px' }}>{field.path}</code>
                                      {field.oldType && field.newType && (
                                        <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                          {field.oldType} → {field.newType}
                                        </span>
                                      )}
                                      {field.oldDescription && field.newDescription && field.type === 'field_description_changed' && (
                                        <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                                          "{field.oldDescription}" → "{field.newDescription}"
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {item.note && (
                              <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '4px', fontSize: '13px' }}>
                                <strong>备注:</strong> {item.note}
                              </div>
                            )}

                            {item.status === 'pending' && (
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  placeholder="添加备注..."
                                  id={`note-${item.id}`}
                                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const note = document.getElementById(`note-${item.id}`).value;
                                    handleConfirm(item.id, note);
                                  }}
                                  style={{ padding: '8px 16px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  确认影响
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const note = document.getElementById(`note-${item.id}`).value;
                                    handleUnaffected(item.id, note);
                                  }}
                                  style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  标记不受影响
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activePage === 'subscriptions' && (
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>订阅列表</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>加载中...</div>
            ) : subscriptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>暂无订阅</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {subscriptions.map(sub => (
                  <div key={sub.id} style={{ padding: '12px 16px', background: 'white', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{sub.serviceName}</strong>
                        <span style={{ marginLeft: '8px', color: '#6b7280' }}>({sub.teamName})</span>
                      </div>
                      <code style={{ color: '#3b82f6' }}>{sub.apiPath}</code>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
                      订阅字段: {sub.fields.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: '400px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>新增订阅</h2>
            <div style={{ padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>服务名称</label>
                <input
                  type="text"
                  value={newSubscription.serviceName}
                  onChange={e => setNewSubscription({ ...newSubscription, serviceName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
                  placeholder="如：订单服务"
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>团队名称</label>
                <input
                  type="text"
                  value={newSubscription.teamName}
                  onChange={e => setNewSubscription({ ...newSubscription, teamName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
                  placeholder="如：交易团队"
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>API路径</label>
                <input
                  type="text"
                  value={newSubscription.apiPath}
                  onChange={e => setNewSubscription({ ...newSubscription, apiPath: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
                  placeholder="如：/api/v1/users"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>订阅字段（逗号分隔）</label>
                <input
                  type="text"
                  value={newSubscription.fields}
                  onChange={e => setNewSubscription({ ...newSubscription, fields: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
                  placeholder="如：id, name, email"
                />
              </div>
              <button
                onClick={handleCreateSubscription}
                style={{ width: '100%', padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                创建订阅
              </button>
            </div>
          </div>
        </div>
      )}

      {activePage === 'changes' && (
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>变更记录</h2>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>加载中...</div>
            ) : changes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>暂无变更</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {changes.map(change => (
                  <div key={change.id} style={{ padding: '12px 16px', background: 'white', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          fontWeight: 500,
                          color: 'white',
                          backgroundColor: getRiskColor(change.riskLevel)
                        }}>
                          {getRiskLabel(change.riskLevel)}
                        </span>
                        <code style={{ color: '#3b82f6' }}>{change.apiPath}</code>
                      </div>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {new Date(change.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '14px', color: '#1f2937', marginBottom: '4px' }}>{change.commitMessage}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>提交人: {change.commitAuthor}</div>
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {change.diff.map((d, idx) => {
                          const colors = getChangeTypeColor(d.type);
                          return (
                            <span key={idx} style={{ padding: '2px 8px', borderRadius: '3px', fontSize: '11px', backgroundColor: colors.bg, color: colors.text }}>
                              {getChangeTypeLabel(d.type)}: {d.path}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ width: '400px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>提交变更</h2>
            <div style={{ padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>API路径</label>
                <input
                  type="text"
                  value={newChange.apiPath}
                  onChange={e => setNewChange({ ...newChange, apiPath: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
                  placeholder="如：/api/v1/users"
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>旧Schema (JSON)</label>
                <textarea
                  value={newChange.oldSchema}
                  onChange={e => setNewChange({ ...newChange, oldSchema: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', minHeight: '100px', fontFamily: 'monospace' }}
                  placeholder='{"id": {"type": "string"}}'
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>新Schema (JSON)</label>
                <textarea
                  value={newChange.newSchema}
                  onChange={e => setNewChange({ ...newChange, newSchema: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', minHeight: '100px', fontFamily: 'monospace' }}
                  placeholder='{"id": {"type": "string"}}'
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>提交人</label>
                <input
                  type="text"
                  value={newChange.commitAuthor}
                  onChange={e => setNewChange({ ...newChange, commitAuthor: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
                  placeholder="如：zhangsan"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>提交说明</label>
                <input
                  type="text"
                  value={newChange.commitMessage}
                  onChange={e => setNewChange({ ...newChange, commitMessage: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '14px' }}
                  placeholder="变更描述"
                />
              </div>
              <button
                onClick={handleCreateChange}
                style={{ width: '100%', padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                提交变更
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
