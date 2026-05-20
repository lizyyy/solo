import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { slotsApi } from '../api';

export default function SlotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) {
      loadTimeline();
    }
  }, [id]);

  async function loadTimeline() {
    try {
      setLoading(true);
      const res = await slotsApi.getSlotTimeline(id!);
      setTimeline(res.data.data);
    } catch (error) {
      console.error('加载详情失败:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"></div></div>;
  }

  if (!timeline) {
    return <div className="card">号源不存在</div>;
  }

  return (
    <div>
      <button className="btn btn-secondary" onClick={() => navigate('/slots')} style={{ marginBottom: '20px' }}>
        ← 返回列表
      </button>

      <div className="card">
        <h2>📋 号源详情</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '20px' }}>
          <div>
            <div style={{ color: '#6c757d', fontSize: '12px' }}>科室</div>
            <div style={{ fontWeight: '500' }}>{timeline.slot.department_name}</div>
          </div>
          <div>
            <div style={{ color: '#6c757d', fontSize: '12px' }}>日期</div>
            <div style={{ fontWeight: '500' }}>{timeline.slot.date}</div>
          </div>
          <div>
            <div style={{ color: '#6c757d', fontSize: '12px' }}>时段</div>
            <div style={{ fontWeight: '500' }}>{timeline.slot.time_slot}</div>
          </div>
          <div>
            <div style={{ color: '#6c757d', fontSize: '12px' }}>状态</div>
            <span className={`badge badge-${timeline.slot.status}`}>
              {timeline.slot.status === 'available' ? '可用' : '已满'}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
          <div>
            <div style={{ color: '#6c757d', fontSize: '12px' }}>总号数</div>
            <div style={{ fontWeight: '500', fontSize: '20px' }}>{timeline.slot.total_count}</div>
          </div>
          <div>
            <div style={{ color: '#6c757d', fontSize: '12px' }}>可用号数</div>
            <div style={{ fontWeight: '500', fontSize: '20px', color: '#28a745' }}>{timeline.slot.available_count}</div>
          </div>
          <div>
            <div style={{ color: '#6c757d', fontSize: '12px' }}>已锁号数</div>
            <div style={{ fontWeight: '500', fontSize: '20px', color: '#ffc107' }}>{timeline.slot.locked_count}</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={activeTab === 'locks' ? 'active' : ''} onClick={() => setActiveTab('locks')}>
          🔒 锁号记录 ({timeline.locks?.length || 0})
        </button>
        <button className={activeTab === 'vouchers' ? 'active' : ''} onClick={() => setActiveTab('vouchers')}>
          📄 预约凭证 ({timeline.vouchers?.length || 0})
        </button>
        <button className={activeTab === 'releases' ? 'active' : ''} onClick={() => setActiveTab('releases')}>
          ↩️ 释放记录 ({timeline.releases?.length || 0})
        </button>
        <button className={activeTab === 'conflicts' ? 'active' : ''} onClick={() => setActiveTab('conflicts')}>
          ⚠️ 冲突记录 ({timeline.conflicts?.length || 0})
        </button>
        <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>
          📝 操作日志 ({timeline.logs?.length || 0})
        </button>
      </div>

      <div className="card">
        {activeTab === 'locks' && (
          <div className="timeline">
            {timeline.locks?.map((lock: any) => (
              <div key={lock.id} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <h4>锁号 - {lock.patient_name}</h4>
                  <p>患者ID: {lock.patient_id}</p>
                  <p>操作人: {lock.operator_name || '系统'}</p>
                  <p>状态: <span className={`badge badge-${lock.status}`}>{lock.status}</span></p>
                  <p className="time">创建时间: {new Date(lock.created_at).toLocaleString()}</p>
                  <p className="time">过期时间: {new Date(lock.expires_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {timeline.locks?.length === 0 && (
              <p style={{ textAlign: 'center', color: '#6c757d' }}>暂无锁号记录</p>
            )}
          </div>
        )}

        {activeTab === 'vouchers' && (
          <div className="timeline">
            {timeline.vouchers?.map((voucher: any) => (
              <div key={voucher.id} className="timeline-item">
                <div className="timeline-dot" style={{ background: '#28a745' }}></div>
                <div className="timeline-content">
                  <h4>预约凭证 - {voucher.voucher_code}</h4>
                  <p>患者: {voucher.patient_name}</p>
                  <p>状态: <span className={`badge badge-${voucher.status}`}>{voucher.status}</span></p>
                  <p className="time">创建时间: {new Date(voucher.created_at).toLocaleString()}</p>
                  {voucher.check_in_time && (
                    <p className="time">签到时间: {new Date(voucher.check_in_time).toLocaleString()}</p>
                  )}
                  {voucher.cancel_time && (
                    <p className="time">取消时间: {new Date(voucher.cancel_time).toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
            {timeline.vouchers?.length === 0 && (
              <p style={{ textAlign: 'center', color: '#6c757d' }}>暂无预约凭证</p>
            )}
          </div>
        )}

        {activeTab === 'releases' && (
          <div className="timeline">
            {timeline.releases?.map((release: any) => (
              <div key={release.id} className="timeline-item">
                <div className="timeline-dot" style={{ background: '#dc3545' }}></div>
                <div className="timeline-content">
                  <h4>号源释放 - {release.patient_name}</h4>
                  <p>释放类型: {release.release_type}</p>
                  <p>原因: {release.reason}</p>
                  <p>操作人: {release.operator_name || '系统'}</p>
                  <p className="time">释放时间: {new Date(release.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {timeline.releases?.length === 0 && (
              <p style={{ textAlign: 'center', color: '#6c757d' }}>暂无释放记录</p>
            )}
          </div>
        )}

        {activeTab === 'conflicts' && (
          <div className="timeline">
            {timeline.conflicts?.map((conflict: any) => (
              <div key={conflict.id} className="timeline-item">
                <div className="timeline-dot" style={{ background: '#ffc107' }}></div>
                <div className="timeline-content">
                  <h4>冲突记录</h4>
                  <p>患者: {conflict.patient_name}</p>
                  <p>冲突类型: {conflict.conflict_type}</p>
                  <p>描述: {conflict.description || '-'}</p>
                  <p>状态: <span className={`badge badge-${conflict.status === 'pending' ? 'locked' : 'available'}`}>
                    {conflict.status === 'pending' ? '待处理' : conflict.status === 'resolved' ? '已解决' : '已忽略'}
                  </span></p>
                  <p className="time">创建时间: {new Date(conflict.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {timeline.conflicts?.length === 0 && (
              <p style={{ textAlign: 'center', color: '#6c757d' }}>暂无冲突记录</p>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="timeline">
            {timeline.logs?.map((log: any) => (
              <div key={log.id} className="timeline-item">
                <div className="timeline-dot" style={{ background: log.result === 'success' ? '#28a745' : '#dc3545' }}></div>
                <div className="timeline-content">
                  <h4>{log.operation_type}</h4>
                  <p>结果: <span className={`badge badge-${log.result === 'success' ? 'available' : 'full'}`}>
                    {log.result === 'success' ? '成功' : '失败'}
                  </span></p>
                  {log.error_message && <p>错误: {log.error_message}</p>}
                  <p>操作人: {log.operator_name || '系统'}</p>
                  <p className="time">时间: {new Date(log.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {timeline.logs?.length === 0 && (
              <p style={{ textAlign: 'center', color: '#6c757d' }}>暂无操作日志</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
