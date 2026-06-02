import { useState, useEffect } from 'react';
import { conflictsApi } from '../api';
import type { DataConflict } from '../api';

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<DataConflict[]>([]);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    loadData();
  }, [includeResolved]);

  async function loadData() {
    try {
      const response = await conflictsApi.getAll(includeResolved);
      setConflicts(response.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(conflictId: number) {
    try {
      await conflictsApi.resolve(conflictId, '何工', resolution);
      setResolvingId(null);
      setResolution('');
      loadData();
    } catch (error) {
      console.error('解决冲突失败:', error);
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'pruning_suggestion': return '修剪建议冲突';
      case 'status': return '状态冲突';
      case 'location_name': return '点位名称冲突';
      default: return '其他冲突';
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  const unresolvedCount = conflicts.filter(c => !c.resolved).length;

  return (
    <div>
      <div className="page-header">
        <h2>数据冲突</h2>
        <p>自动检测并处理数据不一致问题，确保数据准确性</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card" style={{ background: '#fef2f2' }}>
          <div className="stat-value" style={{ color: 'var(--danger-color)' }}>{unresolvedCount}</div>
          <div className="stat-label">⚠️ 待处理冲突</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{conflicts.filter(c => c.resolved).length}</div>
          <div className="stat-label">✅ 已解决</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{conflicts.length}</div>
          <div className="stat-label">📊 总冲突数</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>冲突列表</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
              <input 
                type="checkbox" 
                checked={includeResolved}
                onChange={(e) => setIncludeResolved(e.target.checked)}
              />
              显示已解决
            </label>
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
              🔄 刷新
            </button>
          </div>
        </div>
        <div className="card-body">
          {conflicts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎉</div>
              <div className="empty-state-text">暂无数据冲突</div>
            </div>
          ) : (
            conflicts.map(conflict => (
              <div 
                key={conflict.id} 
                className={`conflict-card ${conflict.resolved ? 'resolved' : ''}`}
              >
                <div className="conflict-header">
                  <div>
                    <span className="conflict-type">
                      {conflict.locationName && <strong>{conflict.locationName}</strong>}
                      {' · '}
                      {getTypeLabel(conflict.type)}
                    </span>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      检测时间: {conflict.createdAt}
                    </div>
                  </div>
                  <div>
                    {conflict.resolved ? (
                      <span className="badge badge-resolved">
                        已解决 · {conflict.resolvedBy}
                      </span>
                    ) : (
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={() => setResolvingId(
                          resolvingId === conflict.id ? null : conflict.id
                        )}
                      >
                        {resolvingId === conflict.id ? '取消' : '标记解决'}
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="conflict-sources">
                  <div className="conflict-source">
                    <div className="conflict-source-label">{conflict.sourceA}</div>
                    <div>{conflict.valueA}</div>
                  </div>
                  <div className="conflict-source">
                    <div className="conflict-source-label">{conflict.sourceB}</div>
                    <div>{conflict.valueB}</div>
                  </div>
                </div>
                
                <div className="conflict-description" style={{ fontSize: '13px', marginBottom: '8px' }}>
                  <strong>问题描述：</strong>{conflict.description}
                </div>
                
                <div className="conflict-suggestion">
                  💡 <strong>处理建议：</strong>{conflict.suggestion}
                </div>

                {resolvingId === conflict.id && (
                  <div style={{ marginTop: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">处理说明（可选）</label>
                      <textarea
                        className="form-textarea"
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="请输入处理说明，便于后续追溯..."
                      />
                    </div>
                    <button 
                      className="btn btn-primary"
                      onClick={() => handleResolve(conflict.id)}
                    >
                      确认解决
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>💡 使用说明</h3>
        </div>
        <div className="card-body">
          <ul style={{ fontSize: '14px', lineHeight: '2', paddingLeft: '20px' }}>
            <li><strong>自动检测</strong>：系统自动检测居民反馈、修剪方案之间的数据冲突</li>
            <li><strong>双向对比</strong>：展示冲突双方的原始数据，便于人工核对</li>
            <li><strong>不替用户拍板</strong>：系统只提供处理建议，最终决策由人工确认</li>
            <li><strong>全程追溯</strong>：所有冲突处理记录都保留，便于后续审计</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
