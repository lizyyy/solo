import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomTabBar from '../components/BottomTabBar';
import { Rating, Tag } from '../components/UI';
import {
  serviceTypes,
  priceList,
  feeders,
  announcements,
  sampleReviews,
} from '../data/mockData';
import { useAppStore } from '../store/appStore';
import type { Feeder } from '../types';

const HomePage = () => {
  const navigate = useNavigate();
  const { orders, favorites, toggleFavorite } = useAppStore();
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [selectedFeeder, setSelectedFeeder] = useState<Feeder | null>(null);

  const handleServiceClick = (serviceId: string) => {
    navigate(`/booking?service=${serviceId}`);
  };

  const handleFeederFavorite = (feederId: string) => {
    toggleFavorite(feederId);
  };

  const handleFeederDetail = (feeder: Feeder) => {
    setSelectedFeeder(feeder);
  };

  const pendingOrders = orders.filter(
    (o) => o.status !== 'completed' && o.status !== 'refund'
  );

  const serviceTypeNameMap: Record<string, string> = {
    feeding: '上门喂狗',
    walking: '上门遛狗',
    boarding: '寄养服务',
    bathing: '洗澡服务',
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 style={{ marginBottom: 4 }}>🐕 宠喂上门</h1>
            <p className="text-sm text-secondary">
              📍 深圳市南山区 · 附近 {feeders.filter((f) => f.available).length} 位喂养师在线
            </p>
          </div>
          <div className="relative">
            <span style={{ fontSize: 28 }}>🔔</span>
            {pendingOrders.length > 0 && (
              <span className="badge" style={{ position: 'absolute', top: -4, right: -4 }}>
                {pendingOrders.length}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="banner">
        <div className="content">
          <p className="title">新用户专享</p>
          <p className="subtitle">首单立减20元，扫码立领</p>
        </div>
        <span className="dog-icon">🐶</span>
      </div>

      <div
        className="announcement-bar"
        onClick={() => setShowAnnouncements(true)}
      >
        <span className="icon">📢</span>
        <span className="text">{announcements[0]?.title || '暂无公告'}</span>
        <span>›</span>
      </div>

      <h2 className="section-title">一键下单</h2>
      <div className="service-grid">
        {serviceTypes.map((service) => (
          <div
            key={service.id}
            className="service-item"
            onClick={() => handleServiceClick(service.id)}
          >
            <div className="icon-wrapper">
              <span className="icon">{service.icon}</span>
            </div>
            <span className="name">{service.name}</span>
            <span
              className="text-xs"
              style={{ color: '#FF6B35', marginTop: 2 }}
            >
              ¥{service.basePrice}起
            </span>
          </div>
        ))}
      </div>

      <h2 className="section-title">服务价目表</h2>
      <div className="card">
        {priceList.map((item, index) => (
          <div key={item.id}>
            <div className="price-row">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#FFF0EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {
                    serviceTypes.find((s) => s.id === item.serviceId)
                      ?.icon
                  }
                </span>
                <div>
                  <p className="font-medium">{item.serviceName}</p>
                  <p className="text-xs text-secondary">
                    距离费: 超出1km后 +{item.distanceFee}元/km
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-orange">
                  ¥{item.basePrice}/{item.unit}
                </p>
                {item.urgentFee > 0 && (
                  <p className="text-xs text-secondary">
                    加急 +{item.urgentFee}元
                  </p>
                )}
              </div>
            </div>
            {index < priceList.length - 1 && <div className="divider" />}
          </div>
        ))}
      </div>

      <h2 className="section-title">附近喂养师</h2>
      <div className="swiper" style={{ paddingBottom: 8 }}>
        {feeders.map((feeder) => (
          <div
            key={feeder.id}
            className="feeder-card"
            style={{ cursor: 'pointer' }}
            onClick={() => handleFeederDetail(feeder)}
          >
            <div className="avatar-wrap">
              <img
                src={feeder.avatar}
                alt={feeder.name}
                className="avatar"
                style={{ width: 56, height: 56 }}
              />
              <span
                className={`status-dot ${feeder.available ? '' : 'offline'}`}
              />
            </div>
            <div className="info">
              <div className="name-row">
                <span className="name">{feeder.name}</span>
                <span className="exp">{feeder.experience}年经验</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFeederFavorite(feeder.id);
                  }}
                  style={{ fontSize: 20, cursor: 'pointer' }}
                >
                  {favorites.includes(feeder.id) ? '❤️' : '🤍'}
                </span>
              </div>
              <Rating value={feeder.rating} count={feeder.reviewCount} />
              <div className="meta" style={{ marginTop: 4 }}>
                <span className="distance">📍 {feeder.distance}km</span>
                <span className="orders">✅ 完成{feeder.completedOrders}单</span>
              </div>
              <div className="tags">
                {feeder.services.map((sid) => (
                  <Tag key={sid} variant="primary">
                    {serviceTypeNameMap[sid] || sid}
                  </Tag>
                ))}
                {!feeder.available && <Tag variant="default">休息中</Tag>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-title">公告说明</h2>
      {announcements.map((ann) => (
        <div key={ann.id} className="card">
          <div className="flex items-center gap-2 mb-2">
            <Tag
              variant={
                ann.type === 'holiday'
                  ? 'warning'
                  : ann.type === 'restriction'
                  ? 'danger'
                  : 'info'
              }
            >
              {ann.type === 'holiday'
                ? '节假日'
                : ann.type === 'restriction'
                ? '禁养品种'
                : '服务范围'}
            </Tag>
            <span className="text-xs text-tertiary">{ann.createTime}</span>
          </div>
          <h3 className="font-medium mb-1">{ann.title}</h3>
          <p className="text-sm text-secondary">{ann.content}</p>
        </div>
      ))}

      <div style={{ height: 100 }} />

      {showAnnouncements && (
        <div className="modal-overlay" onClick={() => setShowAnnouncements(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>公告说明</h3>
              <button className="modal-close" onClick={() => setShowAnnouncements(false)}>✕</button>
            </div>
            {announcements.map((ann) => (
              <div key={ann.id} className="card mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Tag
                    variant={
                      ann.type === 'holiday'
                        ? 'warning'
                        : ann.type === 'restriction'
                        ? 'danger'
                        : 'info'
                    }
                  >
                    {ann.type === 'holiday'
                      ? '节假日'
                      : ann.type === 'restriction'
                      ? '禁养品种'
                      : '服务范围'}
                  </Tag>
                  <span className="text-xs text-tertiary">{ann.createTime}</span>
                </div>
                <h3 className="font-medium mb-1">{ann.title}</h3>
                <p className="text-sm text-secondary">{ann.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedFeeder && (
        <div className="modal-overlay" onClick={() => setSelectedFeeder(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <h3>喂养师详情</h3>
              <button className="modal-close" onClick={() => setSelectedFeeder(null)}>✕</button>
            </div>

            <div className="text-center mb-4">
              <img
                src={selectedFeeder.avatar}
                alt={selectedFeeder.name}
                className="avatar avatar-lg"
                style={{ width: 80, height: 80, margin: '0 auto' }}
              />
              <h3 className="font-semibold mt-3 text-lg">{selectedFeeder.name}</h3>
              <div className="flex justify-center items-center gap-2 mt-2">
                <Rating value={selectedFeeder.rating} count={selectedFeeder.reviewCount} />
              </div>
              <p className="text-sm text-secondary mt-2">
                {selectedFeeder.experience}年经验 · 距离{selectedFeeder.distance}km
              </p>
              <div className="flex justify-center gap-2 mt-3">
                <Tag variant={selectedFeeder.available ? 'primary' : 'default'}>
                  {selectedFeeder.available ? '在线接单' : '休息中'}
                </Tag>
                <Tag variant="info">完成{selectedFeeder.completedOrders}单</Tag>
              </div>
            </div>

            <div className="divider" />

            <h4 className="font-semibold mb-3">服务项目</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedFeeder.services.map((sid) => (
                <Tag key={sid} variant="primary">
                  {serviceTypeNameMap[sid] || sid}
                </Tag>
              ))}
            </div>

            <div className="divider" />

            <h4 className="font-semibold mb-3">用户评价</h4>
            {sampleReviews.filter((r) => r.feederId === selectedFeeder.id).length > 0 ? (
              sampleReviews
                .filter((r) => r.feederId === selectedFeeder.id)
                .map((review) => (
                  <div key={review.id} className="card mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <Rating value={review.rating} />
                      <span className="text-xs text-tertiary">{review.createTime}</span>
                    </div>
                    <p className="text-sm text-secondary">{review.content}</p>
                  </div>
                ))
            ) : (
              <p className="text-center text-secondary py-4 text-sm">暂无评价</p>
            )}

            <div className="mt-4">
              <button
                className="btn btn-primary btn-full"
                onClick={() => {
                  setSelectedFeeder(null);
                  navigate(`/booking?feeder=${selectedFeeder.id}`);
                }}
              >
                预约{selectedFeeder.name}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomTabBar />
    </div>
  );
};

export default HomePage;
