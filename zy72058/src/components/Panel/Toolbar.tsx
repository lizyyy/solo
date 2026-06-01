import { useState } from 'react';
import {
  Save,
  FolderOpen,
  Camera,
  RotateCcw,
  Download,
  FileJson,
  AlertTriangle,
  Layers,
  X,
  Trash2,
} from 'lucide-react';
import { useStore, useCoordinateSystems } from '@/store/useStore';
import { COORDINATE_COLORS } from '@/types';

export function Toolbar() {
  const {
    schemes,
    saveScheme,
    loadScheme,
    deleteScheme,
    currentScheme,
    exportScreenshot,
    exportData,
    resetCamera,
    components,
    toggleLeftPanel,
    toggleRightPanel,
    leftPanelOpen,
    rightPanelOpen,
    filter,
    setFilter,
  } = useStore();
  const coordinateSystems = useCoordinateSystems();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [schemeName, setSchemeName] = useState('');
  const [schemeDesc, setSchemeDesc] = useState('');

  const anomalyCount = components.filter((c) => c.isAnomaly).length;
  const emptyCount = components.filter((c) => c.status === 'empty').length;
  const duplicateCount = components.filter((c) => c.status === 'duplicate').length;

  const handleSaveScheme = () => {
    if (schemeName.trim()) {
      saveScheme(schemeName.trim(), schemeDesc.trim());
      setShowSaveModal(false);
      setSchemeName('');
      setSchemeDesc('');
    }
  };

  return (
    <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 mr-4">
          <button
            onClick={toggleLeftPanel}
            className={`p-2 rounded-lg transition-colors ${
              leftPanelOpen
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title="切换构件库面板"
          >
            <Layers className="w-5 h-5" />
          </button>
          <button
            onClick={toggleRightPanel}
            className={`p-2 rounded-lg transition-colors ${
              rightPanelOpen
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title="切换详情面板"
          >
            <FileJson className="w-5 h-5" />
          </button>
        </div>

        <div className="h-6 w-px bg-slate-600 mx-2" />

        <button
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          保存方案
        </button>

        <button
          onClick={() => setShowLoadModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
          加载方案
        </button>

        {currentScheme && (
          <span className="text-sm text-amber-400 ml-2">
            当前: {currentScheme.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-4 text-sm">
          {anomalyCount > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              {anomalyCount} 异常
            </span>
          )}
          {emptyCount > 0 && (
            <span className="text-yellow-400">{emptyCount} 空值</span>
          )}
          {duplicateCount > 0 && (
            <span className="text-orange-400">{duplicateCount} 重复</span>
          )}
        </div>

        <div className="h-6 w-px bg-slate-600" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">坐标系:</span>
          <div className="flex gap-1">
            {coordinateSystems.map((cs) => {
              const color = COORDINATE_COLORS[cs] || COORDINATE_COLORS['默认'];
              const isActive = filter.coordinateSystem === cs;
              return (
                <button
                  key={cs}
                  onClick={() =>
                    setFilter({
                      coordinateSystem: isActive ? undefined : cs,
                    })
                  }
                  className="px-2 py-1 text-xs rounded transition-colors"
                  style={{
                    backgroundColor: isActive ? color : 'transparent',
                    color: isActive ? '#fff' : color,
                    border: `1px solid ${color}`,
                  }}
                >
                  {cs}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-6 w-px bg-slate-600" />

        <button
          onClick={resetCamera}
          className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          title="重置视角"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          onClick={exportScreenshot}
          className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          title="导出截图"
        >
          <Camera className="w-5 h-5" />
        </button>

        <button
          onClick={exportData}
          className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
          title="导出数据"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-96 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">保存方案</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  方案名称
                </label>
                <input
                  type="text"
                  value={schemeName}
                  onChange={(e) => setSchemeName(e.target.value)}
                  placeholder="输入方案名称..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  方案描述
                </label>
                <textarea
                  value={schemeDesc}
                  onChange={(e) => setSchemeDesc(e.target.value)}
                  placeholder="可选，输入方案描述..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveScheme}
                  disabled={!schemeName.trim()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-96 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">加载方案</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {schemes.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无保存的方案</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2">
                {schemes.map((scheme) => (
                  <div
                    key={scheme.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      currentScheme?.id === scheme.id
                        ? 'bg-amber-900/30 border-amber-600'
                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">
                          {scheme.name}
                        </div>
                        {scheme.description && (
                          <div className="text-xs text-slate-400 mt-1 line-clamp-1">
                            {scheme.description}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">
                          {new Date(scheme.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => {
                            loadScheme(scheme.id);
                            setShowLoadModal(false);
                          }}
                          className="px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors"
                        >
                          加载
                        </button>
                        <button
                          onClick={() => deleteScheme(scheme.id)}
                          className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
