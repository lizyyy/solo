import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store';
import { WorkflowStep } from '@/types';
import StepNavigation from '@/components/StepNavigation';
import FileImportZone from '@/components/FileImportZone';
import RouteVisualization from '@/components/RouteVisualization';
import ConflictList from '@/components/ConflictList';
import SelfCheckPanel from '@/components/SelfCheckPanel';
import ReviewPanel from '@/components/ReviewPanel';
import ExportPanel from '@/components/ExportPanel';
import TestCaseSelector from '@/components/TestCaseSelector';
import { clearAllData } from '@/db';
import { cn } from '@/lib/utils';

export default function Home() {
  const workflow = useAppStore((s) => s.workflow);
  const pointCloudLog = useAppStore((s) => s.pointCloudLog);
  const safetyRadiusTable = useAppStore((s) => s.safetyRadiusTable);
  const routes = useAppStore((s) => s.routes);
  const conflicts = useAppStore((s) => s.conflicts);
  const selfChecks = useAppStore((s) => s.selfChecks);
  const operator = useAppStore((s) => s.operator);
  const setOperator = useAppStore((s) => s.setOperator);
  const setCurrentStep = useAppStore((s) => s.setCurrentStep);
  const loadFromDatabase = useAppStore((s) => s.loadFromDatabase);
  const resetAll = useAppStore((s) => s.resetAll);
  const isLoading = useAppStore((s) => s.isLoading);

  useEffect(() => {
    loadFromDatabase();
  }, [loadFromDatabase]);

  const pendingConflicts = useMemo(
    () => conflicts.filter((c) => c.status === 'pending').length,
    [conflicts]
  );

  const pendingReviews = useMemo(
    () => routes.filter((r) => r.reviewStatus === 'pending').length,
    [routes]
  );

  const handleStepClick = (step: WorkflowStep) => {
    setCurrentStep(step);
  };

  const handleReset = async () => {
    if (confirm('确定要清空所有数据重新开始吗？此操作不可撤销。')) {
      await clearAllData();
      resetAll();
    }
  };

  const renderStepContent = () => {
    const exhibits = pointCloudLog?.exhibits || [];

    switch (workflow.currentStep) {
      case 'import_point_cloud':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <div className="card">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">
                    第一步：导入点云抽稀日志
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    点云抽稀日志包含展柜坐标、点云测量半径和观展动线。
                    支持 .txt、.csv、.json 格式。
                  </p>
                  <FileImportZone type="point_cloud" />
                </div>

                <SelfCheckPanel checks={selfChecks} />
              </div>

              <div className="lg:col-span-2">
                <div id="route-visualization-container">
                  {pointCloudLog ? (
                    <RouteVisualization
                      exhibits={exhibits}
                      routes={routes}
                      conflicts={conflicts}
                    />
                  ) : (
                    <div className="card h-96 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                            />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">导入点云抽稀日志后</p>
                        <p className="text-xs mt-1">这里会显示展柜动线可视化图</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'import_safety_radius':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <div className="card">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">
                    第二步：补看安全半径表
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    安全半径表由展陈设计方提供，包含每个展柜的正式安全距离。
                    系统会自动与点云测量值对比，标记冲突项。
                  </p>
                  <FileImportZone type="safety_radius" />
                </div>

                <SelfCheckPanel checks={selfChecks} />
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div id="route-visualization-container">
                  <RouteVisualization
                    exhibits={exhibits}
                    routes={routes}
                    conflicts={conflicts}
                  />
                </div>

                {conflicts.length > 0 && (
                  <ConflictList
                    conflicts={conflicts}
                    onResolved={() => {}}
                  />
                )}
              </div>
            </div>
          </motion.div>
        );

      case 'export':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                {pendingReviews > 0 && (
                  <ReviewPanel routes={routes} onReviewed={() => {}} />
                )}

                <SelfCheckPanel checks={selfChecks} />

                <ExportPanel
                  visualizationElementId="route-visualization-container"
                  onExported={() => {}}
                />
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div id="route-visualization-container">
                  <RouteVisualization
                    exhibits={exhibits}
                    routes={routes}
                    conflicts={conflicts}
                  />
                </div>

                {pendingConflicts > 0 && (
                  <div className="card border-warning-300 bg-warning-50">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-warning-100 flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-4 h-4 text-warning-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-warning-800 mb-1">
                          还有 {pendingConflicts} 个冲突未处理
                        </h4>
                        <p className="text-xs text-warning-700">
                          请回到第二步确认或驳回冲突，避免导出数据有误。
                          未处理的冲突会在导出图中用红框标注。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-survey-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">正在加载数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      <StepNavigation
        currentStep={workflow.currentStep}
        stepCompleted={workflow.stepCompleted}
        onStepClick={handleStepClick}
        pendingConflicts={pendingConflicts}
        pendingReviews={pendingReviews}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <TestCaseSelector />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <User className="w-4 h-4" />
              <span>操作人：</span>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className={cn(
                  'px-2 py-1 rounded border border-gray-200',
                  'focus:outline-none focus:border-survey-400 focus:ring-1 focus:ring-survey-400',
                  'w-28 text-center font-mono'
                )}
              />
            </div>

            <button
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs',
                'text-gray-600 hover:text-gray-800 hover:bg-gray-100',
                'transition-colors'
              )}
              onClick={handleReset}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <div key={workflow.currentStep}>{renderStepContent()}</div>
          </AnimatePresence>
        </main>

        <footer className="bg-white border-t border-gray-200 px-6 py-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span>
                点云日志：
                {pointCloudLog ? (
                  <span className="text-success-600 font-medium">
                    已导入 · {pointCloudLog.exhibits.length} 展柜
                  </span>
                ) : (
                  <span className="text-gray-400">未导入</span>
                )}
              </span>
              <span className="text-gray-300">|</span>
              <span>
                安全半径表：
                {safetyRadiusTable ? (
                  <span className="text-success-600 font-medium">
                    已导入 · {safetyRadiusTable.exhibits.length} 展柜
                  </span>
                ) : (
                  <span className="text-gray-400">未导入</span>
                )}
              </span>
              <span className="text-gray-300">|</span>
              <span>
                路线：{routes.length} 条 · 总长{' '}
                {routes.reduce((s, r) => s + r.calculatedLength, 0).toFixed(2)}m
              </span>
            </div>
            <div className="font-mono">
              博物馆展柜动线模拟 · v1.0
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
