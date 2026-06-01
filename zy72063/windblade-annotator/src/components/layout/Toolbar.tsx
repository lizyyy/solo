import { useState } from 'react';
import {
  Upload,
  Save,
  Camera,
  Eye,
  EyeOff,
  FolderOpen,
  RefreshCw,
  ChevronRight,
  Menu,
  AlertTriangle
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { exportScreenshot, exportSchemeAsJSON } from '../../utils/export';
import type { Scheme } from '../../types';

interface ToolbarProps {
  onImportClick: () => void;
  onSaveSchemeClick: () => void;
}

export const Toolbar = ({ onImportClick, onSaveSchemeClick }: ToolbarProps) => {
  const [showSchemeMenu, setShowSchemeMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const {
    showCompleted,
    setShowCompleted,
    toggleLeftPanel,
    toggleRightPanel,
    schemes,
    loadScheme,
    resetToMockData,
    toggleDiffPanel,
    showDiffPanel,
    activeSchemeId
  } = useAppStore();

  const handleExportScreenshot = async () => {
    try {
      await exportScreenshot('main-canvas');
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleExportJSON = () => {
    const activeScheme = schemes.find(s => s.id === activeSchemeId);
    if (activeScheme) {
      exportSchemeAsJSON(activeScheme);
    }
  };

  const handleLoadScheme = (scheme: Scheme) => {
    loadScheme(scheme.id);
    setShowSchemeMenu(false);
  };

  const handleReset = () => {
    resetToMockData();
    setShowResetConfirm(false);
  };

  return (
    <>
      <div className="h-14 glass border-b border-white/10 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleLeftPanel}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
            title="切换左侧面板"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">风电叶片裂纹标注</h1>
              <p className="text-xs text-gray-400">Wind Blade Crack Annotator</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onImportClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入数据
          </button>

          <button
            onClick={onSaveSchemeClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success-600 hover:bg-success-500 text-white text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            保存方案
          </button>

          <div className="relative">
            <button
              onClick={() => setShowSchemeMenu(!showSchemeMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm font-medium transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              加载方案
              {schemes.length > 0 && (
                <span className="bg-primary-500 text-white text-xs px-1.5 rounded-full">
                  {schemes.length}
                </span>
              )}
            </button>

            {showSchemeMenu && schemes.length > 0 && (
              <div className="absolute top-full right-0 mt-2 w-64 glass rounded-lg shadow-xl overflow-hidden z-50">
                <div className="p-2 border-b border-white/10">
                  <p className="text-xs text-gray-400">已保存的方案</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {schemes.map(scheme => (
                    <button
                      key={scheme.id}
                      onClick={() => handleLoadScheme(scheme)}
                      className={`w-full text-left p-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 ${
                        activeSchemeId === scheme.id ? 'bg-primary-600/20' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-white">{scheme.name}</p>
                      <p className="text-xs text-gray-400">{scheme.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {scheme.records.length} 条记录 · {scheme.createdAt}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-white/10">
                  <button
                    onClick={handleExportJSON}
                    className="w-full text-center text-xs text-primary-400 hover:text-primary-300 py-1"
                    disabled={!activeSchemeId}
                  >
                    导出当前方案为 JSON
                  </button>
                </div>
              </div>
            )}

            {showSchemeMenu && schemes.length === 0 && (
              <div className="absolute top-full right-0 mt-2 w-48 glass rounded-lg shadow-xl p-4 z-50">
                <p className="text-sm text-gray-400 text-center">暂无保存的方案</p>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-white/10 mx-2" />

          <button
            onClick={handleExportScreenshot}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm font-medium transition-colors"
            title="导出截图"
          >
            <Camera className="w-4 h-4" />
            截图导出
          </button>

          <button
            onClick={() => toggleDiffPanel()}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showDiffPanel
                ? 'bg-warning-600 hover:bg-warning-500 text-white'
                : 'bg-dark-600 hover:bg-dark-500 text-white'
            }`}
            title="显示差异对比"
          >
            <AlertTriangle className="w-4 h-4" />
            口径对比
          </button>

          <div className="w-px h-6 bg-white/10 mx-2" />

          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showCompleted
                ? 'bg-success-600/20 text-success-400 border border-success-500/30'
                : 'bg-dark-600 text-white hover:bg-dark-500'
            }`}
          >
            {showCompleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showCompleted ? '显示全部' : '隐藏已处理'}
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
            title="重置数据"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-white/10 mx-2" />

          <button
            onClick={toggleRightPanel}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300 hover:text-white"
            title="切换右侧面板"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-2">确认重置</h3>
            <p className="text-gray-300 text-sm mb-6">
              此操作将清除所有本地数据，恢复到初始样例数据。确定要继续吗？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm transition-colors"
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
