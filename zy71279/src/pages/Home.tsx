import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { MeshPreview } from '@/components/MeshPreview';
import { EstimationWorkspace } from '@/components/EstimationWorkspace';
import { ResultsPanel } from '@/components/ResultsPanel';
import { MaterialManager } from '@/components/MaterialManager';
import { TaskHistory } from '@/components/TaskHistory';
import { ErrorEstimator } from '@/utils/errorEstimator';
import { Box, Layers, Database, Settings, AlertCircle, TestTube } from 'lucide-react';
import type { ReportData } from '@/utils/reportExporter';
import { generateSyntheticMesh } from '@/utils/meshSampler';
import { TopologyChecker } from '@/utils/topologyChecker';

type TabType = 'workspace' | 'history' | 'materials' | 'test';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('workspace');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [showTestPanel, setShowTestPanel] = useState(false);

  const {
    currentMesh,
    simplifiedMesh,
    currentParams,
    currentPrintParams,
    selectedMaterial,
    materials,
    estimationTasks,
    currentTaskId,
    errorAnalysis,
    printEstimation,
    constraintChecks,
    qualityErrors,
    isCalculating,
    viewMode,
    showErrorOverlay,
    progress,
    errorMessage,
    setMesh,
    setParams,
    setPrintParams,
    setSelectedMaterial,
    setViewMode,
    setShowErrorOverlay,
    loadMaterials,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    runEstimation,
    loadTaskHistory,
    loadTaskDetails,
    clearCurrent,
    initSampleData
  } = useAppStore();

  useEffect(() => {
    const init = async () => {
      await initSampleData();
      await loadMaterials();
      await loadTaskHistory();
    };
    init();
  }, []);

  const currentTask = useMemo(() => {
    return estimationTasks.find(t => t.id === currentTaskId) || null;
  }, [estimationTasks, currentTaskId]);

  const comparisonData = useMemo((): ReportData[] => {
    return selectedTaskIds
      .map(id => estimationTasks.find(t => t.id === id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined)
      .map(task => {
        const material = materials.find(m => m.id === task.materialId);
        let errorAnal: typeof errorAnalysis = null;
        let printEst: typeof printEstimation = null;
        let constraints: typeof constraintChecks = [];
        let errors: typeof qualityErrors = [];

        if (task.id === currentTaskId) {
          errorAnal = errorAnalysis;
          printEst = printEstimation;
          constraints = constraintChecks;
          errors = qualityErrors;
        }

        return {
          task,
          errorAnalysis: errorAnal || undefined,
          printEstimation: printEst || undefined,
          constraintChecks: constraints,
          material,
          qualityErrors: errors
        };
      });
  }, [selectedTaskIds, estimationTasks, materials, currentTaskId, errorAnalysis, printEstimation, constraintChecks, qualityErrors]);

  const perFaceErrors = useMemo(() => {
    if (!currentMesh || !simplifiedMesh) return [];
    const estimator = new ErrorEstimator(currentMesh, simplifiedMesh);
    return estimator.computePerFaceErrors();
  }, [currentMesh, simplifiedMesh]);

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleLoadTask = async (taskId: string) => {
    await loadTaskDetails(taskId);
    setActiveTab('workspace');
  };

  const handleCompare = () => {
    setActiveTab('workspace');
  };

  const handleRunTest = async (testType: 'normal_flip' | 'holes' | 'error_scale' | 'duplicate') => {
    let testMesh = generateSyntheticMesh('sphere', 64);

    switch (testType) {
      case 'normal_flip':
        testMesh = TopologyChecker.createMeshWithNormalsFlipped(testMesh, 0.1);
        break;
      case 'holes':
        testMesh = TopologyChecker.createMeshWithHoles(testMesh, 5);
        break;
      case 'error_scale':
        setParams({ errorThreshold: 100 });
        break;
      case 'duplicate':
        if (materials.length > 0) {
          const mat = materials[0];
          await addMaterial({
            code: mat.code,
            name: `重复_${mat.name}`,
            type: mat.type,
            density: mat.density,
            costPerGram: mat.costPerGram,
            printSpeed: mat.printSpeed,
            nozzleTemp: mat.nozzleTemp,
            bedTemp: mat.bedTemp
          });
        }
        return;
    }

    setMesh(testMesh);
    setActiveTab('workspace');
  };

  const tabs = [
    { key: 'workspace' as const, label: '估计工作台', icon: Box },
    { key: 'history' as const, label: '历史记录', icon: Database },
    { key: 'materials' as const, label: '材料库', icon: Layers },
    { key: 'test' as const, label: '测试面板', icon: TestTube }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
                <Box className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">曲面网格误差估计工具</h1>
                <p className="text-xs text-gray-500">3D打印网格简化方案对比分析</p>
              </div>
            </div>
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.key
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{errorMessage}</span>
            </div>
            <button
              onClick={() => useAppStore.setState({ errorMessage: null })}
              className="text-red-500 hover:text-red-700 text-sm font-medium"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-6 py-6">
        {activeTab === 'workspace' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">3D预览</h3>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={!simplifiedMesh || showErrorOverlay}
                      onChange={(e) => setShowErrorOverlay(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    显示简化模型
                  </label>
                </div>
                <div className="h-[400px] rounded-xl overflow-hidden bg-gray-50">
                  <MeshPreview
                    originalMesh={currentMesh}
                    simplifiedMesh={simplifiedMesh}
                    viewMode={viewMode}
                    showOriginal={!showErrorOverlay}
                    maxError={errorAnalysis?.maxError || 1}
                    perFaceErrors={perFaceErrors}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <EstimationWorkspace
                  currentMesh={currentMesh}
                  params={currentParams}
                  printParams={currentPrintParams}
                  isCalculating={isCalculating}
                  progress={progress}
                  onMeshLoad={setMesh}
                  onParamsChange={setParams}
                  onPrintParamsChange={setPrintParams}
                  onRun={runEstimation}
                  onClear={clearCurrent}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <ResultsPanel
                task={currentTask}
                errorAnalysis={errorAnalysis}
                printEstimation={printEstimation}
                constraintChecks={constraintChecks}
                qualityErrors={qualityErrors}
                material={selectedMaterial}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                comparisonData={comparisonData}
              />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <TaskHistory
              tasks={estimationTasks}
              materials={materials}
              selectedTaskIds={selectedTaskIds}
              onSelectTask={handleSelectTask}
              onLoadTask={handleLoadTask}
              onCompare={handleCompare}
            />
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <MaterialManager
              materials={materials}
              selectedMaterialId={selectedMaterial?.id || null}
              onSelect={setSelectedMaterial}
              onAdd={addMaterial}
              onUpdate={updateMaterial}
              onDelete={deleteMaterial}
            />
          </div>
        )}

        {activeTab === 'test' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">边缘情况测试</h3>
              <p className="text-sm text-gray-500 mb-6">
                使用预设的测试用例验证系统对各种异常情况的处理能力
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => handleRunTest('normal_flip')}
                  className="p-6 rounded-xl border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all text-left"
                >
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <h4 className="font-medium text-gray-800 mb-1">法线翻转测试</h4>
                  <p className="text-sm text-gray-500">
                    生成包含10%翻转法线的模型，验证检测和错误报告
                  </p>
                </button>

                <button
                  onClick={() => handleRunTest('holes')}
                  className="p-6 rounded-xl border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left"
                >
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <h4 className="font-medium text-gray-800 mb-1">孔洞检测测试</h4>
                  <p className="text-sm text-gray-500">
                    生成包含5个孔洞的模型，验证封闭性检查
                  </p>
                </button>

                <button
                  onClick={() => handleRunTest('error_scale')}
                  className="p-6 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Settings className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-medium text-gray-800 mb-1">误差尺度测试</h4>
                  <p className="text-sm text-gray-500">
                    设置不合理的误差阈值，验证尺度校验逻辑
                  </p>
                </button>

                <button
                  onClick={() => handleRunTest('duplicate')}
                  className="p-6 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all text-left"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <Layers className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-medium text-gray-800 mb-1">重复材料测试</h4>
                  <p className="text-sm text-gray-500">
                    使用现有材料编号添加新材料，验证重复检测
                  </p>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">加载示例模型</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['sphere', 'cube', 'torus'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      const mesh = generateSyntheticMesh(type, 64);
                      setMesh(mesh);
                      setActiveTab('workspace');
                    }}
                    className="p-6 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <Box className="w-6 h-6 text-blue-600" />
                    </div>
                    <h4 className="font-medium text-gray-800 mb-1">
                      {type === 'sphere' ? '球体' : type === 'cube' ? '立方体' : '环面'}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {type === 'sphere' ? '高精度球体模型' : type === 'cube' ? '标准立方体' : '复杂环面模型'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>3D打印网格简化误差估计工具 · 用于教学演示</span>
            <span>数据保存在本地浏览器，不会上传到服务器</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
