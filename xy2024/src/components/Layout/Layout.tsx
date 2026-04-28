import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useUser, useTheme } from '../../context/AppContext';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '题库', icon: '📚' },
  { path: '/review', label: '复习计划', icon: '📅' },
  { path: '/mindmap', label: '思维导图', icon: '🌳' },
  { path: '/profile', label: '个人中心', icon: '👤' },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useUser();
  const { theme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">🌳</span>
            <span>年轮记忆</span>
          </div>
        </div>
        <div className="header-right">
          <div className="streak-badge">
            <span className="fire-icon">🔥</span>
            <span>连续学习 {user.streakDays} 天</span>
          </div>
          <div className="user-info" onClick={() => navigate('/profile')}>
            <div className="user-avatar">
              {user.name.charAt(0)}
            </div>
            <span>{user.name}</span>
          </div>
        </div>
      </header>
      
      <div className="main-container">
        <aside className="sidebar">
          <nav>
            <ul className="nav-menu">
              {navItems.map((item) => (
                <li key={item.path} className="nav-item">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => 
                      `nav-link ${isActive ? 'active' : ''}`
                    }
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
};
