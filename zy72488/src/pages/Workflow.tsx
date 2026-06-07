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
  const { workflows, points, advanceWorkflow, currentUser, addHistory, updatePoint } = useStore();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(
    workflows.find((w) => w.status === 'in-progress')?.id || null
  );
  const [busCardTime, setBusCardTime] = useState('');
  const [redLineNote, setRedLineNote] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const currentWorkflow = workflows.find((w) => w.id === selectedWorkflow);
  const currentPoint = points.find((p) => p.id === currentWorkflow?.pointId);

  const handleNextStep = () => {
    if (!currentWorkflow) return;

    const stepData: Record<string, unknown> = {};

    if (currentWorkflow.currentStep === 1) {
      if (!busCardTime.trim()) {
        alert('请输入公交刷卡时段');
        return;
      }
      stepData.busCardTime = busCardTime;
      
      addHistory({
        pointId: currentWorkflow.pointId,
        pointName: currentWorkflow.pointName,
        action: 'import',
        operator: currentUser,
        beforeData: {},
        afterData: { busCardTime },
        remark: '第一步：导入公交刷卡时段数据',
      });
    } else if (currentWorkflow.currentStep === 2) {
      if (!redLineNote.trim()) {
        alert('请输入红线图备注');
        return;
      }
      stepData.redLineNote = redLineNote;

      addHistory({
        pointId: currentWorkflow.pointId,
        pointName: currentWorkflow.pointName,
        action: 'update',
        operator: currentUser,
        beforeData: {},
        afterData: { redLineNote },
        remark: '第二步：补看红线图备注',
      });
    } else if (currentWorkflow.currentStep === 3) {
      updatePoint(currentWorkflow.pointId, {
        busCardTime: currentWorkflow.stepData.step1?.busCardTime || busCardTime,
        redLineNote: redLineNote,
        status: 'normal',
      });

      addHistory({
        pointId: currentWorkflow.pointId,
        pointName: currentWorkflow.pointName,
        action: 'update',
        operator: currentUser,
        beforeData: {},
        afterData: {},
        remark: '第三步：更新点位清单',
      });
    }

    advanceWorkflow(currentWorkflow.id, stepData);

    if (currentWorkflow.currentStep === 3) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleSelectWorkflow = (wf: WorkflowType) => {
    setSelectedWorkflow(wf.id);
    if (wf.stepData.step1) {
      setBusCardTime(wf.stepData.step1.busCardTime);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">流程工作台</h2>
        <p className="text-sm text-slate-500 mt-1">按三步流程完成点位数据处理</p>
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
                  {getStatusBadge(currentWorkflow.status)}
                </div>

                <div className="flex items-center">
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
                        请录入该点位的公交刷卡高峰时段，系统会自动检测是否与红线图备注冲突
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Bus size={18} className="text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">公交刷卡时段</span>
                      </div>
                      <textarea
                        value={busCardTime}
                        onChange={(e) => setBusCardTime(e.target.value)}
                        placeholder="例如：7:00-8:30, 16:00-18:00"
                        rows={3}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                      <Upload size={16} className="text-slate-400" />
                      <span className="text-sm text-slate-500">或点击上传公交刷卡数据文件</span>
                    </div>
                  </div>
                )}

                {currentWorkflow.currentStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800 mb-2">第二步：补看红线图备注</h4>
                      <p className="text-sm text-slate-500 mb-4">
                        请对照红线图，补充或核对该点位的备注信息，系统将自动检测与公交时段的冲突
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

                    {busCardTime && redLineNote && (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">系统检测提示</p>
                            <p className="text-xs text-amber-600 mt-1">
                              完成后系统将自动检测公交时段和红线图备注是否冲突，请仔细核对后再继续
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentWorkflow.currentStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-base font-semibold text-slate-800 mb-2">第三步：更新点位清单</h4>
                      <p className="text-sm text-slate-500 mb-4">请确认以下信息无误后，更新点位清单</p>
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
                            <p className="text-sm font-medium text-amber-800">重要提示</p>
                            <p className="text-xs text-amber-600 mt-1">
                              该点位存在施工临时改道但地图尚未同步，完成后将自动标记为"待居民代表复核"状态，不会直接归入正常
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {showSuccess && (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={20} className="text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-800">
                        {currentPoint.hasConstructionDetour && !currentPoint.mapSynced
                          ? '流程已完成，已标记为待居民代表复核'
                          : '流程已完成，点位信息已更新'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {currentWorkflow.status === 'in-progress' && (
                <div className="p-4 border-t border-slate-100 flex justify-between">
                  <button
                    onClick={() => setSelectedWorkflow(null)}
                    disabled={currentWorkflow.currentStep === 1}
                    className="flex items-center gap-1 px-4 py-2 text-slate-600 text-sm hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                    返回列表
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="flex items-center gap-1 px-6 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors"
                  >
                    {currentWorkflow.currentStep < 3 ? '下一步' : '完成更新'}
                    <ChevronRight size={16} />
                  </button>
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
