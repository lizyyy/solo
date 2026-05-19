import React, { useState, useEffect } from 'react';
import { inventoryApi } from '../api/client';
import type { InventoryPool, InventoryLog } from '../api/client';

const Inventory: React.FC = () => {
  const [pools, setPools] = useState<InventoryPool[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [selectedPool, setSelectedPool] = useState<InventoryPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newPool, setNewPool] = useState({
    poolName: '',
    initialQuantity: 100,
  });

  const fetchPools = async () => {
    try {
      const res = await inventoryApi.listPools();
      setPools(res.data);
    } catch (error) {
      console.error('Failed to fetch pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (poolId?: string) => {
    try {
      const res = await inventoryApi.getLogs({ poolId });
      setLogs(res.data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  useEffect(() => {
    fetchPools();
    fetchLogs();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createPool(newPool);
      showMessage('success', '库存池创建成功');
      setNewPool({ poolName: '', initialQuantity: 100 });
      fetchPools();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || '创建失败');
    }
  };

  const handlePoolClick = async (pool: InventoryPool) => {
    if (selectedPool?.pool_id === pool.pool_id) {
      setSelectedPool(null);
    } else {
      setSelectedPool(pool);
      await fetchLogs(pool.pool_id);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>库存池管理</h2>

      {message && (
        <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
          {message.text}
        </div>
      )}

      <form className="form" onSubmit={handleCreatePool}>
        <h3>创建库存池</h3>
        <div className="form-row">
          <div className="form-group">
            <label>库存池名称</label>
            <input
              type="text"
              value={newPool.poolName}
              onChange={(e) => setNewPool({ ...newPool, poolName: e.target.value })}
              placeholder="例如: 活动商品库存"
              required
            />
          </div>
          <div className="form-group">
            <label>初始库存</label>
            <input
              type="number"
              min="0"
              value={newPool.initialQuantity}
              onChange={(e) => setNewPool({ ...newPool, initialQuantity: parseInt(e.target.value) })}
              required
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={!newPool.poolName}>
          创建库存池
        </button>
      </form>

      <div className="section">
        <h3>库存池列表</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>库存池名称</th>
                <th>总量</th>
                <th>预占量</th>
                <th>可用量</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((pool) => (
                <tr
                  key={pool.pool_id}
                  className={`clickable ${selectedPool?.pool_id === pool.pool_id ? 'selected' : ''}`}
                  onClick={() => handlePoolClick(pool)}
                >
                  <td style={{ fontWeight: 600 }}>{pool.pool_name}</td>
                  <td>{pool.total_quantity}</td>
                  <td>
                    <span style={{ color: '#1565c0', fontWeight: 500 }}>{pool.reserved_quantity}</span>
                  </td>
                  <td>
                    <span style={{ color: '#2e7d32', fontWeight: 500 }}>{pool.available_quantity}</span>
                  </td>
                  <td>{new Date(pool.created_at).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
              {pools.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                    暂无库存池数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPool && (
        <div className="detail-panel">
          <div className="detail-header">
            <h3>库存流水 - {selectedPool.pool_name}</h3>
          </div>
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.log_id} className={`log-entry type-${log.change_type}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>{log.change_type}</span>
                  <span style={{ color: '#666', fontSize: '0.875rem' }}>
                    {new Date(log.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  订单: {log.order_id || '-'} | 数量变更: {log.quantity_change} | 操作人: {log.operator}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: '0.25rem' }}>
                  总量: {log.before_total} → {log.after_total} | 预占: {log.before_reserved} → {log.after_reserved}
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>暂无流水记录</p>
          )}
        </div>
      )}

      {!selectedPool && logs.length > 0 && (
        <div className="section">
          <h3>全部流水记录</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>操作类型</th>
                  <th>库存池</th>
                  <th>订单号</th>
                  <th>数量变更</th>
                  <th>操作人</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 50).map((log) => (
                  <tr key={log.log_id}>
                    <td>
                      <span className={`status-badge status-${log.change_type === 'RESERVE' ? 'RESERVED' : log.change_type}`}>
                        {log.change_type}
                      </span>
                    </td>
                    <td>{pools.find(p => p.pool_id === log.pool_id)?.pool_name || log.pool_id}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{log.order_id || '-'}</td>
                    <td>{log.quantity_change}</td>
                    <td>{log.operator}</td>
                    <td>{new Date(log.created_at).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;