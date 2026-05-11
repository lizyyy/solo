import { useState, useEffect } from 'react';
import { getOrders, receiveOrder } from '../api';

const OrderManagement = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [actualQty, setActualQty] = useState(0);
  const [wastageQty, setWastageQty] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [activeTab]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const status = activeTab === 'pending' ? 'submitted' : activeTab === 'received';
      const res = await getOrders({ status });
      setOrders(res.data);
    } finally {
      setLoading(false);
    }
  };

  const openReceiveModal = (order: any) => {
    setSelectedOrder(order);
    setActualQty(order.adjusted_qty);
    setWastageQty(Math.round(order.adjusted_qty * 0.05));
    setExplanation('');
    setError(null);
    setShowModal(true);
  };

  const handleReceive = async () => {
    if (!selectedOrder) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      await receiveOrder(selectedOrder.id, {
        actualQty,
        wastageQty,
        explanation
      });
      
      setShowModal(false);
      setSelectedOrder(null);
      alert('收货完成！');
      loadOrders();
    } catch (err: any) {
      if (err.response?.data?.error === 'excess_delivery') {
        setError(err.response.data.message);
      } else {
        setError('操作失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>到货核对</h1>
      </div>

      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          待收货
        </div>
        <div 
          className={`tab ${activeTab === 'received' ? 'active' : ''}`}
          onClick={() => setActiveTab('received')}
        >
          已收货
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          {activeTab === 'pending' ? '暂无待收货订单' : '暂无已收货订单'}
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>商品</th>
                <th>品类</th>
                <th>报货日期</th>
                <th>到货日期</th>
                <th>采购量</th>
                <th>调整量</th>
                <th>调整原因</th>
                {activeTab === 'received' && (
                  <>
                    <th>实际到货</th>
                    <th>损耗</th>
                  </>
                )}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order: any) => {
                const diff = order.adjusted_qty - order.suggested_qty;
                return (
                  <tr key={order.id}>
                    <td>{order.product_name}</td>
                    <td>{order.category}</td>
                    <td>{order.order_date}</td>
                    <td>{order.delivery_date}</td>
                    <td>{order.suggested_qty} {order.unit}</td>
                    <td className={diff > 0 ? 'adjusted-higher' : diff < 0 ? 'adjusted-lower' : ''}>
                      {order.adjusted_qty} {order.unit}
                      {diff !== 0 && (
                        <span style={{ fontSize: 12, marginLeft: 4 }}>
                          ({diff > 0 ? '+' : ''}{diff})
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      {order.adjustment_reason || '-'}
                    </td>
                    {activeTab === 'received' && (
                      <>
                        <td className={order.actual_qty < order.adjusted_qty ? 'adjusted-lower' : ''}>
                          {order.actual_qty} {order.unit}
                        </td>
                        <td className={order.wastage_qty > order.actual_qty * 0.15 ? 'adjusted-higher' : ''}>
                          {order.wastage_qty} {order.unit}
                          <span style={{ fontSize: 12, marginLeft: 4 }}>
                            ({((order.wastage_qty / order.actual_qty * 100).toFixed(1)}%)
                          </span>
                        </td>
                      </>
                    )}
                    <td>
                      {activeTab === 'pending' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => openReceiveModal(order)}
                        >
                          📦 收货
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                收货确认 - {selectedOrder.product_name}
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            {error && (
              <div className="alert-banner error">
                <span>❌</span>
                <span>{error}</span>
              </div>
            )}

            <div className="row">
              <div className="col-3">
                <div className="prediction-row" style={{ flexDirection: 'column' }}>
                  <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                    采购量
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>
                    {selectedOrder.adjusted_qty} {selectedOrder.unit}
                  </div>
                </div>
              </div>
              <div className="col-3">
                <div className="prediction-row" style={{ flexDirection: 'column' }}>
                  <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                    调整原因
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>
                    {selectedOrder.adjustment_reason || '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16">
              <div className="form-group">
                <label className="form-label">
                  实际到货数量
                  {actualQty > selectedOrder.adjusted_qty && (
                    <span style={{ color: '#ef4444', marginLeft: 8 }}>
                      （超出采购量，需要说明原因）
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={actualQty}
                  onChange={e => setActualQty(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.5"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                损耗数量
                {wastageQty > actualQty * 0.15 && (
                  <span style={{ color: '#ef4444', marginLeft: 8 }}>
                    （损耗率超过15%，偏高）
                  </span>
                )}
              </label>
              <input
                type="number"
                className="form-input"
                value={wastageQty}
                onChange={e => setWastageQty(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.5"
              />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                损耗率：{actualQty > 0 ? ((wastageQty / actualQty) * 100).toFixed(1) : 0}%
              </div>
            </div>

            {(actualQty > selectedOrder.adjusted_qty || wastageQty > actualQty * 0.15) && (
              <div className="form-group">
                <label className="form-label">异常说明</label>
                <textarea
                  className="form-input form-textarea"
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  placeholder="请说明异常原因..."
                />
              </div>
            )}

            <div className="modal-footer">
              <button
              className="btn btn-outline"
              onClick={() => setShowModal(false)}
            >
              取消
            </button>
            <button
              className="btn btn-success"
              onClick={handleReceive}
              disabled={submitting}
            >
              {submitting ? '确认中...' : '✅ 确认收货'}
            </button>
          </div>
        </div>
      </div>
    );
};

export default OrderManagement;
