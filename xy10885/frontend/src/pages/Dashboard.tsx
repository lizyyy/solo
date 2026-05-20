import React, { useState, useEffect } from 'react';
import { slotsApi, locksApi, vouchersApi, conflictsApi } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSlots: 0,
    availableSlots: 0,
    activeLocks: 0,
    totalVouchers: 0,
    validVouchers: 0,
    pendingConflicts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [slotsRes, locksRes, vouchersRes, conflictsRes] = await Promise.all([
        slotsApi.getSlots(),
        locksApi.getLocks(),
        vouchersApi.getVouchers(),
        conflictsApi.getConflicts()
      ]);

      const slots = slotsRes.data.data?.data || [];
      const locks = locksRes.data.data?.data || [];
      const vouchers = vouchersRes.data.data?.data || [];
      const conflicts = conflictsRes.data.data?.data || [];

      setStats({
        totalSlots: slots.length,
        availableSlots: slots.filter((s: any) => s.status === 'available').length,
        activeLocks: locks.filter((l: any) => l.status === 'locked').length,
        totalVouchers: vouchers.length,
        validVouchers: vouchers.filter((v: any) => v.status === 'valid').length,
        pendingConflicts: conflicts.filter((c: any) => c.status === 'pending').length
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>📊 数据概览</h2>
      
      <div className="grid-4">
        <div className="stat-card">
          <h3>总号源数</h3>
          <div className="value">{stats.totalSlots}</div>
        </div>
        <div className="stat-card">
          <h3>可用号源</h3>
          <div className="value" style={{ color: '#28a745' }}>{stats.availableSlots}</div>
        </div>
        <div className="stat-card">
          <h3>活跃锁号</h3>
          <div className="value" style={{ color: '#ffc107' }}>{stats.activeLocks}</div>
        </div>
        <div className="stat-card">
          <h3>有效凭证</h3>
          <div className="value" style={{ color: '#007bff' }}>{stats.validVouchers}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '20px' }}>
        <div className="card">
          <h3>凭证分布</h3>
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>{stats.validVouchers}</div>
              <div style={{ fontSize: '12px', color: '#6c757d' }}>有效</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6c757d' }}>{stats.totalVouchers - stats.validVouchers}</div>
              <div style={{ fontSize: '12px', color: '#6c757d' }}>已使用/已取消</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>待处理冲突</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: stats.pendingConflicts > 0 ? '#dc3545' : '#28a745' }}>
                {stats.pendingConflicts}
              </div>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                {stats.pendingConflicts > 0 ? '需要处理' : '全部处理完毕'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h3>快捷操作</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => window.location.href = '/slots'}>
            管理号源
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/locks'}>
            查看锁号记录
          </button>
          <button className="btn btn-success" onClick={() => window.location.href = '/vouchers'}>
            预约凭证
          </button>
          <button className="btn btn-danger" onClick={() => window.location.href = '/conflicts'}>
            处理冲突
          </button>
        </div>
      </div>
    </div>
  );
}
