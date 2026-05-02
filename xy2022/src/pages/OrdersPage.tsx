import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomTabBar from '../components/BottomTabBar';
import { EmptyState, Tag } from '../components/UI';
import { useToast } from '../components/Toast';
import { useAppStore } from '../store/appStore';
import {
  getStatusText,
  getStatusColor,
} from '../data/mockData';
import type { Order } from '../types';

const OrdersPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { orders, fetchOrders, updateOrderStatus, replicateOrder } =
    useAppStore();

  const [activeTab, setActiveTab] = useState<Order['status'] | 'all'>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const tabs = [
    { id: 'all' as const, label: '全部' },
    { id: 'pending_payment' as const, label: '待付款' },
    { id: 'pending_accept' as const, label: '待接单' },
    { id: 'in_progress' as const, label: '进行中' },
    { id: 'completed' as const, label: '已完成' },
    { id: 'refund' as const, label: '退款售后' },
  ];

  const filteredOrders =
    activeTab === 'all'
      ? orders
      : orders.filter((o) => o.status === activeTab);

  const serviceTypeNameMap: Record<string, string> = {
    feeding: '上门喂狗',
    walking: '上门遛狗',
    boarding: '寄养服务',
    bathing: '洗澡服务',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(
      date.getHours()
    ).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const handlePay = (order: Order) => {
    setLoading(true);
    setTimeout(() => {
      updateOrderStatus(order.id, 'pending_accept');
      showToast('支付成功！');
      setLoading(false);
    }, 500);
  };

  const handleCancel = (orderId: string) => {
    updateOrderStatus(orderId, 'refund');
    showToast('订单已取消');
  };

  const handleReplicate = (orderId: string) => {
    const newOrder = replicateOrder(orderId);
    if (newOrder) {
      showToast('订单已复制，去支付吧！');
      setActiveTab('pending_payment');
    }
  };

  const renderOrderCard = (order: Order) => {
    const statusColor = getStatusColor(order.status);

    return (
      <div
        key={order.id}
        className="order-card"
        onClick={() => navigate(`/orders/${order.id}`)}
      >
        <div className="header">
          <span className="order-no">订单号: {order.orderNo}</span>
          <span className="status" style={{ color: statusColor }}>
            {getStatusText(order.status)}
          </span>
        </div>

        <div className="content">
          <img
            src={order.dogInfo.avatar}
            alt={order.dogInfo.name}
            className="thumbnail"
          />
          <div className="details">
            <p className="service-name">
              {serviceTypeNameMap[order.serviceType] || order.serviceType}
            </p>
            <p className="time">
              预约时间: {formatDate(order.appointmentTime)}
            </p>
            <p className="feeder">
              喂养师: {order.feederName || '等待匹配'}
            </p>
            <div className="flex gap-2 mt-1">
              {order.serviceItems.slice(0, 3).map((item) => (
                <Tag key={item.id} variant="default">
                  {item.name}
                </Tag>
              ))}
              {order.isUrgent && <Tag variant="danger">加急</Tag>}
            </div>
          </div>
        </div>

        <div className="footer">
          <div>
            {order.status === 'pending_payment' && (
              <span className="text-xs text-secondary">请在15分钟内完成支付</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="price">¥{order.totalAmount}</span>
            <div className="actions" onClick={(e) => e.stopPropagation()}>
              {order.status === 'pending_payment' && (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCancel(order.id)}
                  >
                    取消
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handlePay(order)}
                    disabled={loading}
                  >
                    {loading ? '支付中' : '去支付'}
                  </button>
                </>
              )}
              {order.status === 'completed' && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleReplicate(order.id)}
                >
                  再来一单
                </button>
              )}
              {order.status === 'pending_accept' && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleCancel(order.id)}
                >
                  取消订单
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>我的订单</h1>
      </div>

      <div className="tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div style={{ paddingBottom: 100 }}>
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon="📋"
            title="暂无订单"
            desc="快去预约服务吧"
            action={
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/booking')}
              >
                去预约
              </button>
            }
          />
        ) : (
          filteredOrders.map(renderOrderCard)
        )}
      </div>

      <BottomTabBar />
    </div>
  );
};

export default OrdersPage;
