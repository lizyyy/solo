import { Link, useLocation } from 'react-router-dom';
import { LayoutList, FileDown, Users, RotateCcw } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import type { UserRole } from '../types';

const ROLES: { role: UserRole; label: string; name: string }[] = [
  { role: 'exhibit_engineer', label: '布展工程师', name: '张伟' },
  { role: 'project_lead', label: '工程负责人', name: '李强' },
  { role: 'docent', label: '讲解员', name: '王芳' },
];

const NAV_ITEMS = [
  { to: '/', label: '记录总览', icon: LayoutList },
  { to: '/export', label: '巡检单导出', icon: FileDown },
];

export default function Sidebar() {
  const location = useLocation();
  const { currentUser, currentUserName, setCurrentUser, resetData } = useRecordStore();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-64 h-screen flex flex-col" style={{ backgroundColor: '#1a3a2a' }}>
      <div className="px-5 py-6 border-b" style={{ borderColor: '#2a5a3a' }}>
        <h1 className="text-xl font-bold" style={{ color: '#f5f0e8' }}>
          文物展柜摆位
        </h1>
      </div>

      <nav className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: isActive(to) ? '#c48a5a' : '#f5f0e8',
                backgroundColor: isActive(to) ? 'rgba(196,138,90,0.15)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive(to)) e.currentTarget.style.color = '#c48a5a';
              }}
              onMouseLeave={(e) => {
                if (!isActive(to)) e.currentTarget.style.color = '#f5f0e8';
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t" style={{ borderColor: '#2a5a3a' }}>
          <div className="flex items-center gap-2 px-3 mb-3">
            <Users size={16} style={{ color: '#c48a5a' }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#8aaa9a' }}>
              角色切换
            </span>
          </div>

          <div className="px-3 mb-3">
            <p className="text-sm" style={{ color: '#f5f0e8' }}>
              {currentUserName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#8aaa9a' }}>
              {ROLES.find((r) => r.role === currentUser)?.label}
            </p>
          </div>

          <div className="space-y-1">
            {ROLES.map(({ role, label }) => (
              <button
                key={role}
                onClick={() => setCurrentUser(role, ROLES.find((r) => r.role === role)!.name)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  color: currentUser === role ? '#c48a5a' : '#f5f0e8',
                  backgroundColor: currentUser === role ? 'rgba(196,138,90,0.15)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (currentUser !== role) e.currentTarget.style.backgroundColor = 'rgba(196,138,90,0.08)';
                }}
                onMouseLeave={(e) => {
                  if (currentUser !== role) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="px-3 pb-5">
        <button
          onClick={resetData}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: '#f5f0e8', backgroundColor: '#2a5a3a' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#3a6a4a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#2a5a3a';
          }}
        >
          <RotateCcw size={16} />
          重置数据
        </button>
      </div>
    </aside>
  );
}
