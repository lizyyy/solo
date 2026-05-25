import { useState, useRef, useEffect } from 'react';
import { Play, Square, RotateCcw, Download, Eye, ChevronDown, Save, Upload, Trash2, X, FileJson } from 'lucide-react';
import { useSimulationStore } from '@/store/useSimulationStore';
import { sampleScenes } from '@/data/sampleScenes';
import { CameraView, OrchardScene } from '@/types';
import { exportReport } from '@/utils/reportGenerator';

const cameraViews: { id: CameraView; label: string }[] = [
  { id: 'default', label: '默认视角' },
  { id: 'top', label: '鸟瞰视角' },
  { id: 'front', label: '正视视角' },
  { id: 'side', label: '侧视视角' },
];

export function TopBar() {
  const [sceneDropdownOpen, setSceneDropdownOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');
  const [customScenes, setCustomScenes] = useState<OrchardScene[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    currentScene,
    setScene,
    isPlaying,
    setPlaying,
    resetSimulation,
    setCameraView,
    cameraView,
    generateReport,
    saveCustomScene,
    getCustomScenes,
    deleteCustomScene,
    importScenes,
  } = useSimulationStore();

  useEffect(() => {
    setCustomScenes(getCustomScenes());
  }, [getCustomScenes]);

  const handleExportReport = () => {
    const report = generateReport();
    exportReport(report);
  };

  const handleSceneChange = (scene: OrchardScene) => {
    setScene(scene);
    setSceneDropdownOpen(false);
  };

  const handleViewChange = (view: CameraView) => {
    setCameraView(view);
    setViewDropdownOpen(false);
  };

  const handleSaveScene = () => {
    if (sceneName.trim()) {
      const success = saveCustomScene(sceneName.trim(), sceneDescription.trim());
      if (success) {
        setCustomScenes(getCustomScenes());
        setSaveModalOpen(false);
        setSceneName('');
        setSceneDescription('');
      }
    }
  };

  const handleDeleteScene = (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个自定义场景吗？')) {
      deleteCustomScene(sceneId);
      setCustomScenes(getCustomScenes());
    }
  };

  const handleImportScene = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const scenes = JSON.parse(event.target?.result as string);
          const sceneArray = Array.isArray(scenes) ? scenes : [scenes];
          importScenes(sceneArray);
          setCustomScenes(getCustomScenes());
        } catch (err) {
          alert('导入失败：文件格式错误');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleExportScene = () => {
    const sceneData = JSON.stringify(currentScene, null, 2);
    const blob = new Blob([sceneData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentScene.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allScenes = [...sampleScenes, ...customScenes];

  return (
    <>
      <div className="absolute top-0 left-0 right-0 h-14 bg-gray-900/90 backdrop-blur-md border-b border-gray-700/50 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            果园喷药漂移预演
          </h1>

          <div className="relative">
            <button
              onClick={() => setSceneDropdownOpen(!sceneDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors"
            >
              <span>场景:</span>
              <span className="text-green-400 max-w-40 truncate">{currentScene.name}</span>
              <ChevronDown size={16} className={`transition-transform ${sceneDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {sceneDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 min-w-72 max-h-96 overflow-y-auto">
                <div className="p-2 border-b border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">内置样例</div>
                </div>
                {sampleScenes.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => handleSceneChange(scene)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors ${
                      currentScene.id === scene.id ? 'bg-gray-700' : ''
                    }`}
                  >
                    <div className="font-medium text-white text-sm">{scene.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{scene.description}</div>
                    <div className="flex gap-1 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        scene.type === 'normal' ? 'bg-green-900 text-green-300' :
                        scene.type === 'conflict' ? 'bg-red-900 text-red-300' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {scene.type === 'normal' ? '正常' : scene.type === 'conflict' ? '冲突' : '无风'}
                      </span>
                    </div>
                  </button>
                ))}

                {customScenes.length > 0 && (
                  <>
                    <div className="p-2 border-t border-gray-700">
                      <div className="text-xs text-gray-400 mb-1">自定义场景</div>
                    </div>
                    {customScenes.map((scene) => (
                      <div
                        key={scene.id}
                        className={`flex items-center justify-between hover:bg-gray-700 transition-colors group ${
                          currentScene.id === scene.id ? 'bg-gray-700' : ''
                        }`}
                      >
                        <button
                          onClick={() => handleSceneChange(scene)}
                          className="flex-1 px-4 py-3 text-left"
                        >
                          <div className="font-medium text-white text-sm">{scene.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{scene.description}</div>
                        </button>
                        <button
                          onClick={(e) => handleDeleteScene(scene.id, e)}
                          className="p-2 mr-2 rounded opacity-0 group-hover:opacity-100 hover:bg-red-900/50 transition-all"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </>
                )}

                <div className="p-2 border-t border-gray-700 flex gap-2">
                  <button
                    onClick={() => { setSaveModalOpen(true); setSceneDropdownOpen(false); }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-900/50 hover:bg-green-900 rounded text-xs text-green-300 transition-colors"
                  >
                    <Save size={14} />
                    保存当前
                  </button>
                  <button
                    onClick={() => { handleImportScene(); setSceneDropdownOpen(false); }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-900/50 hover:bg-blue-900 rounded text-xs text-blue-300 transition-colors"
                  >
                    <Upload size={14} />
                    导入
                  </button>
                  <button
                    onClick={() => { handleExportScene(); setSceneDropdownOpen(false); }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-purple-900/50 hover:bg-purple-900 rounded text-xs text-purple-300 transition-colors"
                  >
                    <FileJson size={14} />
                    导出
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-white transition-colors"
            >
              <Eye size={16} />
              <span>{cameraViews.find(v => v.id === cameraView)?.label}</span>
              <ChevronDown size={16} className={`transition-transform ${viewDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {viewDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 min-w-32 overflow-hidden">
                {cameraViews.map((view) => (
                  <button
                    key={view.id}
                    onClick={() => handleViewChange(view.id)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 transition-colors ${
                      cameraView === view.id ? 'bg-gray-700 text-green-400' : 'text-white'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setPlaying(!isPlaying)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isPlaying
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isPlaying ? <><Square size={16} /> 暂停</> : <><Play size={16} /> 开始模拟</>}
          </button>

          <button
            onClick={resetSimulation}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
          >
            <RotateCcw size={16} />
            重置
          </button>

          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white transition-colors"
          >
            <Download size={16} />
            导出报告
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {saveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-96 border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">保存自定义场景</h3>
              <button
                onClick={() => setSaveModalOpen(false)}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">场景名称</label>
                <input
                  type="text"
                  value={sceneName}
                  onChange={(e) => setSceneName(e.target.value)}
                  placeholder="输入场景名称"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">场景描述</label>
                <textarea
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  placeholder="输入场景描述"
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setSaveModalOpen(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveScene}
                  disabled={!sceneName.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}