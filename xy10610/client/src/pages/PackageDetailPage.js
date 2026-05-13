import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const PackageDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [packageData, setPackageData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    fetchPackageDetail();
    fetchTimeline();
  }, [id]);

  const fetchPackageDetail = async () => {
    try {
      const res = await axios.get(`/api/packages/${id}`);
      setPackageData(res.data);
    } catch (err) {
      console.error('获取包裹详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const res = await axios.get(`/api/export/timeline/${id}`);
      setTimeline(res.data);
    } catch (err) {
      console.error('获取时间线失败:', err);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: '待处理',
      cleared: '已清关',
      supplement_required: '需补资料',
      supplement_completed: '资料已补',
      returned: '已退单',
      resubmitted: '已重提',
      failed: '清关失败',
      tax_adjusted: '税费已调整'
    };
    return labels[status] || status;
  };

  const getCallbackTypeLabel = (type) => {
    const labels = {
      clearance_success: '清关成功',
      clearance_failed: '清关失败',
      document_required: '需补资料',
      tax_adjustment: '税费调整',
      inspection_required: '需查验',
      returned: '已退单'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="empty-state"><h3>加载中...</h3></div>
        </div>
      </div>
    );
  }

  if (!packageData) {
    return (
      <div className="container">
        <div className="card">
          <div className="empty-state">
            <h3>包裹不存在</h3>
            <button className="btn btn-primary mt-4" onClick={() => navigate('/packages')}>
              返回列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/packages')}>
            ← 返回
          </button>
          <h1 className="page-title">包裹详情 - {packageData.tracking_number}</h1>
          <span className={`badge status-${packageData.status}`}>
            {getStatusLabel(packageData.status)}
          </span>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
          基本信息
        </button>
        <button className={`tab ${activeTab === 'tax' ? 'active' : ''}`} onClick={() => setActiveTab('tax')}>
          税费计算
        </button>
        <button className={`tab ${activeTab === 'callbacks' ? 'active' : ''}`} onClick={() => setActiveTab('callbacks')}>
          海关回调
        </button>
        <button className={`tab ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>
          补资料工单
        </button>
        <button className={`tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
          事件时间线
        </button>
      </div>

      {activeTab === 'info' && (
        <div className="card">
          <h2 className="section-title">包裹信息</h2>
          <div className="grid-2">
            <div>
              <span className="label">运单号</span>
              <div className="value">{packageData.tracking_number}</div>
            </div>
            <div>
              <span className="label">当前状态</span>
              <div className="value"><span className={`badge status-${packageData.status}`}>{getStatusLabel(packageData.status)}</span></div>
            </div>
            <div>
              <span className="label">发件人</span>
              <div className="value">{packageData.sender_name} ({packageData.sender_country})</div>
            </div>
            <div>
              <span className="label">收件人</span>
              <div className="value">{packageData.receiver_name}</div>
            </div>
            <div>
              <span className="label">收件地址</span>
              <div className="value">{packageData.receiver_address}</div>
            </div>
            <div>
              <span className="label">重量</span>
              <div className="value">{packageData.weight} kg</div>
            </div>
            <div>
              <span className="label">申报价值</span>
              <div className="value">{packageData.declared_value} {packageData.currency}</div>
            </div>
            <div>
              <span className="label">创建时间</span>
              <div className="value">{new Date(packageData.created_at).toLocaleString('zh-CN')}</div>
            </div>
          </div>

          <h2 className="section-title mt-4">申报品类</h2>
          {packageData.declarationItems && packageData.declarationItems.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>HS编码</th>
                  <th>产品名称</th>
                  <th>数量</th>
                  <th>单价</th>
                  <th>总价值</th>
                  <th>品类</th>
                </tr>
              </thead>
              <tbody>
                {packageData.declarationItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.hs_code || '-'}</td>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unit_price}</td>
                    <td>{item.total_value}</td>
                    <td>{item.category || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="value">暂无申报品类数据</p>
          )}
        </div>
      )}

      {activeTab === 'tax' && (
        <div className="card">
          <h2 className="section-title">税费计算记录</h2>
          {packageData.taxCalculations && packageData.taxCalculations.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>计算时间</th>
                  <th>关税</th>
                  <th>增值税</th>
                  <th>消费税</th>
                  <th>总税费</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {packageData.taxCalculations.map((tax, idx) => (
                  <tr key={idx}>
                    <td>{new Date(tax.created_at).toLocaleString('zh-CN')}</td>
                    <td>{tax.customs_duty}</td>
                    <td>{tax.value_added_tax}</td>
                    <td>{tax.consumption_tax}</td>
                    <td><strong>{tax.total_tax}</strong></td>
                    <td><span className="badge badge-success">{tax.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="value">暂无税费计算记录</p>
          )}
        </div>
      )}

      {activeTab === 'callbacks' && (
        <div className="card">
          <h2 className="section-title">海关回调记录</h2>
          {packageData.customsCallbacks && packageData.customsCallbacks.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>回调类型</th>
                  <th>状态</th>
                  <th>消息</th>
                  <th>海关参考号</th>
                </tr>
              </thead>
              <tbody>
                {packageData.customsCallbacks.map((cb, idx) => (
                  <tr key={idx}>
                    <td>{new Date(cb.created_at).toLocaleString('zh-CN')}</td>
                    <td><span className="badge badge-info">{getCallbackTypeLabel(cb.callback_type)}</span></td>
                    <td>{cb.status}</td>
                    <td>{cb.message}</td>
                    <td>{cb.customs_reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="value">暂无海关回调记录</p>
          )}
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="card">
          <h2 className="section-title">补资料工单</h2>
          {packageData.supplementTickets && packageData.supplementTickets.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>工单号</th>
                  <th>当前处理人</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {packageData.supplementTickets.map((ticket, idx) => (
                  <tr key={idx}>
                    <td>{ticket.ticket_number}</td>
                    <td>{ticket.current_owner || '-'}</td>
                    <td><span className={`badge ${ticket.status === 'open' ? 'badge-warning' : 'badge-success'}`}>
                      {ticket.status === 'open' ? '待处理' : '已完成'}
                    </span></td>
                    <td><span className={`badge ${ticket.priority === 'high' ? 'badge-danger' : 'badge-info'}`}>
                      {ticket.priority === 'high' ? '高优先级' : '普通'}
                    </span></td>
                    <td>{new Date(ticket.created_at).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="value">暂无补资料工单</p>
          )}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="card">
          <h2 className="section-title">事件时间线</h2>
          {timeline.length > 0 ? (
            <div className="timeline">
              {timeline.map((item, idx) => (
                <div key={idx} className="timeline-item">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="timeline-title">{item.title}</div>
                    <div className="timeline-time">{new Date(item.time).toLocaleString('zh-CN')}</div>
                    <div className="timeline-desc">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="value">暂无时间线数据</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PackageDetailPage;
