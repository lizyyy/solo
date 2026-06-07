import { useState, useCallback } from 'react';
import {
  Save,
  FolderOpen,
  Camera,
  RotateCcw,
  Download,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  Layers,
  X,
  Trash2,
  CheckCircle,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { useStore, useCoordinateSystems, useStats } from '@/store/useStore';
import { COORDINATE_COLORS } from '@/types';

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  return (
    <div className={`fixed top-20 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl animate-slide-in ${
      type === 'success' ? 'bg-green-900/90 border border-green-600 text-green-200' :
      type === 'error' ? 'bg-red-900/90 border border-red-600 text-red-200' :
      'bg-blue-900/90 border border-blue-600 text-blue-200'
    }`}>
      {type === 'success' && <CheckCircle className="w-5 h-5" />}
      {type === 'error' && <AlertTriangle className="w-5 h-5" />}
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Toolbar() {
  const {
    schemes,
    saveScheme,
    loadScheme,
    deleteScheme,
    currentScheme,
    exportScreenshot,
    exportData,
    exportCSV,
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
  const stats = useStats();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [schemeName, setSchemeName] = useState('');
  const [schemeDesc, setSchemeDesc] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const anomalyCount = stats.anomalyCount;
  const emptyCount = stats.emptyCount;
  const duplicateCount = stats.duplicateCount;

  const handleSaveScheme = () => {
    if (schemeName.trim()) {
      saveScheme(schemeName.trim(), schemeDesc.trim());
      setShowSaveModal(false);
      setSchemeName('');
      setSchemeDesc('');
      showToast(`方案 "${schemeName}" 保存成功`, 'success');
    }
  };

  const handleExportScreenshot = async () => {
    try {
      showToast('正在生成截图...', 'info');
      setShowExportMenu(false);
      await exportScreenshot();
      showToast('截图导出成功！已下载到本地', 'success');
    } catch (e) {
      showToast('截图导出失败，请重试', 'error');
    }
  };

  const handleExportJSON = () => {
    try {
      exportData();
      setShowExportMenu(false);
      showToast('JSON 数据导出成功！', 'success');
    } catch (e) {
      showToast('数据导出失败，请重试', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      exportCSV();
      setShowExportMenu(false);
      showToast('CSV 报表导出成功！', 'success');
    } catch (e) {
      showToast('报表导出失败，请重试', 'error');
    }
  };

  const handleLoadScheme = (schemeId: string) => {
    const scheme = schemes.find(s => s.id === schemeId);
    loadScheme(schemeId);
    setShowLoadModal(false);
    showToast(`方案 "${scheme?.name}" 已加载`, 'success');
  };

  const handleDeleteScheme = (schemeId: string, schemeName: string) => {
    if (confirm(`确定要删除方案 "${schemeName}" 吗？`)) {
      deleteScheme(schemeId);
      showToast(`方案 "${schemeName}" 已删除`, 'info');
    }
  };

  return (
    <>
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 relative">
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
            className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors shadow-lg shadow-amber-900/20"
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
            {schemes.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-600 rounded text-xs">
                {schemes.length}
              </span>
            )}
          </button>

          {currentScheme && (
            <div className="flex items-center gap-2 ml-2 px-3 py-1.5 bg-amber-900/30 border border-amber-700/50 rounded-lg">
              <CheckCircle className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">
                当前: {currentScheme.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-sm px-3 py-1.5 bg-slate-700/50 rounded-lg">
            <span className="text-slate-400">
              共 <span className="text-white font-semibold">{stats.totalComponents}</span> 条
            </span>
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
                    className="px-2 py-1 text-xs rounded transition-all hover:scale-105"
                    style={{
                      backgroundColor: isActive ? color : 'transparent',
                      color: isActive ? '#fff' : color,
                      border: `1px solid ${color}`,
                    }}
                    title={isActive ? '点击取消筛选' : `点击筛选 ${cs}`}
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

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              title="导出"
            >
              <Download className="w-5 h-5" />
              <ChevronDown className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden z-50">
                <button
                  onClick={handleExportScreenshot}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  导出截图 (PNG)
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <FileJson className="w-4 h-4" />
                  导出数据 (JSON)
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  导出报表 (CSV)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-96 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">保存方案</h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  方案名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={schemeName}
                  onChange={(e) => setSchemeName(e.target.value)}
                  placeholder="例如：2024-06-正殿修缮方案"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  方案描述
                </label>
                <textarea
                  value={schemeDesc}
                  onChange={(e) => setSchemeDesc(e.target.value)}
                  placeholder="记录当前视图、标记状态、备注等..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none transition-colors"
                />
              </div>
              <div className="p-3 bg-slate-700/50 rounded-lg text-xs text-slate-400">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>将保存以下内容：</span>
                </div>
                <ul className="ml-6 space-y-1 list-disc">
                  <li>所有 {components.length} 个构件的标记和备注</li>
                  <li>当前3D视角和缩放</li>
                  <li>筛选器设置</li>
                </ul>
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
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  保存方案
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-[450px] shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">加载方案</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {schemes.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg mb-2">暂无保存的方案</p>
                <p className="text-sm">点击"保存方案"创建第一个方案</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {schemes.map((scheme) => (
                  <div
                    key={scheme.id}
                    className={`p-4 rounded-lg border transition-all ${
                      currentScheme?.id === scheme.id
                        ? 'bg-amber-900/30 border-amber-600'
                        : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white flex items-center gap-2">
                          {scheme.name}
                          {currentScheme?.id === scheme.id && (
                            <span className="px-1.5 py-0.5 bg-amber-600 rounded text-xs">当前</span>
                          )}
                        </div>
                        {scheme.description && (
                          <div className="text-xs text-slate-400 mt-1">
                            {scheme.description}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-2 flex items-center gap-3">
                          <span>{new Date(scheme.createdAt).toLocaleString('zh-CN')}</span>
                          <span>{(scheme as any).componentSnapshots?.length || components.length} 个构件</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleLoadScheme(scheme.id)}
                          className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors"
                        >
                          加载
                        </button>
                        <button
                          onClick={() => handleDeleteScheme(scheme.id, scheme.name)}
                          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          title="删除方案"
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

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
