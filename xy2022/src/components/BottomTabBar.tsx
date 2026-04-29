import { useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  { id: 'home', icon: '🏠', label: '首页', path: '/' },
  { id: 'order', icon: '📋', label: '订单', path: '/orders' },
  { id: 'book', icon: '➕', label: '预约', path: '/booking' },
  { id: 'profile', icon: '👤', label: '我的', path: '/profile' },
];

const BottomTabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="bottom-tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item ${isActive(tab.path) ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <span className="icon">{tab.icon}</span>
          <span className="label">{tab.label}</span>
        </div>
      ))}
    </div>
  );
};

export default BottomTabBar;
