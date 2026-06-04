import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { AlertTriangle, Upload, GitCompare, Workflow, History, Activity } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const navItems = [
  { to: '/', label: '报警总览', icon: Activity },
  { to: '/import', label: '数据导入与自检', icon: Upload },
  { to: '/conflicts', label: '冲突裁定', icon: GitCompare },
  { to: '/workflow', label: '工作流追踪', icon: Workflow },
  { to: '/history', label: '历史记录', icon: History },
];

export default function Layout() {
  const location = useLocation();
  const pendingCount = useAppStore((s) => s.getPendingConflictsCount());

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#0d0d1a',
        color: '#e0e0e0',
        fontFamily: '"Noto Sans SC", sans-serif',
      }}
    >
      <aside
        style={{
          width: 240,
          minWidth: 240,
          background: '#12122a',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '20px 20px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <AlertTriangle size={22} color="#e94560" />
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#f0f0f0',
              letterSpacing: 0.5,
            }}
          >
            鲁棒中位数报警系统
          </span>
        </div>

        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive =
              to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 20px',
                  textDecoration: 'none',
                  color: isActive ? '#f0f0f0' : '#8888a8',
                  background: isActive ? 'rgba(233,69,96,0.08)' : 'transparent',
                  borderLeft: isActive ? '3px solid #e94560' : '3px solid transparent',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <Icon size={18} color={isActive ? '#e94560' : '#8888a8'} />
                <span>{label}</span>
                {to === '/conflicts' && pendingCount > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      background: '#e94560',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: '"JetBrains Mono", monospace',
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 6px',
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11,
            color: '#555570',
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          v1.0.0
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 32,
          background: '#0d0d1a',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
