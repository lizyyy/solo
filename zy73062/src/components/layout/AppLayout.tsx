import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Factory, ChevronDown } from 'lucide-react';
import { useScheduleStore } from '@/store/useScheduleStore';

const roles = ['维保主管', '巡检员', '接手同事'] as const;
type Role = typeof roles[number];

interface NavItem {
  label: string;
  to: string;
  requireBizKey?: boolean;
}

const navItems: NavItem[] = [
  { label: '排程列表', to: '/schedule' },
  { label: '排程详情', to: '', requireBizKey: true },
  { label: '巡检试跑', to: '/trial' },
  { label: '交接视图', to: '/handover' },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const selectedBizKey = useScheduleStore((s) => s.selectedBizKey);
  const [role, setRole] = useState<Role>('维保主管');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.requireBizKey) {
      if (selectedBizKey) {
        e.preventDefault();
        navigate(`/schedule/${selectedBizKey}`);
      } else {
        e.preventDefault();
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
                <Factory className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <span className="text-lg font-bold text-gray-900 whitespace-nowrap">
                工厂管线备件排程系统
              </span>
            </div>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isDisabled = item.requireBizKey && !selectedBizKey;
                const isActive = item.requireBizKey
                  ? selectedBizKey !== null
                  : undefined;

                return (
                  <NavLink
                    key={item.label}
                    to={isDisabled ? '#' : (item.to || '/schedule')}
                    onClick={(e) => handleNavClick(item, e)}
                    className={({ isActive: navActive }) => {
                      const active = item.requireBizKey ? isActive : navActive;
                      if (isDisabled) {
                        return 'relative px-4 py-2 text-sm text-gray-400 cursor-not-allowed select-none';
                      }
                      return active
                        ? 'relative px-4 py-2 text-sm font-bold text-primary-600'
                        : 'relative px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors';
                    }}
                    title={isDisabled ? '请先在排程列表中选择一条记录' : undefined}
                  >
                    {({ isActive: navActive }) => {
                      const active = item.requireBizKey ? isActive : navActive;
                      return (
                        <>
                          {item.label}
                          {!isDisabled && (
                            <span
                              className={`absolute bottom-0 left-2 right-2 h-0.5 bg-primary-600 rounded-full transition-all duration-200 ${
                                active ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                          )}
                        </>
                      );
                    }}
                  </NavLink>
                );
              })}
            </nav>

            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                <span>{role}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-card border border-gray-100 py-1 z-50">
                  {roles.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setRole(r);
                        setRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        role === r
                          ? 'text-primary-600 bg-primary-50 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
