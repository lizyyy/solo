import { useNavigate } from 'react-router-dom';
import BottomTabBar from '../components/BottomTabBar';
import { useAppStore } from '../store/appStore';
import { sampleCoupons } from '../data/mockData';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { wallet, orders, favorites, dogs, addresses } = useAppStore();

  const menuItems = [
    {
      icon: '🐕',
      title: '狗狗档案',
      subtitle: dogs.length > 0 ? `${dogs.length}只狗狗` : '添加狗狗',
      path: '/profile/dogs',
    },
    {
      icon: '📍',
      title: '收货地址',
      subtitle: addresses.length > 0 ? `${addresses.length}个地址` : '添加地址',
      path: '/profile/addresses',
    },
    {
      icon: '💰',
      title: '我的钱包',
      subtitle: `余额 ¥${wallet.balance}`,
      path: '/profile/wallet',
    },
    {
      icon: '🎫',
      title: '优惠券',
      subtitle: `${sampleCoupons.filter((c) => !c.isUsed).length}张可用`,
      path: '/profile/coupons',
    },
    {
      icon: '⭐',
      title: '我的收藏',
      subtitle: `${favorites.length}位喂养师`,
      path: '/profile/favorites',
    },
    {
      icon: '📝',
      title: '我的评价',
      subtitle: '查看历史评价',
      path: '/profile/reviews',
    },
    {
      icon: '📞',
      title: '在线客服',
      subtitle: '7*24小时在线',
      path: '/profile/chat',
    },
    {
      icon: '⚠️',
      title: '投诉举报',
      subtitle: '问题反馈',
      path: '/profile/report',
    },
  ];

  const completedOrders = orders.filter((o) => o.status === 'completed').length;

  return (
    <div className="page-container">
      <div className="profile-header">
        <div className="user-info">
          <div className="avatar">👤</div>
          <div>
            <p className="name">宠喂用户</p>
            <p className="phone">138****8000</p>
          </div>
        </div>

        <div className="wallet-row">
          <div className="item">
            <p className="value">{wallet.balance}</p>
            <p className="label">余额(元)</p>
          </div>
          <div className="item">
            <p className="value">{wallet.points}</p>
            <p className="label">积分</p>
          </div>
          <div className="item">
            <p className="value">{completedOrders}</p>
            <p className="label">已完成</p>
          </div>
          <div className="item">
            <p className="value">{sampleCoupons.filter((c) => !c.isUsed).length}</p>
            <p className="label">优惠券</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="flex justify-around">
          {[
            { label: '待付款', count: orders.filter((o) => o.status === 'pending_payment').length, path: '/orders?tab=pending_payment' },
            { label: '待接单', count: orders.filter((o) => o.status === 'pending_accept').length, path: '/orders?tab=pending_accept' },
            { label: '进行中', count: orders.filter((o) => o.status === 'in_progress').length, path: '/orders?tab=in_progress' },
            { label: '已完成', count: completedOrders, path: '/orders?tab=completed' },
          ].map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(item.path)}
            >
              <span
                className="text-xl font-semibold"
                style={{ color: item.count > 0 ? '#FF6B35' : '#1D1D1F' }}
              >
                {item.count}
              </span>
              <span className="text-xs text-secondary mt-1">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="menu-list">
        {menuItems.map((item, index) => (
          <div
            key={index}
            className="menu-item"
            onClick={() => navigate(item.path)}
          >
            <span className="icon">{item.icon}</span>
            <span className="text">{item.title}</span>
            <span className="text-xs text-secondary">{item.subtitle}</span>
            <span className="arrow">›</span>
          </div>
        ))}
      </div>

      <div style={{ height: 100 }} />

      <BottomTabBar />
    </div>
  );
};

export default ProfilePage;
