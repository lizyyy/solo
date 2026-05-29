import { NavLink, useNavigate } from 'react-router-dom';
import { Film, List, Plus, Download, User, Database, Trash2 } from 'lucide-react';
import { useShotStore } from '@/store/useShotStore';
import { mockUsers } from '@/data/mockData';
import { ROLE_LABELS } from '@/types';
import { useState } from 'react';

export function Header() {
  const { currentUser, setCurrentUser, shots, initializeMockData, clearAllData } = useShotStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: '镜头列表', icon: List },
    { to: '/export', label: '报告导出', icon: Download },
  ];

  const handleAddShot = () => {
    if (shots.length === 0) {
      initializeMockData();
      alert('已加载示例数据！');
      return;
    }
    const shotNumber = prompt('请输入镜头号（格式：S01-E001）：', `S01-E${String(shots.length + 1).padStart(3, '0')}`);
    if (!shotNumber) return;
    const title = prompt('请输入镜头标题：', '新镜头');
    if (!title) return;
    const reason = prompt('请输入创建理由：', '创建新镜头');
    if (!reason) return;

    const result = useShotStore.getState().addShot(
      { shotNumber, title, duration: 5 },
      {},
      reason
    );

    if (result) {
      navigate(`/shot/${result.id}/edit`);
    } else {
      alert('镜头号格式错误或已存在！');
    }
  };

  return (
    <header className="bg-film-panel border-b border-film-border sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-film-primary to-film-secondary rounded-lg flex items-center justify-center">
              <Film className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-film-text-primary group-hover:text-film-primary transition-colors">
                动画分镜版本锁定
              </h1>
              <p className="text-xs text-film-text-muted">Animation Storyboard Version Lock</p>
            </div>
          </NavLink>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-film-primary text-white'
                      : 'text-film-text-secondary hover:text-film-text-primary hover:bg-film-card'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleAddShot}
            className="flex items-center gap-2 px-4 py-2 bg-film-primary hover:bg-film-primary/80 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {shots.length === 0 ? '加载示例数据' : '新建镜头'}
          </button>

          {shots.length > 0 && (
            <button
              onClick={() => {
                if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
                  clearAllData();
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-film-text-muted hover:text-film-danger hover:bg-film-card rounded-lg text-sm transition-colors"
              title="清空数据"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-film-card transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-film-secondary flex items-center justify-center text-lg">
                {currentUser.avatar}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-film-text-primary">{currentUser.name}</p>
                <p className="text-xs text-film-text-muted">{ROLE_LABELS[currentUser.role]}</p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-film-card border border-film-border rounded-lg shadow-xl overflow-hidden">
                <div className="px-4 py-2 border-b border-film-border">
                  <p className="text-xs text-film-text-muted">切换身份</p>
                </div>
                {mockUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setCurrentUser(user);
                      setShowUserMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-film-panel transition-colors ${
                      user.id === currentUser.id ? 'bg-film-secondary/50' : ''
                    }`}
                  >
                    <span className="text-lg">{user.avatar}</span>
                    <div>
                      <p className="text-sm font-medium text-film-text-primary">{user.name}</p>
                      <p className="text-xs text-film-text-muted">{ROLE_LABELS[user.role]}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
