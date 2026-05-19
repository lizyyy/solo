import React, { useState, useEffect } from 'react';
import { reservationApi, inventoryApi, adminApi } from '../api/client';
import type { Reservation, InventoryPool, ReleaseRecord } from '../api/client';

const Reservations: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [pools, setPools] = useState<InventoryPool[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [releaseRecords, setReleaseRecords] = useState<ReleaseRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [orderIdSearch, setOrderIdSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newReservation, setNewReservation] = useState({
    orderId: '',
    poolId: '',
    quantity: 1,
    expireSeconds: 1800,
  });

  const fetchReservations = async () => {
    try {
      const res = await reservationApi.list(statusFilter || undefined);
      let data = res.data;
      if (orderIdSearch) {
        data = data.filter(r => r.order_id.toLowerCase().includes(orderIdSearch.toLowerCase()));
      }
      setReservations(data);
    } catch (error) {
      console.error('Failed to fetch reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPools = async () => {
    try {
      const res = await inventoryApi.listPools();
      setPools(res.data);
    } catch (error) {
      console.error('Failed to fetch pools:', error);
    }
  };

  const fetchReleaseRecords = async (reservationId: string) => {
    try {
      const res = await adminApi.getReleaseRecords(reservationId);
      setReleaseRecords(res.data);
    } catch (error) {
      console.error('Failed to fetch release records:', error);
    }
  };

  useEffect(() => {
    fetchReservations();
    fetchPools();
  }, [statusFilter, orderIdSearch]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await reservationApi.create(newReservation);
      showMessage('success', '预占单创建成功');
      setNewReservation({ orderId: '', poolId: '', quantity: 1, expireSeconds: 1800 });
      fetchReservations();
      fetchPools();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || '创建失败');
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await reservationApi.confirm(id);
      showMessage('success', '确认成功');
      fetchReservations();
      fetchPools();
      if (selectedReservation?.reservation_id === id) {
        setSelectedReservation(null);
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || '确认失败');
    }
  };

  const handleRelease = async (id: string) => {
    try {
      await reservationApi.release(id, { releaseType: 'MANUAL', reason: '手动释放' });
      showMessage('success', '释放成功');
      fetchReservations();
      fetchPools();
      if (selectedReservation?.reservation_id === id) {
        setSelectedReservation(null);
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || '释放失败');
    }
  };

  const handleCompensate = async (id: string) => {
    try {
      await reservationApi.compensate(id, { operator: 'admin' });
      showMessage('success', '补偿成功');
      fetchReservations();
      fetchPools();
      if (selectedReservation?.reservation_id === id) {
        setSelectedReservation(null);
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || '补偿失败');
    }
  };

  const handleExport = async () => {
    try {
      const res = await reservationApi.exportCsv(statusFilter || undefined);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reservations_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      showMessage('error', '导出失败');
    }
  };

  const handleRowClick = async (reservation: Reservation) => {
    if (selectedReservation?.reservation_id === reservation.reservation_id) {
      setSelectedReservation(null);
      setReleaseRecords([]);
    } else {
      setSelectedReservation(reservation);
      await fetchReleaseRecords(reservation.reservation_id);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem' }}>预占单管理</h2>

      {message && (
        <div className={message.type === 'success' ? 'success-message' : 'error-message'}>
          {message.text}
        </div>
      )}

      <form className="form" onSubmit={handleCreateReservation}>
        <h3>创建预占单</h3>
        <div className="form-row">
          <div className="form-group">
            <label>订单号</label>
            <input
              type="text"
              value={newReservation.orderId}
              onChange={(e) => setNewReservation({ ...newReservation, orderId: e.target.value })}
              placeholder="例如: ORDER_001"
              required
            />
          </div>
          <div className="form-group">
            <label>库存池</label>
            <select
              value={newReservation.poolId}
              onChange={(e) => setNewReservation({ ...newReservation, poolId: e.target.value })}
              required
            >
              <option value="">选择库存池</option>
              {pools.map((pool) => (
                <option key={pool.pool_id} value={pool.pool_id}>
                  {pool.pool_name} (可用: {pool.available_quantity})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>预占数量</label>
            <input
              type="number"
              min="1"
              value={newReservation.quantity}
              onChange={(e) => setNewReservation({ ...newReservation, quantity: parseInt(e.target.value) })}
              required
            />
          </div>
          <div className="form-group">
            <label>超时时间 (秒)</label>
            <input
              type="number"
              min="60"
              value={newReservation.expireSeconds}
              onChange={(e) => setNewReservation({ ...newReservation, expireSeconds: parseInt(e.target.value) })}
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={!newReservation.poolId || !newReservation.orderId}>
          创建预占单
        </button>
      </form>

      <div className="filters">
        <div className="filter-group">
          <label>状态筛选:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部</option>
            <option value="RESERVED">待确认</option>
            <option value="CONFIRMED">已确认</option>
            <option value="RELEASED">已释放</option>
            <option value="RELEASE_FAILED">释放失败</option>
          </select>
        </div>
        <div className="filter-group">
          <label>订单号:</label>
          <input
            type="text"
            placeholder="搜索订单号"
            value={orderIdSearch}
            onChange={(e) => setOrderIdSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={handleExport}>
          导出 CSV
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>订单号</th>
              <th>库存池</th>
              <th>数量</th>
              <th>状态</th>
              <th>过期时间</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => (
              <tr
                key={reservation.reservation_id}
                className={`clickable ${selectedReservation?.reservation_id === reservation.reservation_id ? 'selected' : ''}`}
                onClick={() => handleRowClick(reservation)}
              >
                <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {reservation.order_id}
                </td>
                <td>{pools.find(p => p.pool_id === reservation.pool_id)?.pool_name || reservation.pool_id}</td>
                <td>{reservation.quantity}</td>
                <td>
                  <span className={`status-badge status-${reservation.status}`}>
                    {reservation.status}
                  </span>
                </td>
                <td>{new Date(reservation.expire_at).toLocaleString('zh-CN')}</td>
                <td>{new Date(reservation.created_at).toLocaleString('zh-CN')}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="btn-group">
                    {reservation.status === 'RESERVED' && (
                      <>
                        <button
                          className="btn btn-small btn-success"
                          onClick={() => handleConfirm(reservation.reservation_id)}
                        >
                          确认
                        </button>
                        <button
                          className="btn btn-small btn-warning"
                          onClick={() => handleRelease(reservation.reservation_id)}
                        >
                          释放
                        </button>
                      </>
                    )}
                    {reservation.status === 'RELEASE_FAILED' && (
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => handleCompensate(reservation.reservation_id)}
                      >
                        手动补偿
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {reservations.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  暂无预占单数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedReservation && (
        <div className="detail-panel">
          <div className="detail-header">
            <h3>预占单详情</h3>
            <span style={{ fontFamily: 'monospace' }}>{selectedReservation.reservation_id}</span>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <label>订单号</label>
              <span>{selectedReservation.order_id}</span>
            </div>
            <div className="detail-item">
              <label>库存池</label>
              <span>{pools.find(p => p.pool_id === selectedReservation.pool_id)?.pool_name || selectedReservation.pool_id}</span>
            </div>
            <div className="detail-item">
              <label>数量</label>
              <span>{selectedReservation.quantity}</span>
            </div>
            <div className="detail-item">
              <label>状态</label>
              <span>
                <span className={`status-badge status-${selectedReservation.status}`}>
                  {selectedReservation.status}
                </span>
              </span>
            </div>
          </div>
          <div className="detail-row">
            <div className="detail-item">
              <label>过期时间</label>
              <span>{new Date(selectedReservation.expire_at).toLocaleString('zh-CN')}</span>
            </div>
            <div className="detail-item">
              <label>创建时间</label>
              <span>{new Date(selectedReservation.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <div className="detail-item">
              <label>更新时间</label>
              <span>{new Date(selectedReservation.updated_at).toLocaleString('zh-CN')}</span>
            </div>
          </div>

          {releaseRecords.length > 0 && (
            <div className="compensation-section">
              <h4>释放记录</h4>
              {releaseRecords.map((record) => (
                <div key={record.record_id} className="log-entry">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>{record.release_type} - {record.release_reason || '无理由'}</span>
                    <span style={{ color: '#666', fontSize: '0.875rem' }}>
                      {new Date(record.created_at).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    操作人: {record.released_by} | 数量: {record.quantity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reservations;