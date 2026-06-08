import { useEffect, useState, useMemo } from 'react';
import {
  Workflow,
  FileSpreadsheet,
  Camera,
  Eye,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Play,
  User,
  Wrench,
  Upload,
} from 'lucide-react';
import { useCanonicalStore, useAnnotationRows } from '../store/canonicalStore';
import { db } from '../db';
import { MOCK_COORDINATE_ORIGIN_CSV } from '../data/mockData';
import { WORKFLOW_STEP_LABELS, type WorkflowStep } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { formatTimestamp } from '../utils/checksum';
import type { CoordinateOriginRow, OcclusionEntry } from '../types';

const stepOrder: WorkflowStep[] = ['step1_import', 'step2_photo', 'step3_occlusion', 'completed'];

export function WorkflowPage() {
  const {
    workflowState,
    updateWorkflowStep,
    importData,
    supplementPhoto,
    updateOcclusion,
    recalculate,
    isLoading,
    currentOperator,
  } = useCanonicalStore();

  const allRows = useAnnotationRows();
  const missingRows = useMemo(() => allRows.filter(r => r.status === 'missing_row'), [allRows]);
  const [coordinateRows, setCoordinateRows] = useState<CoordinateOriginRow[]>([]);
  const [occlusionList, setOcclusionList] = useState<OcclusionEntry[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [supplementingId, setSupplementingId] = useState<string | null>(null);
  const [supplementValue, setSupplementValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const rows = await db.coordinateOrigin.orderBy('originalLineNumber').toArray();
    const occlusions = await db.occlusionList.toArray();
    setCoordinateRows(rows);
    setOcclusionList(occlusions);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getStepStatus = (step: WorkflowStep) => {
    const stepIndex = stepOrder.indexOf(step);
    const currentIndex = stepOrder.indexOf(workflowState.currentStep);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const handleStep1Import = async () => {
    try {
      const result = await importData(MOCK_COORDINATE_ORIGIN_CSV, '坐标原点说明_模拟数据.csv');
      await loadData();

      if (result.duplicateDetected) {
        showMessage('error', '检测到重复导入，已拦截');
      } else {
        showMessage(
          'success',
          result.missingRows.length > 0
            ? `导入成功！检测到 ${result.missingRows.length} 条缺行记录，需安全员复核`
            : '导入成功！无异常记录'
        );
      }
    } catch (error) {
      showMessage('error', '导入失败：' + String(error));
    }
  };

  const handleSupplementPhoto = async () => {
    if (!supplementingId || !supplementValue) return;
    try {
      await supplementPhoto(supplementingId, supplementValue);
      await loadData();
      setSupplementingId(null);
      setSupplementValue('');
      showMessage('success', '照片编号补录成功');

      const allSupplemented = coordinateRows.every(
        (row) => row.id === supplementingId || row.photoNumber
      );
      if (allSupplemented) {
        updateWorkflowStep({
          ...workflowState,
          step2Completed: true,
          currentStep: 'step3_occlusion',
          lastUpdatedAt: Date.now(),
        });
      }
    } catch (error) {
      showMessage('error', '补录失败：' + String(error));
    }
  };

  const handleOcclusionToggle = async (photoPointId: string, isOccluded: boolean) => {
    try {
      await updateOcclusion([photoPointId], isOccluded);
      await loadData();
      showMessage('success', '遮挡状态已更新');
    } catch (error) {
      showMessage('error', '更新失败：' + String(error));
    }
  };

  const handleStep3Complete = async () => {
    try {
      const result = await recalculate();
      if (result.success) {
        updateWorkflowStep({
          ...workflowState,
          step3Completed: true,
          currentStep: 'completed',
          lastUpdatedAt: Date.now(),
        });
        showMessage('success', `重算成功，新版本：${result.newVersion}`);
      } else {
        showMessage('error', '重算校验失败');
      }
    } catch (error) {
      showMessage('error', '重算失败：' + String(error));
    }
  };

  const StepIcon = ({ step }: { step: WorkflowStep }) => {
    switch (step) {
      case 'step1_import':
        return <FileSpreadsheet className="w-6 h-6" />;
      case 'step2_photo':
        return <Camera className="w-6 h-6" />;
      case 'step3_occlusion':
        return <Eye className="w-6 h-6" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">三步流程工作台</h1>
          <p className="text-sm text-gray-500 mt-1">
            导入 → 补看照片编号 → 更新遮挡点清单，状态机全程管控
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <User className="w-4 h-4" />
          当前用户：{currentOperator}
        </div>
      </div>

      {message && (
        <div
          className={`p-4 border-2 ${
            message.type === 'success' ? 'border-success-500 bg-green-50' : 'border-danger-500 bg-red-50'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-success-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-danger-500" />
            )}
            <span className={message.type === 'success' ? 'text-success-700' : 'text-danger-700'}>
              {message.text}
            </span>
          </div>
        </div>
      )}

      {missingRows.length > 0 && workflowState.currentStep === 'step1_import' && (
        <div className="card-industrial p-4 border-warning-500 bg-orange-50 animate-pulse-slow">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-warning-500" />
            <div>
              <h3 className="font-bold text-gray-800">检测到缺行待复核</h3>
              <p className="text-sm text-gray-600">
                共 {missingRows.length} 条"照片有点位但坐标表缺一行"的记录，
                <span className="font-bold text-warning-600">请先切换到安全员角色进行复核</span>，
                复核通过后才能进入下一步。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card-industrial p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <Workflow className="w-5 h-5 text-primary-600" />
            流程状态机
          </h2>
          <div className="text-sm text-gray-500">
            开始时间：{formatTimestamp(workflowState.startedAt)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          {stepOrder.map((step, index) => {
            const status = getStepStatus(step);
            const isLast = index === stepOrder.length - 1;

            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all ${
                      status === 'completed'
                        ? 'bg-success-500 border-success-500 text-white'
                        : status === 'current'
                        ? 'bg-primary-600 border-primary-600 text-white animate-blink'
                        : 'bg-gray-100 border-gray-300 text-gray-400'
                    }`}
                  >
                    {status === 'completed' ? (
                      <CheckCircle className="w-7 h-7" />
                    ) : (
                      <StepIcon step={step} />
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p
                      className={`text-sm font-medium ${
                        status === 'current' ? 'text-primary-600' : status === 'completed' ? 'text-success-600' : 'text-gray-400'
                      }`}
                    >
                      {WORKFLOW_STEP_LABELS[step]}
                    </p>
                    {status === 'current' && (
                      <span className="text-xs text-primary-500">进行中</span>
                    )}
                    {status === 'completed' && (
                      <span className="text-xs text-success-500">已完成</span>
                    )}
                    {status === 'pending' && (
                      <span className="text-xs text-gray-400">待处理</span>
                    )}
                  </div>
                </div>
                {!isLast && (
                  <div className="flex-1 h-1 mx-4 bg-gray-200 rounded">
                    <div
                      className={`h-full rounded transition-all ${
                        status === 'completed' ? 'bg-success-500 w-full' : 'w-0'
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {workflowState.currentStep === 'step1_import' && (
        <div className="card-industrial p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="w-5 h-5 text-primary-600" />
            <h2 className="font-bold text-gray-800 text-lg">第一步：导入坐标原点说明</h2>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            导入坐标原点说明CSV文件，系统将自动检测重复导入和照片点位与坐标表匹配情况。
            预置的模拟数据包含一条"照片有点位但坐标表缺一行"的场景（pp003）。
          </p>

          <div className="flex items-center gap-4 mb-6">
            <button onClick={handleStep1Import} className="btn-industrial flex items-center gap-2">
              <Play className="w-4 h-4" />
              导入模拟数据
            </button>
            <label className="btn-industrial-outline flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              选择CSV文件
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const text = await file.text();
                    await importData(text, file.name);
                    await loadData();
                    showMessage('success', '导入成功');
                  }
                }}
              />
            </label>
          </div>

          {coordinateRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header-cell">原始行号</th>
                    <th className="table-header-cell">点位ID</th>
                    <th className="table-header-cell">照片编号</th>
                    <th className="table-header-cell">X坐标</th>
                    <th className="table-header-cell">Y坐标</th>
                    <th className="table-header-cell">Z坐标</th>
                    <th className="table-header-cell">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {coordinateRows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.processingStatus === 'missing_row' ? 'missing-row-highlight' : ''}
                    >
                      <td className="table-cell font-mono font-bold text-primary-600">
                        {row.originalLineNumber}
                      </td>
                      <td className="table-cell font-mono">{row.photoPointId}</td>
                      <td className="table-cell">{row.photoNumber || '-'}</td>
                      <td className="table-cell font-mono">{row.coordinateX?.toFixed(2) || '-'}</td>
                      <td className="table-cell font-mono">{row.coordinateY?.toFixed(2) || '-'}</td>
                      <td className="table-cell font-mono">{row.coordinateZ?.toFixed(2) || '-'}</td>
                      <td className="table-cell">
                        <StatusBadge status={row.processingStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {workflowState.currentStep === 'step2_photo' && (
        <div className="card-industrial p-6">
          <div className="flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-primary-600" />
            <h2 className="font-bold text-gray-800 text-lg">第二步：许工补看巡检照片编号</h2>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            设备工程师许工核对巡检照片，补录缺失的照片编号。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header-cell">原始行号</th>
                  <th className="table-header-cell">点位ID</th>
                  <th className="table-header-cell">照片编号</th>
                  <th className="table-header-cell">状态</th>
                  <th className="table-header-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                {coordinateRows.map((row) => (
                  <tr key={row.id}>
                    <td className="table-cell font-mono font-bold text-primary-600">
                      {row.originalLineNumber}
                    </td>
                    <td className="table-cell font-mono">{row.photoPointId}</td>
                    <td className="table-cell">
                      {supplementingId === row.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={supplementValue}
                            onChange={(e) => setSupplementValue(e.target.value)}
                            className="input-industrial w-32"
                            placeholder="如 P2024-003"
                            autoFocus
                          />
                          <button onClick={handleSupplementPhoto} className="btn-success px-2 py-1 text-xs">
                            保存
                          </button>
                          <button
                            onClick={() => {
                              setSupplementingId(null);
                              setSupplementValue('');
                            }}
                            className="btn-industrial-outline px-2 py-1 text-xs"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <span>{row.photoNumber || '-'}</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={row.processingStatus} />
                    </td>
                    <td className="table-cell">
                      {!row.photoNumber && supplementingId !== row.id && (
                        <button
                          onClick={() => {
                            setSupplementingId(row.id);
                            setSupplementValue('');
                          }}
                          className="text-primary-600 hover:text-primary-800 text-sm flex items-center gap-1"
                        >
                          <Wrench className="w-3 h-3" />
                          补录
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {coordinateRows.every((row) => row.photoNumber) && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  updateWorkflowStep({
                    ...workflowState,
                    step2Completed: true,
                    currentStep: 'step3_occlusion',
                    lastUpdatedAt: Date.now(),
                  });
                }}
                className="btn-industrial flex items-center gap-2"
              >
                进入下一步
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {workflowState.currentStep === 'step3_occlusion' && (
        <div className="card-industrial p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-primary-600" />
            <h2 className="font-bold text-gray-800 text-lg">第三步：更新遮挡点清单</h2>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            标记被遮挡的点位，完成后触发重算生成最终标注结果。
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header-cell">点位ID</th>
                  <th className="table-header-cell">照片编号</th>
                  <th className="table-header-cell">当前状态</th>
                  <th className="table-header-cell">更新时间</th>
                  <th className="table-header-cell">操作</th>
                </tr>
              </thead>
              <tbody>
                {occlusionList.map((oc) => {
                  const pp = coordinateRows.find((r) => r.photoPointId === oc.photoPointId);
                  return (
                    <tr key={oc.id}>
                      <td className="table-cell font-mono">{oc.photoPointId}</td>
                      <td className="table-cell">{pp?.photoNumber || '-'}</td>
                      <td className="table-cell">
                        {oc.isOccluded ? (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5">遮挡</span>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5">可见</span>
                        )}
                      </td>
                      <td className="table-cell text-xs text-gray-500">
                        {formatTimestamp(oc.updatedAt)}
                      </td>
                      <td className="table-cell">
                        <button
                          onClick={() => handleOcclusionToggle(oc.photoPointId, !oc.isOccluded)}
                          className={`text-sm ${
                            oc.isOccluded
                              ? 'text-success-600 hover:text-success-800'
                              : 'text-warning-600 hover:text-warning-800'
                          }`}
                        >
                          {oc.isOccluded ? '标为可见' : '标为遮挡'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button onClick={handleStep3Complete} className="btn-success flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              完成并触发重算
            </button>
          </div>
        </div>
      )}

      {workflowState.currentStep === 'completed' && (
        <div className="card-industrial p-6 border-success-500 bg-green-50">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-12 h-12 text-success-500" />
            <div>
              <h2 className="font-bold text-xl text-gray-800">流程完成！</h2>
              <p className="text-sm text-gray-600">
                三步流程已全部完成，标注结果已生成。请前往标注总览查看最终结果，或在复盘记录中查看完整操作日志。
              </p>
              <p className="text-xs text-gray-500 mt-1">
                完成时间：{formatTimestamp(workflowState.lastUpdatedAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-600">处理中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
