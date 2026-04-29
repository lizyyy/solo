import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header, Rating, Tag, PriceBreakdown } from '../components/UI';
import { useToast } from '../components/Toast';
import { useAppStore } from '../store/appStore';
import {
  getStatusText,
  getStatusColor,
  feeders,
} from '../data/mockData';

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { orders, updateOrderStatus, replicateOrder, addOrderReview } = useAppStore();

  const order = orders.find((o) => o.id === id);
  const feeder = feeders.find((f) => f.id === order?.feederId);

  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

  const serviceTypeNameMap: Record<string, string> = {
    feeding: '上门喂狗',
    walking: '上门遛狗',
    boarding: '寄养服务',
    bathing: '洗澡服务',
  };

  useEffect(() => {
    if (order?.status === 'pending_accept' || order?.status === 'in_progress') {
      const appointmentTime = new Date(order.appointmentTime);
      const now = new Date();
      const diff = appointmentTime.getTime() - now.getTime();

      if (diff > 0) {
        const updateCountdown = () => {
          const now = new Date();
          const diff = appointmentTime.getTime() - now.getTime();

          if (diff <= 0) {
            setCountdown({ hours: 0, minutes: 0, seconds: 0 });
            return;
          }

          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);

          setCountdown({ hours, minutes, seconds });
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
      }
    }
  }, [order]);

  if (!order) {
    return (
      <div className="page-container">
        <Header title="订单详情" />
        <div className="empty-state">
          <span className="icon">❓</span>
          <p className="title">订单不存在</p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/orders')}
          >
            返回订单列表
          </button>
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor(order.status);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(
      date.getHours()
    ).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getTimeline = () => {
    const items: { time: string; title: string; desc?: string; active: boolean }[] = [];

    items.push({
      time: formatDate(order.createTime),
      title: '订单创建成功',
      desc: order.status === 'pending_payment' ? '等待支付' : '已支付',
      active: true,
    });

    if (order.status !== 'pending_payment') {
      items.push({
        time: order.status !== 'pending_accept' ? formatDate(order.createTime) : '',
        title: '支付成功',
        desc: '等待喂养师接单',
        active: true,
      });
    }

    if (order.status === 'in_progress' || order.status === 'completed' || order.status === 'refund') {
      items.push({
        time: order.checkInTime ? formatDate(order.checkInTime) : '',
        title: '喂养师已接单',
        desc: '上门服务中',
        active: order.status === 'in_progress' || order.status === 'completed',
      });
    }

    if (order.checkInTime && (order.status === 'in_progress' || order.status === 'completed')) {
      items.push({
        time: formatDate(order.checkInTime),
        title: '喂养师已签到',
        desc: '开始服务',
        active: order.status === 'in_progress' || order.status === 'completed',
      });
    }

    if (order.checkOutTime) {
      items.push({
        time: formatDate(order.checkOutTime),
        title: '服务完成',
        desc: '喂养师已完成服务',
        active: order.status === 'completed',
      });
    }

    return items;
  };

  const handleCheckIn = () => {
    updateOrderStatus(order.id, 'in_progress');
    showToast('喂养师已签到，服务开始！');
  };

  const handleCheckOut = () => {
    updateOrderStatus(order.id, 'completed');
    showToast('服务已完成！');
  };

  const handlePay = () => {
    updateOrderStatus(order.id, 'pending_accept');
    showToast('支付成功！');
  };

  const handleCancel = () => {
    updateOrderStatus(order.id, 'refund');
    showToast('订单已取消，退款中...');
  };

  const handleReplicate = () => {
    const newOrder = replicateOrder(order.id);
    if (newOrder) {
      showToast('订单已复制！');
      navigate(`/orders/${newOrder.id}`);
    }
  };

  const handleSubmitReview = () => {
    if (!reviewContent.trim()) {
      showToast('请填写评价内容');
      return;
    }
    if (!order) {
      showToast('订单不存在');
      return;
    }
    addOrderReview(order.id, {
      rating: reviewRating,
      content: reviewContent,
      feederId: order.feederId,
    });
    showToast('评价提交成功！');
    setShowReviewForm(false);
    setReviewContent('');
    setReviewRating(5);
  };

  return (
    <div className="page-container" style={{ paddingBottom: 140 }}>
      <Header title="订单详情" />

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-secondary">订单状态</p>
            <p className="font-semibold text-lg" style={{ color: statusColor }}>
              {getStatusText(order.status)}
            </p>
          </div>
          <img
            src={feeder?.avatar || order.feederAvatar}
            alt={feeder?.name || order.feederName}
            className="avatar avatar-lg"
          />
        </div>

        {feeder && (
          <div className="flex items-center gap-3 p-3 bg-gray rounded-lg">
            <img
              src={feeder.avatar}
              alt={feeder.name}
              className="avatar avatar-sm"
            />
            <div className="flex-1">
              <p className="font-medium">{feeder.name}</p>
              <Rating value={feeder.rating} count={feeder.reviewCount} />
            </div>
            <button 
              className="btn btn-outline btn-sm"
              onClick={() => showToast(`正在联系 ${feeder.name}...`)}
            >
              联系
            </button>
          </div>
        )}
      </div>

      {order.status === 'pending_accept' && (
        <div className="countdown">
          <div className="time-block">
            <span className="time-value">
              {String(countdown.hours).padStart(2, '0')}
            </span>
            <span className="time-label">时</span>
          </div>
          <span className="separator">:</span>
          <div className="time-block">
            <span className="time-value">
              {String(countdown.minutes).padStart(2, '0')}
            </span>
            <span className="time-label">分</span>
          </div>
          <span className="separator">:</span>
          <div className="time-block">
            <span className="time-value">
              {String(countdown.seconds).padStart(2, '0')}
            </span>
            <span className="time-label">秒</span>
          </div>
        </div>
      )}

      {order.status === 'in_progress' && (
        <div className="location-map">
          <div className="pulse" style={{ left: '40%', top: '45%' }} />
          <div className="pulse" style={{ left: '60%', top: '55%' }} />
          <div className="placeholder text-center">
            <p>📍 喂养师正在前往</p>
            <p className="text-xs mt-1">预计 5 分钟后到达</p>
          </div>
        </div>
      )}

      {(order.photos.length > 0 || order.videos.length > 0) && (
        <>
          <h2 className="section-title">服务记录</h2>
          <div className="gallery">
            {order.videos.map((_video, index) => (
              <div key={`video-${index}`} className="gallery-item video">
                <img
                  src={`https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=dog%20service%20video%20thumbnail%20happy%20dog&image_size=square`}
                  alt={`视频${index + 1}`}
                />
              </div>
            ))}
            {order.photos.map((photo, index) => (
              <div key={`photo-${index}`} className="gallery-item">
                <img src={photo} alt={`照片${index + 1}`} />
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">订单进度</h2>
      <div className="card">
        <div className="timeline">
          {getTimeline()
            .reverse()
            .map((item, index) => (
              <div
                key={index}
                className={`timeline-item ${item.active ? 'active' : ''}`}
              >
                {item.time && <p className="time">{item.time}</p>}
                <p className="title">{item.title}</p>
                {item.desc && <p className="desc">{item.desc}</p>}
              </div>
            ))}
        </div>
      </div>

      <h2 className="section-title">狗狗信息</h2>
      <div className="card">
        <div className="flex items-center gap-3">
          <img
            src={order.dogInfo.avatar}
            alt={order.dogInfo.name}
            className="avatar avatar-lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{order.dogInfo.name}</span>
              <Tag variant="info">{order.dogInfo.breed}</Tag>
            </div>
            <p className="text-sm text-secondary mt-1">
              {order.dogInfo.age}岁 · {order.dogInfo.weight}kg ·{' '}
              {order.dogInfo.personality}
            </p>
            {order.dogInfo.isAggressive && (
              <Tag variant="danger" style={{ marginTop: 4 }}>
                需注意安全
              </Tag>
            )}
            {order.dogInfo.dietaryRestrictions && (
              <p className="text-xs text-tertiary mt-1">
                忌口: {order.dogInfo.dietaryRestrictions}
              </p>
            )}
          </div>
        </div>
      </div>

      <h2 className="section-title">服务信息</h2>
      <div className="card">
        <div className="price-row">
          <span className="label">服务类型</span>
          <span className="value font-medium">
            {serviceTypeNameMap[order.serviceType] || order.serviceType}
          </span>
        </div>
        <div className="price-row">
          <span className="label">服务项目</span>
          <span className="value text-sm text-right">
            {order.serviceItems.map((i) => i.name).join('、')}
          </span>
        </div>
        {order.additionalServices.length > 0 && (
          <div className="price-row">
            <span className="label">附加服务</span>
            <span className="value text-sm text-right">
              {order.additionalServices.map((i) => i.name).join('、')}
            </span>
          </div>
        )}
        <div className="price-row">
          <span className="label">预约时间</span>
          <span className="value">{formatDate(order.appointmentTime)}</span>
        </div>
        <div className="price-row">
          <span className="label">服务时长</span>
          <span className="value">{order.duration}次</span>
        </div>
        {order.isUrgent && (
          <div className="price-row">
            <span className="label">加急服务</span>
            <Tag variant="danger">是</Tag>
          </div>
        )}
        {order.specialNotes && (
          <div className="price-row">
            <span className="label">特殊备注</span>
            <span className="value text-sm text-right">{order.specialNotes}</span>
          </div>
        )}
      </div>

      <h2 className="section-title">服务地址</h2>
      <div className="card">
        <div className="flex items-start gap-3">
          <div
            className="icon-wrap"
            style={{ width: 36, height: 36, marginTop: 2 }}
          >
            <span className="icon" style={{ fontSize: 16 }}>
              📍
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{order.address.name}</span>
              <span className="text-secondary">{order.address.phone}</span>
            </div>
            <p className="text-sm text-secondary mt-1">
              {order.address.province}
              {order.address.city}
              {order.address.district}
              {order.address.detail}
            </p>
          </div>
        </div>
      </div>

      <h2 className="section-title">费用明细</h2>
      <PriceBreakdown
        items={[
          { label: '基础服务', value: order.totalAmount - 50 },
          { label: '服务项目', value: 30 },
          { label: '其他', value: 20 },
        ]}
        total={order.totalAmount}
      />

      <div className="card">
        <p className="text-sm text-secondary">订单编号: {order.orderNo}</p>
        <p className="text-sm text-secondary mt-1">
          创建时间: {formatDate(order.createTime)}
        </p>
      </div>

      {order.review && (
        <>
          <h2 className="section-title">我的评价</h2>
          <div className="card">
            <Rating value={order.review.rating} />
            <p className="text-sm mt-2">{order.review.content}</p>
            <p className="text-xs text-tertiary mt-2">
              {formatDate(order.review.createTime)}
            </p>
          </div>
        </>
      )}

      {showReviewForm && (
        <div
          className="modal-overlay"
          onClick={() => setShowReviewForm(false)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>发表评价</h3>
              <button
                className="modal-close"
                onClick={() => setShowReviewForm(false)}
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-secondary mb-3">综合评分</p>
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star ${star <= reviewRating ? 'filled' : ''}`}
                  onClick={() => setReviewRating(star)}
                >
                  ★
                </span>
              ))}
            </div>

            <div className="review-input" style={{ margin: '16px 0' }}>
              <textarea
                placeholder="分享您的服务体验..."
                value={reviewContent}
                onChange={(e) => setReviewContent(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={handleSubmitReview}
            >
              提交评价
            </button>
          </div>
        </div>
      )}

      <div className="bottom-actions">
        <div className="price-info">
          <p className="price-label">订单金额</p>
          <p className="price-value">¥{order.totalAmount}</p>
        </div>

        <div className="flex gap-2">
          {order.status === 'pending_payment' && (
            <>
              <button className="btn btn-secondary" onClick={handleCancel}>
                取消订单
              </button>
              <button className="btn btn-primary" onClick={handlePay}>
                去支付
              </button>
            </>
          )}

          {order.status === 'pending_accept' && (
            <button className="btn btn-secondary" onClick={handleCancel}>
              取消订单
            </button>
          )}

          {order.status === 'in_progress' && (
            <>
              {!order.checkInTime && (
                <button className="btn btn-primary" onClick={handleCheckIn}>
                  签到开始
                </button>
              )}
              {order.checkInTime && !order.checkOutTime && (
                <button className="btn btn-primary" onClick={handleCheckOut}>
                  完成服务
                </button>
              )}
            </>
          )}

          {order.status === 'completed' && (
            <>
              {!order.review && (
                <button
                  className="btn btn-outline"
                  onClick={() => setShowReviewForm(true)}
                >
                  去评价
                </button>
              )}
              <button className="btn btn-primary" onClick={handleReplicate}>
                再来一单
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
