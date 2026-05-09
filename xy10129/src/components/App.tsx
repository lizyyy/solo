import { useYardPlanner } from '../hooks/useYardPlanner';
import { Toolbar } from './Toolbar';
import { YardSceneCanvas } from './YardSceneCanvas';
import { Sidebar } from './Sidebar';
import { StatsBar } from './StatsBar';

export function App() {
  const {
    yardConfig,
    waypoints,
    pathPlan,
    validation,
    savedPlans,
    toolMode,
    planName,
    stats,
    setToolMode,
    setPlanName,
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    clearPath,
    saveCurrentPlan,
    loadPlan,
    removePlan,
    exportReport
  } = useYardPlanner();

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <Toolbar
        currentMode={toolMode}
        onModeChange={setToolMode}
        onClear={clearPath}
        onSave={saveCurrentPlan}
        onExport={exportReport}
        planName={planName}
        onPlanNameChange={setPlanName}
        canSave={pathPlan !== null}
        canExport={pathPlan !== null}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <YardSceneCanvas
            yardConfig={yardConfig}
            waypoints={waypoints}
            pathPlan={pathPlan}
            validation={validation}
            drawMode={toolMode === 'draw' || toolMode === 'edit'}
            onAddWaypoint={addWaypoint}
            onUpdateWaypoint={updateWaypoint}
          />
          
          {toolMode === 'draw' && waypoints.length === 0 && (
            <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 rounded-lg p-3 text-sm">
              <div className="text-blue-400 font-semibold">✏️ 绘制模式</div>
              <div className="text-gray-400 text-xs mt-1">
                点击地面添加航点，设置起点和终点
              </div>
            </div>
          )}
          
          {toolMode === 'edit' && (
            <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 rounded-lg p-3 text-sm">
              <div className="text-yellow-400 font-semibold">🔧 编辑模式</div>
              <div className="text-gray-400 text-xs mt-1">
                拖拽航点调整位置
              </div>
            </div>
          )}
        </div>

        <Sidebar
          waypoints={waypoints}
          segments={pathPlan?.segments || []}
          validation={validation}
          savedPlans={savedPlans}
          yardConfig={yardConfig}
          onDeleteWaypoint={deleteWaypoint}
          onLoadPlan={loadPlan}
          onDeletePlan={removePlan}
        />
      </div>

      <StatsBar stats={stats} />
    </div>
  );
}
