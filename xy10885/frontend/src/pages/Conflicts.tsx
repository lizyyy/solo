import React, { useState, useEffect } from 'react';
import { conflictsApi } from '../api';
import { useAppStore } from '../store';

export default function Conflicts() {
  const { showNotification } = useAppStore();
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    patient_id: '',
    status: ''
  });

  useEffect(() => {
    loadConflicts();
  }, [filters]);

  async function loadConflicts() {
    try {
      setLoading(true);
      const res = await conflictsApi.getConflicts(filters);
      setConflicts(res.data.data?.data || []);
    } catch (error) {
      console.error('加载冲突记录失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(conflict: any, status: string) {
    try {
      await conflictsApi.resolveConflict(conflict.id, {
        status,
        resolver_id: 'ADMIN001',
        resolver_name: '系统管理员'
      });
      showNotification('success', '处理成功');
      loadConflicts();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '处理失败');
    }
  }

  const getConflictTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      'dup_patient': '重复锁号',
      'overlock': '超额锁定',
      'system_mismatch': '系统数据不一致',
      'data_error': '数据异常'
    };
    return map[type] || type;
  };

  return (
    <div>
      <h2 style={{ marginBottom: '20px' }}>⚠️ 冲突处理</h2>

      <div className="card">
        <div className="filter-bar">
          <input
            type="text"
            placeholder="患者ID"
            value={filters.patient_id}
            onChange={(e) => setFilters({ ...filters, patient_id: e.target.value })}
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="resolved">已解决</option>
            <option value="ignored">已忽略</option>
          </select>
          <button className="btn btn-secondary" onClick={() => setFilters({ patient_id: '', status: '' }}>
            重置
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>患者</th>
                <th>冲突类型</th>
                <th>描述</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>处理时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((conflict) => (
                <tr key={conflict.id}>
                  <td>
                    <div>{conflict.patient_name}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>{conflict.patient_id}</div>
                  </td>
                  <td>
                    <span className="badge badge-locked">
                      {getConflictTypeLabel(conflict.conflict_type)}
                    </span>
                  </td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conflict.description || '-'}
                  </td>
                  <td>
                    <span className={`badge badge-${conflict.status === 'pending' ? 'locked' : conflict.status === 'resolved' ? 'available' : 'full'}`}>
                      {conflict.status === 'pending' ? '待处理' : conflict.status === 'resolved' ? '已解决' : '已忽略'}
                    </span>
                  </td>
                  <td>{new Date(conflict.created_at).toLocaleString()}</td>
                  <td>
                    {conflict.resolved_at ? new Date(conflict.resolved_at).toLocaleString() : '-'}
                  </td>
                  <td>
                    {conflict.status === 'pending' && (
                    <>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleResolve(conflict, 'resolved')}
                        style={{ marginRight: '8px' }}
                      >
                        解决
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleResolve(conflict, 'ignored')}
                      >
                        忽略
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {conflicts.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                  暂无冲突记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
