import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, BookOpen, Wind, User } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: '首页',
    icon: <Home size={24} />
  },
  {
    path: '/healing-square',
    label: '疗愈广场',
    icon: <Users size={24} />
  },
  {
    path: '/diary',
    label: '记录日记',
    icon: <BookOpen size={24} />
  },
  {
    path: '/meditation',
    label: '冥想',
    icon: <Wind size={24} />
  },
  {
    path: '/profile',
    label: '我的',
    icon: <User size={24} />
  }
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <div
          key={item.path}
          className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          {item.icon}
          <span>{item.label}</span>
        </div>
      ))}
    </nav>
  );
}
