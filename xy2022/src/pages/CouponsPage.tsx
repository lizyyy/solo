import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, EmptyState, Tag } from '../components/UI';
import { useToast } from '../components/Toast';
import { useAppStore } from '../store/appStore';
import { sampleCoupons } from '../data/mockData';

const CouponsPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { coupons } = useAppStore();

  const [activeTab, setActiveTab] = useState<'available' | 'used' | 'expired'>('available');

  const allCoupons = [...coupons, ...sampleCoupons];

  const availableCoupons = allCoupons.filter(
    (c) => !c.isUsed && new Date(c.expireTime) > new Date()
  );
  const usedCoupons = allCoupons.filter((c) => c.isUsed);
  const expiredCoupons = allCoupons.filter(
    (c) => !c.isUsed && new Date(c.expireTime) <= new Date()
  );

  const displayCoupons =
    activeTab === 'available'
      ? availableCoupons
      : activeTab === 'used'
      ? usedCoupons
      : expiredCoupons;

  const handleUseCoupon = (_couponId: string) => {
    navigate('/booking');
    showToast('前往预约使用优惠券');
  };

  return (
    <div className="page-container" style={{ paddingBottom: 100 }}>
      <Header title="我的优惠券" />

      <div className="tabs">
        <div
          className={`tab ${activeTab === 'available' ? 'active' : ''}`}
          onClick={() => setActiveTab('available')}
        >
          可用 ({availableCoupons.length})
        </div>
        <div
          className={`tab ${activeTab === 'used' ? 'active' : ''}`}
          onClick={() => setActiveTab('used')}
        >
          已使用 ({usedCoupons.length})
        </div>
        <div
          className={`tab ${activeTab === 'expired' ? 'active' : ''}`}
          onClick={() => setActiveTab('expired')}
        >
          已过期 ({expiredCoupons.length})
        </div>
      </div>

      {displayCoupons.length === 0 ? (
        <EmptyState
          icon="🎫"
          title={
            activeTab === 'available'
              ? '暂无可用优惠券'
              : activeTab === 'used'
              ? '暂无已使用优惠券'
              : '暂无已过期优惠券'
          }
          desc={activeTab === 'available' ? '关注平台活动，获取更多优惠' : ''}
          action={
            activeTab === 'available' ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/')}
              >
                去首页
              </button>
            ) : undefined
          }
        />
      ) : (
        displayCoupons.map((coupon) => (
          <div
            key={coupon.id}
            className={`coupon-card ${
              activeTab !== 'available' ? 'used' : ''
            }`}
          >
            <div className="discount-side">
              <span className="amount">¥{coupon.discount}</span>
              <span className="unit">优惠券</span>
            </div>
            <div className="info-side">
              <p className="name">{coupon.name}</p>
              <p className="condition">
                {coupon.minAmount > 0
                  ? `满${coupon.minAmount}元可用`
                  : '无门槛'}
              </p>
              <p className="expire">有效期至 {coupon.expireTime}</p>
              {activeTab === 'available' && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 8, width: 'auto', padding: '6px 16px' }}
                  onClick={() => handleUseCoupon(coupon.id)}
                >
                  立即使用
                </button>
              )}
              {activeTab === 'used' && (
                <Tag variant="default" style={{ marginTop: 8 }}>
                  已使用
                </Tag>
              )}
              {activeTab === 'expired' && (
                <Tag variant="danger" style={{ marginTop: 8 }}>
                  已过期
                </Tag>
              )}
            </div>
          </div>
        ))
      )}

      <h2 className="section-title">优惠券说明</h2>
      <div className="card">
        <p className="text-sm text-secondary">
          1. 优惠券不可叠加使用，每笔订单仅限使用一张
        </p>
        <p className="text-sm text-secondary mt-2">
          2. 优惠券需在有效期内使用，过期作废
        </p>
        <p className="text-sm text-secondary mt-2">
          3. 使用优惠券的订单如需退款，优惠券不予返还
        </p>
        <p className="text-sm text-secondary mt-2">
          4. 平台拥有最终解释权
        </p>
      </div>
    </div>
  );
};

export default CouponsPage;
