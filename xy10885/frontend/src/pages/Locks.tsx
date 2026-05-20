import React, { useState, useEffect } from 'react';
import { locksApi, vouchersApi } from '../api';
import { useAppStore } from '../store';

export default function Locks() {
  const { showNotification } = useAppStore();
  const [locks, setLocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    patient_id: '',
    status: ''
  });

  useEffect(() => {
    loadLocks();
  }, [filters]);

  async function loadLocks() {
    try {
      setLoading(true);
      const res = await locksApi.getLocks(filters);
      setLocks(res.data.data?.data || []);
    } catch (error) {
      console.error('加载锁号记录失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRelease(lock: any) {
    if (!window.confirm('确认释放此锁号？')) return;
    
    try {
      await locksApi.releaseLock(lock.id, {
        reason: '手动释放',
        release_type: 'manual'
      });
      showNotification('success', '释放成功');
      loadLocks();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '释放失败');
    }
  }

  async function handleConfirm(lock: any) {
    if (!window.confirm('确认将此锁号转为预约凭证？')) return;
    
    try {
      await locksApi.confirmLock(lock.id);
      showNotification('success', '已生成预约凭证');
      loadLocks();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '确认失败');
    }
  }

  async function handleCheckExpired() {
    try {
      await locksApi.checkExpired();
      showNotification('success', '已检查并释放超时锁号');
      loadLocks();
    } catch (error: any) {
      showNotification('error', error.response?.data?.error || '检查失败');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🔒 锁号记录</h2>
        <button className="btn btn-secondary" onClick={handleCheckExpired}>
          检查超时锁号
        </button>
      </div>

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
            <option value="locked">已锁定</option>
            <option value="confirmed">已确认</option>
            <option value="released">已释放</option>
          </select>
          <button className="btn btn-secondary" onClick={() => setFilters({ patient_id: '', status: '' })}>
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
                <th>号源ID</th>
                <th>锁号类型</th>
                <th>状态</th>
                <th>过期时间</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {locks.map((lock) => (
                <tr key={lock.id}>
                  <td>
                    <div>{lock.patient_name}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>{lock.patient_id}</div>
                  </td>
                  <td style={{ fontSize: '12px' }}>{lock.slot_id.substring(0, 8)}...</td>
                  <td>{lock.lock_type === 'temporary' ? '临时锁号' : '永久锁号'}</td>
                  <td>
                    <span className={`badge badge-${lock.status === 'locked' ? 'locked' : lock.status === 'confirmed' ? 'valid' : 'available'}`}>
                      {lock.status === 'locked' ? '已锁定' : lock.status === 'confirmed' ? '已确认' : '已释放'}
                    </span>
                  </td>
                  <td>{new Date(lock.expires_at).toLocaleString()}</td>
                  <td>{new Date(lock.created_at).toLocaleString()}</td>
                  <td>
                    {lock.status === 'locked' && (
                      <>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleConfirm(lock)}
                          style={{ marginRight: '8px' }}
                        >
                          确认预约
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRelease(lock)}
                        >
                          释放
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {locks.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                    暂无锁号记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
