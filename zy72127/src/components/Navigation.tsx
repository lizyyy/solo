import { NavLink } from 'react-router-dom';
import { Upload, GitCompare, MessageSquare, Download, Waves } from 'lucide-react';
import { usePresetStore } from '@/store/presetStore';

const navItems = [
  { path: '/', label: '预设导入', icon: Upload },
  { path: '/compare', label: '差异比对', icon: GitCompare },
  { path: '/annotate', label: '批注管理', icon: MessageSquare },
  { path: '/export', label: '导出中心', icon: Download },
];

export function Navigation() {
  const { currentOperator, presets, comparisons } = usePresetStore();

  return (
    <nav className="bg-synth-surface/80 backdrop-blur-md border-b border-synth-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-accent-neon to-primary-500 rounded-lg shadow-neon">
              <Waves className="w-6 h-6 text-synth-bg" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-synth-text">合成器预设比对</h1>
              <p className="text-xs text-synth-muted">Synth Preset Diff Tool</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-neon/20 text-accent-neon shadow-neon'
                    : 'text-synth-muted hover:text-synth-text hover:bg-synth-card'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
        </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-synth-muted">当前操作人</div>
              <div className="text-sm font-medium text-accent-neon">{currentOperator}</div>
            </div>
            <div className="h-8 w-px bg-synth-border" />
            <div className="text-center">
              <div className="text-sm text-synth-muted">预设</div>
              <div className="text-lg font-bold text-synth-text">{presets.length}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-synth-muted">比对</div>
              <div className="text-lg font-bold text-synth-text">{comparisons.length}</div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
