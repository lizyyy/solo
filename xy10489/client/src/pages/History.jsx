import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Wrench, PackageCheck, ArrowRight } from 'lucide-react';
import api from '../utils/api';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/rework/history?limit=100');
      setHistory(res.data);
    } catch (err) {
      console.error('加载历史记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(item => {
    if (!filterType) return true;
    return item.record_type === filterType;
  });

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem' }}>正在加载...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>复判历史</h2>
        <div className="filter-row" style={{ marginBottom: 0 }}>
          <select 
            className="filter-select" 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">全部类型</option>
            <option value="decision">复判决定</option>
            <option value="rework">返工记录</option>
          </select>
        </div>
      </div>

      <div className="card">
        {filteredHistory.length > 0 ? (
          <div className="timeline">
            {filteredHistory.map((item, idx) => (
              <div key={`${item.record_type}-${item.id}`} className="timeline-item">
                <div className="timeline-dot" style={{ 
                  background: item.record_type === 'decision' ? '#10b981' : '#2563eb',
                  boxShadow: item.record_type === 'decision' ? '0 0 0 2px #10b981' : '0 0 0 2px #2563eb'
                }}></div>
                <div className={`timeline-content ${
                  item.record_type === 'decision' ? 'confirmed' : 'primary-border'
                }`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4>
                        {item.record_type === 'decision' ? (
                          <><PackageCheck size={16} style={{ display: 'inline', marginRight: '0.5rem' }} /> 复判决定</>
                        ) : (
                          <><Wrench size={16} style={{ display: 'inline', marginRight: '0.5rem' }} /> 返工</>
                        )}
                        {item.action}
                      </h4>
                      {item.quantity && <p>数量: {item.quantity} 件</p>}
                      {item.description && <p>{item.description}</p>}
                      {item.approval_basis && (
                        <p style={{ background: '#eff6ff', padding: '0.5rem', borderRadius: '0.25rem', marginTop: '0.5rem' }}>
                          <strong>批准依据:</strong> {item.approval_basis}
                        </p>
                      )}
                      <div className="timeline-meta">
                        操作人: {item.operator || '-'} · {item.created_at}
                      </div>
                    </div>
                    <Link to={`/batches/${item.batch_id}`} className="btn btn-secondary btn-sm">
                      批次详情 <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <ClipboardList size={48} style={{ margin: '0 auto 1rem', color: '#9ca3af' }} />
            <p>暂无复判历史记录</p>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">复判流程说明</h3>
        <div className="timeline" style={{ position: 'relative', paddingLeft: '2rem' }}>
          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <div className="timeline-content">
              <h4>1. 抽检发现缺陷</h4>
              <p>质检员抽检发现不良后，登记缺陷信息和严重程度</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <div className="timeline-content">
              <h4>2. 隔离库存</h4>
              <p>将有问题的产品隔离，防止流入下一道工序</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <div className="timeline-content">
              <h4>3. 复判或返工</h4>
              <p>根据情况进行复判决定，或安排返工处理</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <div className="timeline-content">
              <h4>4. 复检确认</h4>
              <p>返工后必须复检，确认质量合格</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot"></div>
            <div className="timeline-content" style={{ borderLeft: '4px solid #10b981' }}>
              <h4>5. 最终处理</h4>
              <p>根据复检结果，决定入库、返工、让步放行或报废</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
