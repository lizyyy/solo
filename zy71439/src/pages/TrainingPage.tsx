import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Compass,
  User,
  Save,
  ListTodo,
  AlertCircle,
  FileDown,
  HelpCircle
} from 'lucide-react';
import { useTrainingStore } from '../store/trainingStore';
import { useWorkflowStore } from '../store/workflowStore';
import { useRecordStore } from '../store/recordStore';
import ChartCanvas from '../components/ChartCanvas/ChartCanvas';
import LighthouseCard from '../components/LighthousePanel/LighthouseCard';
import Timeline from '../components/Timeline/Timeline';
import RouteSelector from '../components/RouteSelector/RouteSelector';
import StatusBadge from '../components/common/StatusBadge';
import { getScenarioById } from '../data/scenarios';
import { getLighthousesByScenario } from '../data/lighthouses';
import { generateRoutes } from '../utils/routeGenerator';
import { calculateFinalError } from '../utils/geoCalculations';
import { calculateAllIntersections } from '../utils/triangulation';
import { OperationType, WorkflowStatus, TrainingRecord, RouteOption, SelectedRoute, IntersectionPoint } from '../types';
import { exportHTMLReport } from '../utils/exportReport';
import { validateAllBearings } from '../utils/bearingValidation';
import type { CanvasBounds } from '../components/ChartCanvas/LighthouseRenderer';

const TrainingPage: React.FC = () => {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const [traineeName, setTraineeName] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const {
    bearings,
    positionMark,
    selectedRoute,
    setScenario,
    setBearing,
    setPositionMark,
    setSelectedRoute,
    addOperation,
    resetTraining,
    toTrainingRecord,
    operations,
    estimatedPosition,
    triangleData
  } = useTrainingStore();

  const { records, addRecord } = useRecordStore();
  const { currentUser, loginAsTrainee } = useWorkflowStore();

  const scenario = scenarioId ? getScenarioById(scenarioId) : undefined;
  const lighthouses = scenario ? getLighthousesByScenario(scenario.lighthouseIds) : [];

  useEffect(() => {
    if (scenario) {
      if (!currentUser) {
        loginAsTrainee('学员');
      }
      resetTraining();
      setScenario(scenario.id, lighthouses.map(l => l.id));
      setTraineeName(currentUser?.name || '学员');
    }
    return () => {};
  }, [scenarioId, scenario, currentUser]);

  const handleBearingChange = useCallback((lighthouseId: string, bearing: any) => {
    setBearing(lighthouseId, bearing);
  }, [setBearing]);

  const handlePositionMarkEnd = useCallback((position: any) => {
    setPositionMark({ point: position }, false);
  }, [setPositionMark]);

  const { hasErrors, errors } = validateAllBearings(Object.values(bearings));

  const routes: RouteOption[] = positionMark && scenario
    ? generateRoutes(scenario.rescueStation, positionMark.position, lighthouses.map(lh => ({ position: lh.position, radius: lh.range })))
    : [];

  const handleRouteSelect = useCallback((routeId: string, reason: string) => {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      setSelectedRoute(route, reason);
    }
  }, [setSelectedRoute, routes]);

  const intersections: IntersectionPoint[] = React.useMemo(() => {
    return calculateAllIntersections(lighthouses, bearings);
  }, [lighthouses, bearings]);

  const bounds: CanvasBounds = React.useMemo(() => {
    const allPoints = [
      ...lighthouses.map(l => l.position),
      scenario?.rescueStation,
      scenario?.trueShipPosition,
      positionMark?.position,
      estimatedPosition
    ].filter(Boolean) as { lat: number; lng: number }[];

    const lats = allPoints.map(p => p.lat);
    const lngs = allPoints.map(p => p.lng);

    const padding = 0.01;
    return {
      minLat: Math.min(...lats) - padding,
      maxLat: Math.max(...lats) + padding,
      minLng: Math.min(...lngs) - padding,
      maxLng: Math.max(...lngs) + padding
    };
  }, [lighthouses, scenario, positionMark, estimatedPosition]);

  const allBearingsComplete = Object.keys(bearings).length >= 3;
  const positionMarked = positionMark !== null;
  const routeSelected = selectedRoute !== null;

  const canSubmit = allBearingsComplete && positionMarked && routeSelected && !hasErrors;

  const handleSubmit = () => {
    if (!canSubmit || !scenario) return;

    const finalError = positionMark
      ? calculateFinalError(scenario.trueShipPosition, positionMark.position)
      : undefined;

    const record: TrainingRecord = {
      ...toTrainingRecord(),
      traineeName,
      finalError,
      workflow: {
        status: WorkflowStatus.PENDING,
        reviewerId: undefined,
        reviewTime: undefined,
        reviewComment: undefined
      }
    };

    addRecord(record);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
    setShowConfirmDialog(false);

    setTimeout(() => {
      navigate('/records');
    }, 1500);
  };

  const handleExport = async () => {
    if (!scenario || !positionMark) return;
    const finalError = calculateFinalError(scenario.trueShipPosition, positionMark.position);
    const record = toTrainingRecord();
    const fullRecord: TrainingRecord = {
      ...record,
      traineeName,
      finalError,
      workflow: { status: WorkflowStatus.PENDING, reviewerId: undefined, reviewTime: undefined, reviewComment: undefined }
    };
    await exportHTMLReport(fullRecord, scenario, lighthouses);
  };

  if (!scenario) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <AlertCircle className="mx-auto mb-4 text-red-400" size={48} />
          <h2 className="text-xl font-bold mb-2">场景未找到</h2>
          <p className="text-slate-400 mb-4">请返回首页选择有效的训练场景</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Compass size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">海上救援三角定位</h1>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>{scenario.name}</span>
                  <span className="text-slate-600">|</span>
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    {traineeName}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/records')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 hover:text-white transition-colors"
              >
                <ListTodo size={18} />
                训练记录
              </button>
              <button
                onClick={handleExport}
                disabled={!positionMarked}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileDown size={18} />
                导出报告
              </button>
              <button
                onClick={() => setShowConfirmDialog(true)}
                disabled={!canSubmit}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                提交训练
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 space-y-4">
            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
              <h3 className="font-semibold text-white mb-3">任务说明</h3>
              <p className="text-sm text-slate-400 mb-4">{scenario.description}</p>
              <div className="flex items-center gap-2 text-xs">
                <HelpCircle size={12} className="text-yellow-400" />
                <span className="text-yellow-400">小提示：{scenario.hint}</span>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">灯塔方位角</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  allBearingsComplete ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {Object.keys(bearings).length}/3 已输入
                </span>
              </div>

              {hasErrors && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  {errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-400 flex items-start gap-1">
                      <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                      {err}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {lighthouses.slice(0, 3).map(lighthouse => (
                <LighthouseCard
                  key={lighthouse.id}
                  lighthouse={lighthouse}
                  bearing={bearings[lighthouse.id]}
                  onSaveBearing={(bearing) => handleBearingChange(lighthouse.id, bearing)}
                />
              ))}
              </div>
            </div>
          </div>

          <div className="col-span-6 space-y-4">
            <ChartCanvas
              lighthouses={lighthouses}
              bearings={bearings}
              positionMark={positionMark}
              estimatedPosition={estimatedPosition}
              truePosition={scenario.trueShipPosition}
              showTruePosition={false}
              triangle={triangleData}
              intersections={intersections}
              routeOptions={routes}
              selectedRouteId={selectedRoute?.routeId || null}
              bounds={bounds}
              onPositionMarkEnd={handlePositionMarkEnd}
              readonly={false}
            />

            <RouteSelector
              routes={routes}
              selectedRouteId={selectedRoute?.routeId || null}
              onSelect={handleRouteSelect}
              disabled={!positionMarked}
            />
          </div>

          <div className="col-span-3 space-y-4">
            <div className="bg-slate-800/30 rounded-xl border border-slate-700 p-4">
              <h3 className="font-semibold text-white mb-3">操作进度</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">输入方位角</span>
                  {allBearingsComplete ? (
                    <span className="text-green-400 text-sm">✓ 完成</span>
                  ) : (
                    <span className="text-orange-400 text-sm">进行中</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">标注遇险船位置</span>
                  {positionMarked ? (
                    <span className="text-green-400 text-sm">✓ 完成</span>
                  ) : (
                    <span className="text-slate-500 text-sm">待完成</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">选择救援路线</span>
                  {routeSelected ? (
                    <span className="text-green-400 text-sm">✓ 完成</span>
                  ) : (
                    <span className="text-slate-500 text-sm">待完成</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="font-semibold text-white">操作时间线</h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                <Timeline operations={operations} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">确认提交训练记录？</h2>
            <p className="text-slate-400 mb-6">
              提交后记录将进入复核流程，待教员确认后归档。你可以在训练记录中查看状态。
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}

      {exportSuccess && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl animate-pulse z-50">
          ✓ 训练记录提交成功！正在跳转到记录列表...
        </div>
      )}
    </div>
  );
};

export default TrainingPage;
