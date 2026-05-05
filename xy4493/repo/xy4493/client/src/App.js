import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = '';

const DATA_TYPES = [
  { key: 'registrations', label: '学员报名', description: '导入学员报名信息 CSV/JSON' },
  { key: 'rentals', label: '雪具租借', description: '导入雪具租借记录 CSV/JSON' },
  { key: 'coaches', label: '教练证照', description: '导入教练证照信息 CSV/JSON' },
  { key: 'slopes', label: '雪道开放', description: '导入雪道开放状态 CSV/JSON' },
  { key: 'weather', label: '天气风力', description: '导入天气风力数据 CSV/JSON' }
];

function App() {
  const [activeTab, setActiveTab] = useState('classes');
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [expandedClass, setExpandedClass] = useState(null);
  const [overrideForms, setOverrideForms] = useState({});
  const [dataPreviews, setDataPreviews] = useState({});

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/classes`);
      setClasses(response.data);
    } catch (error) {
      showToast('获取课程数据失败: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleFileImport = async (type, file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/import/${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      showToast(`成功导入 ${response.data.count} 条记录`);
      
      try {
        const previewResponse = await axios.get(`${API_BASE}/api/data/${type}`);
        setDataPreviews(prev => ({
          ...prev,
          [type]: previewResponse.data
        }));
      } catch (e) {
        console.error('获取预览数据失败', e);
      }
      
      if (activeTab === 'classes') {
        fetchClasses();
      }
    } catch (error) {
      showToast('导入失败: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideSubmit = async (classId) => {
    const formData = overrideForms[classId] || {};
    
    if (!formData.notes && formData.forceOpen === undefined) {
      showToast('请至少设置一项改判内容', 'error');
      return;
    }
    
    try {
      const payload = {};
      if (formData.forceOpen !== undefined) {
        payload.forceOpen = formData.forceOpen;
      }
      if (formData.notes) {
        payload.notes = formData.notes;
      }
      
      await axios.post(`${API_BASE}/api/overrides/${classId}`, payload);
      showToast('改判已保存');
      fetchClasses();
      setOverrideForms(prev => ({
        ...prev,
        [classId]: {}
      }));
    } catch (error) {
      showToast('保存改判失败: ' + error.message, 'error');
    }
  };

  const handleClearOverride = async (classId) => {
    try {
      await axios.delete(`${API_BASE}/api/overrides/${classId}`);
      showToast('改判已清除');
      fetchClasses();
    } catch (error) {
      showToast('清除改判失败: ' + error.message, 'error');
    }
  };

  const handleExportMarkdown = () => {
    window.open(`${API_BASE}/api/export/markdown`, '_blank');
    showToast('Markdown 清单已导出');
  };

  const handleExportJSON = () => {
    window.open(`${API_BASE}/api/export/json`, '_blank');
    showToast('JSON 审计包已导出');
  };

  const getEffectiveStatus = (cls) => {
    if (cls.override && cls.override.forceOpen !== undefined) {
      return cls.override.forceOpen ? 'overridden_open' : 'overridden_closed';
    }
    return cls.canOpen ? 'open' : 'closed';
  };

  const renderImportSection = () => (
    <div>
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>数据导入</h3>
        <p style={{ marginBottom: '20px', color: '#666' }}>
          支持导入 CSV 或 JSON 格式的数据源。导入后的数据将用于自动判断每节课是否可以开班。
        </p>
      </div>
      
      <div className="import-grid">
        {DATA_TYPES.map(type => (
          <div key={type.key} className="card">
            <div className="import-section">
              <h3>{type.label}</h3>
              <p style={{ marginBottom: '15px', color: '#666', fontSize: '0.9rem' }}>
                {type.description}
              </p>
              <input
                type="file"
                id={`file-${type.key}`}
                className="file-input"
                accept=".csv,.json"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleFileImport(type.key, file);
                }}
              />
              <label htmlFor={`file-${type.key}`} className="file-label">
                选择文件上传
              </label>
            </div>
            
            {dataPreviews[type.key] && (
              <div className="data-preview">
                <h4 style={{ marginBottom: '10px' }}>当前数据预览 ({dataPreviews[type.key].length} 条)</h4>
                <pre>{JSON.stringify(dataPreviews[type.key].slice(0, 3), null, 2)}</pre>
                {dataPreviews[type.key].length > 3 && (
                  <p style={{ marginTop: '10px', color: '#666', fontSize: '0.875rem' }}>
                    ...还有 {dataPreviews[type.key].length - 3} 条记录
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="card">
        <h4 style={{ marginBottom: '15px' }}>示例数据格式</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div>
            <h5 style={{ marginBottom: '10px', color: '#667eea' }}>学员报名 (registrations)</h5>
            <pre style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', overflowX: 'auto' }}>
{`[
  {
    "studentId": "S001",
    "studentName": "张三",
    "classDate": "2026-05-10",
    "classTime": "09:00",
    "level": "初级",
    "instructor": "李教练"
  }
]`}
            </pre>
          </div>
          <div>
            <h5 style={{ marginBottom: '10px', color: '#667eea' }}>教练证照 (coaches)</h5>
            <pre style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', overflowX: 'auto' }}>
{`[
  {
    "id": "C001",
    "name": "李教练",
    "certLevel": "一级",
    "expiryDate": "2027-12-31",
    "status": "valid"
  }
]`}
            </pre>
          </div>
          <div>
            <h5 style={{ marginBottom: '10px', color: '#667eea' }}>天气风力 (weather)</h5>
            <pre style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', overflowX: 'auto' }}>
{`[
  {
    "date": "2026-05-10",
    "temperature": -15,
    "windSpeed": 8,
    "visibility": 2000,
    "condition": "晴"
  }
]`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );

  const renderClassesSection = () => {
    const openCount = classes.filter(c => getEffectiveStatus(c) === 'open' || getEffectiveStatus(c) === 'overridden_open').length;
    const closedCount = classes.length - openCount;
    const overriddenCount = classes.filter(c => c.override).length;
    
    return (
      <div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value stat-info">{classes.length}</div>
            <div className="stat-label">总课程数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value stat-success">{openCount}</div>
            <div className="stat-label">可开班</div>
          </div>
          <div className="stat-card">
            <div className="stat-value stat-error">{closedCount}</div>
            <div className="stat-label">不可开班</div>
          </div>
          {overriddenCount > 0 && (
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#667eea' }}>{overriddenCount}</div>
              <div className="stat-label">已人工改判</div>
            </div>
          )}
        </div>
        
        <div className="card" style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <h3>开班判断结果</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn btn-outline refresh-btn" onClick={fetchClasses} disabled={loading}>
                🔄 刷新数据
              </button>
              <button className="btn btn-primary" onClick={handleExportMarkdown}>
                📄 导出 Markdown
              </button>
              <button className="btn btn-success" onClick={handleExportJSON}>
                📦 导出 JSON 审计包
              </button>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>加载中...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <h3>暂无课程数据</h3>
              <p>请先导入学员报名数据，然后返回此页面查看开班判断结果。</p>
              <button 
                className="btn btn-primary" 
                style={{ marginTop: '20px' }}
                onClick={() => setActiveTab('import')}
              >
                前往数据导入
              </button>
            </div>
          </div>
        ) : (
          classes.map(cls => {
            const status = getEffectiveStatus(cls);
            const isExpanded = expandedClass === cls.id;
            const currentForm = overrideForms[cls.id] || {};
            
            return (
              <div key={cls.id} className="card">
                <div className="card-header">
                  <div className="card-title">
                    {cls.date} {cls.time} - {cls.level}班
                  </div>
                  <span 
                    className={`status-badge ${
                      status === 'open' ? 'status-success' :
                      status === 'overridden_open' ? 'status-success' :
                      status === 'overridden_closed' ? 'status-error' :
                      'status-error'
                    }`}
                  >
                    {status === 'open' ? '✅ 可以开班' :
                     status === 'overridden_open' ? '✅ 强制开班 (人工改判)' :
                     status === 'overridden_closed' ? '❌ 强制取消 (人工改判)' :
                     '❌ 不可开班'}
                  </span>
                </div>
                
                <div className="class-info">
                  <div className="info-item">
                    <div className="info-label">教练</div>
                    <div className="info-value">{cls.instructor || '未分配'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">学员人数</div>
                    <div className="info-value">{cls.registrations} 人</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">问题数</div>
                    <div className="info-value" style={{ color: cls.issues.length > 0 ? '#dc3545' : '#28a745' }}>
                      {cls.issues.length} 个
                    </div>
                  </div>
                </div>
                
                {cls.issues.length > 0 && (
                  <div className="issues-list">
                    <h4 style={{ marginBottom: '12px', color: '#495057' }}>问题/缺口详情：</h4>
                    {cls.issues.map((issue, idx) => (
                      <div key={idx} className={`issue-item ${issue.severity}`}>
                        <div className="issue-title">
                          {issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🔵'}
                          {' '}{issue.message}
                        </div>
                        {issue.gap > 0 && (
                          <div className="issue-gap">缺口: {issue.gap}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {cls.override && (
                  <div className="current-override">
                    <h5>当前人工改判</h5>
                    {cls.override.forceOpen !== undefined && (
                      <p>
                        <strong>决策:</strong> {cls.override.forceOpen ? '强制开班' : '强制取消'}
                      </p>
                    )}
                    {cls.override.notes && (
                      <p><strong>备注:</strong> {cls.override.notes}</p>
                    )}
                    <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>
                      更新时间: {new Date(cls.override.updatedAt).toLocaleString('zh-CN')}
                    </p>
                    <button 
                      className="btn btn-danger" 
                      style={{ marginTop: '10px' }}
                      onClick={() => handleClearOverride(cls.id)}
                    >
                      清除改判
                    </button>
                  </div>
                )}
                
                <div style={{ marginTop: '16px' }}>
                  <button 
                    className="btn btn-outline"
                    onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
                  >
                    {isExpanded ? '收起人工改判' : '展开人工改判'}
                  </button>
                </div>
                
                {isExpanded && (
                  <div className="override-section">
                    <h4>人工改判</h4>
                    <p style={{ marginBottom: '12px', color: '#666', fontSize: '0.9rem' }}>
                      可以强制开班或取消，并添加备注说明。改判后刷新页面不丢失。
                    </p>
                    
                    <div className="override-buttons">
                      <button 
                        className={`btn ${currentForm.forceOpen === true ? 'btn-success' : 'btn-outline'}`}
                        onClick={() => setOverrideForms(prev => ({
                          ...prev,
                          [cls.id]: { ...prev[cls.id], forceOpen: true }
                        }))}
                      >
                        ✅ 强制开班
                      </button>
                      <button 
                        className={`btn ${currentForm.forceOpen === false ? 'btn-danger' : 'btn-outline'}`}
                        onClick={() => setOverrideForms(prev => ({
                          ...prev,
                          [cls.id]: { ...prev[cls.id], forceOpen: false }
                        }))}
                      >
                        ❌ 强制取消
                      </button>
                      {currentForm.forceOpen !== undefined && (
                        <button 
                          className="btn btn-secondary"
                          onClick={() => setOverrideForms(prev => ({
                            ...prev,
                            [cls.id]: { ...prev[cls.id], forceOpen: undefined }
                          }))}
                        >
                          清除决策
                        </button>
                      )}
                    </div>
                    
                    <textarea
                      className="override-notes"
                      placeholder="添加改判备注说明（可选）..."
                      value={currentForm.notes || ''}
                      onChange={(e) => setOverrideForms(prev => ({
                        ...prev,
                        [cls.id]: { ...prev[cls.id], notes: e.target.value }
                      }))}
                    />
                    
                    <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                      <button 
                        className="btn btn-primary"
                        onClick={() => handleOverrideSubmit(cls.id)}
                      >
                        💾 保存改判
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🎿 滑雪学校开班管理系统</h1>
        <p>
          整合学员报名、雪具租借、教练证照、雪道开放和天气风力数据，
          智能判断每节课是否可以开班，并支持人工改判和数据导出。
        </p>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'classes' ? 'active' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          📋 开班判断
        </button>
        <button 
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          📥 数据导入
        </button>
      </div>
      
      {activeTab === 'import' ? renderImportSection() : renderClassesSection()}
      
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
