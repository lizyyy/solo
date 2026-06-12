import { useState } from 'react';
import {
  Workflow,
  Bus,
  FileText,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  CheckCircle,
  Upload,
  XCircle,
  FileCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import type { Workflow as WorkflowType } from '@/types';

const steps = [
  {
    step: 1,
    title: '导入公交刷卡时段',
    description: '上传或录入该点位的公交刷卡时段数据',
    icon: Bus,
  },
  {
    step: 2,
    title: '补看红线图备注',
    description: '对照红线图，补充或核对点位的备注信息',
    icon: FileText,
  },
  {
    step: 3,
    title: '更新点位清单',
    description: '确认信息无误后，更新点位清单数据',
    icon: MapPin,
  },
];

export default function WorkflowPage() {
  const {
    workflows,
    points,
    currentUser,
    completeStep1,
    completeStep2,
    completeStep3,
    checkDuplicateImport,
  } = useStore();

  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(
    workflows.find((w) => w.status === 'in-progress')?.id || null
  );
  const [busCardTime, setBusCardTime] = useState('');
  const [redLineNote, setRedLineNote] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [importSource, setImportSource] = useState('公交公司数据批次2026-06-B');
  const [showDuplicateHint, setShowDuplicateHint] = useState(false);
  const [stepResult, setStepResult] = useState<{
    isDuplicate?: boolean;
    hasConflict?: boolean;
    needsReview?: boolean;
    pointStatus?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentWorkflow = workflows.find((w) => w.id === selectedWorkflow);
  const currentPoint = points.find((p) => p.id === currentWorkflow?.pointId);

  const handleCheckDuplicate = () => {
    if (!currentPoint || !busCardTime.trim()) return;
    const result = checkDuplicateImport(currentPoint.id, busCardTime);
    setShowDuplicateHint(result.isDuplicate);
  };

  const handleNextStep = () => {
    if (!currentWorkflow || !currentPoint) return;
    setIsProcessing(true);
    setStepResult(null);

    setTimeout(() => {
      if (currentWorkflow.currentStep === 1) {
        if (!busCardTime.trim()) {
          alert('请输入公交刷卡时段');
          setIsProcessing(false);
          return;
        }
        const result = completeStep1(currentWorkflow.id, busCardTime, importSource);
        setStepResult({ isDuplicate: result.isDuplicate });
      } else if (currentWorkflow.currentStep === 2) {
        if (!redLineNote.trim()) {
          alert('请输入红线图备注');
          setIsProcessing(false);
          return;
        }
        const reason = changeReason.trim() || '对照红线图补录备注';
        const result = completeStep2(currentWorkflow.id, redLineNote, reason);
        setStepResult({ hasConflict: result.hasConflict });
      } else if (currentWorkflow.currentStep === 3) {
        const result = completeStep3(currentWorkflow.id);
        setStepResult({
          needsReview: result.needsReview,
          pointStatus: result.pointStatus,
        });
      }
      setIsProcessing(false);
    }, 500);
  };

  const handleSelectWorkflow = (wf: WorkflowType) => {
    setSelectedWorkflow(wf.id);
    setStepResult(null);
    setShowDuplicateHint(false);
    if (wf.stepData.step1) {
      setBusCardTime(wf.stepData.step1.busCardTime);
      setImportSource(wf.stepData.step1.importSource || '手工录入');
    }
    if (wf.stepData.step2) {
      setRedLineNote(wf.stepData.step2.redLineNote || '');
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      'in-progress': { label: '进行中', className: 'bg-emerald-100 text-emerald-700' },
      'pending-review': { label: '待复核', className: 'bg-amber-100 text-amber-700' },
      completed: { label: '已完成', className: 'bg-slate-100 text-slate-700' },
    };
    const cfg = config[status] || config['in-progress'];
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>
        {cfg.label}
      </span>
    );
  };

  const getCheckIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle size={18} className="text-emerald-500" />
    ) : (
      <AlertTriangle size={18} className="text-amber-500" />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">流程工作台</h2>
        <p className="text-sm text-slate-500 mt-1">
          按三步流程完成点位数据处理，施工改道未同步时自动转交居民代表复核
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-slate-100">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">流程列表</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[60vh] overflow-auto">
              {workflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => handleSelectWorkflow(wf)}
                  className={cn(
                    'w-full p-4 text-left hover:bg-slate-50 transition-colors',
                    selectedWorkflow === wf.id && 'bg-primary-50 border-l-4 border-primary-600'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{wf.pointName}</p>
                    {getStatusBadge(wf.status)}
                  </div>
                  <p className="text-xs text-slate-500">
                    步骤 {wf.currentStep} / 3 · {new Date(wf.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-3">
          {currentWorkflow && currentPoint ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-100">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{currentWorkflow.pointName}</h3>
                    <p className="text-sm text-slate-500 mt-1">{currentPoint.location}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {currentPoint.hasConstructionDetour && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                        <AlertTriangle size={12} />
                        有施工改道
                      </span>
                    )}
                    {getStatusBadge(currentWorkflow.status)}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  {steps.map((s, idx) => (
                    <div key={s.step} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            currentWorkflow.currentStep > s.step
                              ? 'bg-emerald-500 text-white'
                              : currentWorkflow.currentStep === s.step
                              ? 'bg-primary-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          )}
                        >
                          {currentWorkflow.currentStep > s.step ? (
                            <Check size={18} />
                          ) : (
                            <s.icon size={18} />
                          )}
                        </div>
                        <p
                          className={cn(
                            'text-xs mt-2 font-medium',
                            currentWorkflow.currentStep >= s.step ? 'text-slate-800' : 'text-slate-400'
                          )}
                        >
                          {s.title}
                        </p>
                      </div>
                      {idx < steps.length - 1 && (
                        <div
                          className={cn(
                            'w-24 h-0.5 mx-2',
                            currentWorkflow.currentStep > s.step ? 'bg-emerald-500' : 'bg-slate-200'
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {currentWorkflow.currentStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800 mb-2">第一步：导入公交刷卡时段</h4>
                      <p className="text-sm text-slate-500 mb-4">
                        请录入该点位的公交刷卡高峰时段，系统会自动检测是否为重复导入
                      </p>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Bus size={18} className="text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">公交刷卡时段</span>
                        </div>
                        <button
                          onClick={handleCheckDuplicate}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <RefreshCw size={12} />
                          检测重复
                        </button>
                      </div>
                      <textarea
                        value={busCardTime}
                        onChange={(e) => {
                          setBusCardTime(e.target.value);
                          setShowDuplicateHint(false);
                        }}
                        placeholder="例如：7:00-8:30, 16:00-18:00"
                        rows={3}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-xs font-medium text-slate-500 mb-2">数据来源</p>
                      <input
                        type="text"
                        value={importSource}
                        onChange={(e) => setImportSource(e.target.value)}
                        placeholder="请输入数据来源批次"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    {showDuplicateHint && (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">检测到重复导入</p>
                            <p className="text-xs text-amber-600 mt-1">
                              该点位已导入过相同数据（共 {currentPoint.importCount} 次，最近来源：{currentPoint.lastImportSource}）。
                              系统会自动去重，不会让数据翻倍，仅增加导入次数记录。
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {stepResult?.isDuplicate !== undefined && (
                      <div className={cn(
                        'p-4 rounded-lg border',
                        stepResult.isDuplicate
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-emerald-50 border-emerald-200'
                      )}>
                        <div className="flex items-center gap-2">
                          {stepResult.isDuplicate ? (
                            <AlertCircle size={18} className="text-amber-600" />
                          ) : (
                            <CheckCircle size={18} className="text-emerald-600" />
                          )}
                          <p className="text-sm font-medium text-slate-800">
                            {stepResult.isDuplicate
                              ? '已完成导入（检测到重复，系统已自动去重）'
                              : '已完成导入（首次导入成功）'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentWorkflow.currentStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800 mb-2">第二步：补看红线图备注</h4>
                      <p className="text-sm text-slate-500 mb-4">
                        请对照红线图，补充或核对该点位的备注信息。系统将自动检测与公交时段是否冲突。
                      </p>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bus size={16} className="text-blue-600" />
                        <p className="text-sm font-medium text-blue-800">已导入的公交刷卡时段</p>
                      </div>
                      <p className="text-sm text-blue-700">
                        {currentWorkflow.stepData.step1?.busCardTime || busCardTime}
                      </p>
                      {currentWorkflow.stepData.step1?.isDuplicate && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          <AlertCircle size={12} />
                          该数据为重复导入，已自动去重
                        </p>
                      )}
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText size={18} className="text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">红线图备注</span>
                      </div>
                      <textarea
                        value={redLineNote}
                        onChange={(e) => setRedLineNote(e.target.value)}
                        placeholder="请输入红线图上的备注信息..."
                        rows={4}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      />
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-xs font-medium text-slate-500 mb-2">修改原因（可选）</p>
                      <input
                        type="text"
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="例如：对照最新红线图更新备注"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    {stepResult?.hasConflict !== undefined && (
                      <div className={cn(
                        'p-4 rounded-lg border',
                        stepResult.hasConflict
                          ? 'bg-red-50 border-red-200'
                          : 'bg-emerald-50 border-emerald-200'
                      )}>
                        <div className="flex items-start gap-2">
                          {stepResult.hasConflict ? (
                            <XCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle size={18} className="text-emerald-600" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {stepResult.hasConflict
                                ? '检测到与公交时段冲突'
                                : '与公交时段无冲突'}
                            </p>
                            {stepResult.hasConflict && currentWorkflow.stepData.step2?.conflictDescription && (
                              <p className="text-xs text-slate-600 mt-1">
                                {currentWorkflow.stepData.step2.conflictDescription}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentWorkflow.currentStep === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800 mb-2">第三步：更新点位清单</h4>
                      <p className="text-sm text-slate-500">
                        请确认以下信息无误后，点击"完成更新"。系统会自动执行四项检查并生成报告。
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Bus size={16} className="text-blue-600" />
                          <p className="text-sm font-medium text-blue-800">公交刷卡时段</p>
                        </div>
                        <p className="text-sm text-blue-700">
                          {currentWorkflow.stepData.step1?.busCardTime || busCardTime}
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={16} className="text-purple-600" />
                          <p className="text-sm font-medium text-purple-800">红线图备注</p>
                        </div>
                        <p className="text-sm text-purple-700">
                          {currentWorkflow.stepData.step2?.redLineNote || redLineNote}
                        </p>
                      </div>
                    </div>

                    {currentPoint.hasConstructionDetour && !currentPoint.mapSynced && (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">
                              ⚠️ 施工临时改道没有同步到地图
                            </p>
                            <p className="text-xs text-amber-600 mt-1">
                              完成后不会直接归入正常，会自动标记为"待居民代表复核"状态，留给居民代表复核确认。
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentWorkflow.finalReport ? (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                          <FileCheck size={18} className="text-primary-600" />
                          <span className="text-sm font-semibold text-slate-800">最终处理报告</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getCheckIcon(currentWorkflow.finalReport.duplicateCheck.passed)}
                            <span className="text-sm text-slate-700 flex-1">重复导入检测</span>
                            <span className="text-xs text-slate-500">
                              {currentWorkflow.finalReport.duplicateCheck.detail}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getCheckIcon(currentWorkflow.finalReport.detourSync.passed)}
                            <span className="text-sm text-slate-700 flex-1">施工改道同步</span>
                            <span className="text-xs text-slate-500">
                              {currentWorkflow.finalReport.detourSync.detail}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getCheckIcon(currentWorkflow.finalReport.supplementRecalc.passed)}
                            <span className="text-sm text-slate-700 flex-1">补录后重算</span>
                            <span className="text-xs text-slate-500">
                              {currentWorkflow.finalReport.supplementRecalc.detail}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getCheckIcon(currentWorkflow.finalReport.exportConsistent.passed)}
                            <span className="text-sm text-slate-700 flex-1">导出一致性</span>
                            <span className="text-xs text-slate-500">
                              {currentWorkflow.finalReport.exportConsistent.detail}
                            </span>
                          </div>
                          <div className="pt-2 mt-2 border-t border-slate-200">
                            <p className="text-sm font-medium text-slate-800">
                              结论：{currentWorkflow.finalReport.overallConclusion}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {stepResult && !currentWorkflow.finalReport && (
                      <div className={cn(
                        'p-4 rounded-lg border',
                        stepResult.needsReview
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-emerald-50 border-emerald-200'
                      )}>
                        <div className="flex items-center gap-2">
                          {stepResult.needsReview ? (
                            <AlertTriangle size={18} className="text-amber-600" />
                          ) : (
                            <CheckCircle size={18} className="text-emerald-600" />
                          )}
                          <p className="text-sm font-medium text-slate-800">
                            {stepResult.needsReview
                              ? '流程完成，已标记为待居民代表复核（不归正常）'
                              : '流程完成，点位已更新为正常状态'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {currentWorkflow.status === 'in-progress' && (
                <div className="p-4 border-t border-slate-100 flex justify-between">
                  <button
                    onClick={() => setSelectedWorkflow(null)}
                    disabled={currentWorkflow.currentStep === 1 || isProcessing}
                    className="flex items-center gap-1 px-4 py-2 text-slate-600 text-sm hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                    返回列表
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={isProcessing}
                    className="flex items-center gap-1 px-6 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors disabled:opacity-60"
                  >
                    {isProcessing && <RefreshCw size={14} className="animate-spin" />}
                    {currentWorkflow.currentStep < 3 ? '下一步' : '完成更新'}
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {currentWorkflow.status === 'pending-review' && (
                <div className="p-4 border-t border-slate-100 bg-amber-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span className="text-sm text-amber-800">
                      待居民代表复核施工改道同步情况
                    </span>
                  </div>
                  <span className="text-xs text-amber-600">
                    点位状态：待复核
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-16 text-center">
              <Workflow size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">请从左侧选择一个流程开始工作</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
