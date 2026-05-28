import { useState } from 'react';
import { Check, ChevronDown, Save, Trash2, Download, Upload, Filter } from 'lucide-react';
import { CLASSES } from '../../data/artworks';
import { useFilterStore } from '../../store/useFilterStore';
import { GlassCard } from '../common/GlassCard';
import { GlowButton } from '../common/GlowButton';
import { Tooltip } from '../common/Tooltip';
import { useFilteredArtworks } from '../../hooks/useFilteredArtworks';

export function ClassFilter() {
  const { selectedClassIds, toggleClass, selectAllClasses, clearAllClasses, savedConfigs, saveFilterConfig, loadFilterConfig, deleteFilterConfig, resetFilters } = useFilterStore();
  const { stats } = useFilteredArtworks();
  const [showPresets, setShowPresets] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');

  const handleSave = () => {
    if (newConfigName.trim()) {
      saveFilterConfig(newConfigName.trim());
      setNewConfigName('');
      setSaveDialogOpen(false);
    }
  };

  const allSelected = selectedClassIds.length === CLASSES.length;

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-medium text-white/90">班级筛选</h3>
        <span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
          {selectedClassIds.length}/{CLASSES.length}
        </span>
        
        <div className="ml-auto flex items-center gap-2">
          <Tooltip content="全选">
            <GlowButton 
              variant="ghost" 
              size="sm"
              onClick={selectAllClasses}
              active={allSelected}
            >
              <Check className="w-3.5 h-3.5" />
            </GlowButton>
          </Tooltip>
          
          <Tooltip content="清除">
            <GlowButton 
              variant="ghost" 
              size="sm"
              onClick={clearAllClasses}
            >
              <Filter className="w-3.5 h-3.5 rotate-180" />
            </GlowButton>
          </Tooltip>
          
          <Tooltip content="保存筛选配置">
            <GlowButton 
              variant="ghost" 
              size="sm"
              onClick={() => setSaveDialogOpen(true)}
            >
              <Save className="w-3.5 h-3.5" />
            </GlowButton>
          </Tooltip>
          
          <div className="relative">
            <Tooltip content="加载配置">
              <GlowButton 
                variant="ghost" 
                size="sm"
                onClick={() => setShowPresets(!showPresets)}
                active={showPresets}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
              </GlowButton>
            </Tooltip>
            
            {showPresets && savedConfigs.length > 0 && (
              <div className="absolute top-full right-0 mt-2 w-64 z-50">
                <GlassCard className="p-2 max-h-64 overflow-y-auto">
                  {savedConfigs.map(config => (
                    <div 
                      key={config.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer group"
                      onClick={() => {
                        loadFilterConfig(config.id);
                        setShowPresets(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/90 truncate">{config.name}</div>
                        <div className="text-xs text-white/40">
                          {new Date(config.savedAt).toLocaleDateString('zh-CN')}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFilterConfig(config.id);
                        }}
                        className="p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  ))}
                </GlassCard>
              </div>
            )}
          </div>
          
          <Tooltip content="重置筛选">
            <GlowButton 
              variant="ghost" 
              size="sm"
              onClick={resetFilters}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </GlowButton>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CLASSES.map(cls => {
          const isSelected = selectedClassIds.includes(cls.id);
          const count = stats.byClass[cls.name] || 0;
          
          return (
            <button
              key={cls.id}
              onClick={() => toggleClass(cls.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? 'border-white/30 bg-white/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div 
                className="w-3 h-3 rounded-full transition-transform group-hover:scale-110"
                style={{ backgroundColor: cls.color }}
              />
              <span className={`text-sm ${isSelected ? 'text-white' : 'text-white/70'}`}>
                {cls.name}
              </span>
              <span className={`text-xs ${isSelected ? 'text-white/60' : 'text-white/40'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {saveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <GlassCard className="p-6 w-96">
            <h3 className="text-lg font-medium text-white mb-4">保存筛选配置</h3>
            <input
              type="text"
              value={newConfigName}
              onChange={(e) => setNewConfigName(e.target.value)}
              placeholder="输入配置名称..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/50 transition-colors mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <div className="flex gap-3 justify-end">
              <GlowButton 
                variant="secondary" 
                size="sm"
                onClick={() => {
                  setSaveDialogOpen(false);
                  setNewConfigName('');
                }}
              >
                取消
              </GlowButton>
              <GlowButton 
                variant="primary" 
                size="sm"
                onClick={handleSave}
                disabled={!newConfigName.trim()}
              >
                <Save className="w-4 h-4" />
                保存
              </GlowButton>
            </div>
          </GlassCard>
        </div>
      )}
    </GlassCard>
  );
}

function RotateCcw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
