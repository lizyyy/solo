import os

file_path = '/Users/lzy/pro/solo/workspaces/zy72488/src/pages/Workflow.tsx'

content = r"""import { useState, useMemo } from 'react';
import {
  Bus,
  FileText,
  CheckCircle,
  AlertTriangle,
  Database,
  FileCheck,
  Layers,
  Hash,
  MapPin,
  User,
  Clock,
  ChevronRight,
  CheckSquare,
  ArrowRight,
  Search,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import type { Workflow as WorkflowType, Point } from '@/types';

const statusLabels: Record<string, string> = {
  normal: '正常',
  pending: '待处理',
  conflict: '有冲突',
  'pending-review': '待复核',
  'not-needed': '无需复核',
  approved: '已通过',
  rejected: '已驳回',
};

export default function Workflow() {
  const {
    workflows,
    points,
    checkDuplicateImport,
    completeStep1,
    completeStep2,
    completeStep3,
  } = useStore();

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    workflows[0]?.id || null
  );
  const [searchTerm, setSearchTerm] = useState('');

  const [busCardTime, setBusCardTime] = useState('');
  const [importSource, setImportSource] = useState('手工录入');
  const [batchId, setBatchId] = useState('');
  const [redLineNote, setRedLineNote] = useState('');

  const [dupCheckResult, setDupCheckResult] = useState<{
    checked: boolean;
    isDuplicate: boolean;
    isSameBatch: boolean;
    sameBatchCount: number;
    batchId: string;
    count: number;
    lastSource: string;
  } | null>(null);

  const [step2ConflictResult, setStep2ConflictResult] = useState<{
    checked: boolean;
    hasConflict: boolean;
    description: string;
  } | null>(null);

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.id === selectedWorkflowId) || null,
    [workflows, selectedWorkflowId]
  );

  const selectedPoint = useMemo<Point | undefined>(
    () => points.find((p) => p.id === selectedWorkflow?.pointId),
    [points, selectedWorkflow]
  );

  const filteredWorkflows = workflows.filter(
    (w) =>
      w.pointName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (points.find((p) => p.id === w.pointId)?.location || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const initializeFormFromWorkflow = (wf: WorkflowType) => {
    setBusCardTime(wf.stepData.step1?.busCardTime || '');
    setImportSource(wf.stepData.step1?.importSource || '手工录入');
    setBatchId('');
    setRedLineNote(wf.stepData.step2?.redLineNote || '');
    setDupCheckResult(null);
    setStep2ConflictResult(null);
  };

  const handleSelectWorkflow = (id: string) => {
    setSelectedWorkflowId(id);
    const wf = workflows.find((w) => w.id === id);
    if (wf) {
      initializeFormFromWorkflow(wf);
    }
  };

  const handleCheckDuplicate = () => {
    if (!selectedPoint || !busCardTime.trim()) return;
    const result = checkDuplicateImport(
      selectedPoint.id,
      busCardTime,
      batchId.trim() || undefined
    );
    setDupCheckResult({
      checked: true,
      isDuplicate: result.isDuplicate,
      isSameBatch: result.isSameBatch,
      sameBatchCount: result.sameBatchCount,
      batchId: result.batchId,
      count: result.count,
      lastSource: result.lastSource,
    });
  };

  const handleCompleteStep1 = () => {
    if (!selectedWorkflow || !busCardTime.trim()) return;
    const result = completeStep1(
      selectedWorkflow.id,
      busCardTime,
      importSource,
      batchId.trim() || undefined
    );
    setDupCheckResult({
      checked: true,
      isDuplicate: result.isDuplicate,
      isSameBatch: result.isSameBatch,
      sameBatchCount: result.sameBatchCount,
      batchId: result.batchId,
      count: result.duplicateCount,
      lastSource: selectedPoint?.lastImportSource || '',
    });
    setBatchId(result.batchId);
  };

  const handleCompleteStep2 = () => {
    if (!selectedWorkflow) return;
    const result = completeStep2(selectedWorkflow.id, redLineNote);
    setStep2ConflictResult({
      checked: true,
      hasConflict: result.hasConflict,
      description: result.conflictDescription,
    });
  };

  const handleCompleteStep3 = () => {
    if (!selectedWorkflow) return;
    completeStep3(selectedWorkflow.id);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      'in-progress': { label: '进行中', className: 'bg-blue-100 text-blue-700' },
      completed: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
      'pending-review': { label: '待复核', className: 'bg-amber-100 text-amber-700' },
    };
    const cfg = config[status] || config['in-progress'];
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>
        {cfg.label}
      </span>
    );
  };

  const getStepIcon = (step: number, currentStep: number) => {
    if (step < currentStep) {
      return <CheckCircle size={18} className="text-emerald-500" />;
    }
    if (step === currentStep) {
      return <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">{step}</div>;
    }
    return <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">{step}</div>;
  };

  const report = selectedWorkflow?.finalReport;
  const overallStatusColor = report?.overallConclusion.includes('待复核')
    ? 'error'
    : report?.overallConclusion.includes('冲突')
    ? 'warning'
    : 'pass';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">三步工作流</h2>
          <p className="text-sm text-slate-500 mt-1">
            导入公交数据 → 补录红线备注 → 更新点位清单，生成完整处理报告
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索点位..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-slate-500">共 {filteredWorkflows.length} 条流程</p>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredWorkflows.map((wf) => {
                const pt = points.find((p) => p.id === wf.pointId);
                return (
                  <button
                    key={wf.id}
                    onClick={() => handleSelectWorkflow(wf.id)}
                    className={cn(
                      'w-full p-4 text-left hover:bg-slate-50 transition-colors',
                      selectedWorkflowId === wf.id && 'bg-primary-50 border-l-4 border-l-primary-600'
                    )}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-primary-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm font-medium text-slate-800">{wf.pointName}</span>
                      </div>
                      {getStatusBadge(wf.status)}
                    </div>
                    {pt && (
                      <p className="text-xs text-slate-500 ml-6 mb-2">{pt.location}</p>
                    )}
                    <div className="ml-6 flex items-center gap-1">
                      {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                          {getStepIcon(s, wf.currentStep)}
                          {s < 3 && (
                            <ChevronRight
                              size={12}
                              className={cn(
                                'mx-0.5',
                                s < wf.currentStep ? 'text-emerald-400' : 'text-slate-300'
                              )}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
              {filteredWorkflows.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-400">暂无流程</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-8 space-y-6">
          {!selectedWorkflow ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-12 text-center">
              <Layers size={48} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">请从左侧选择一个工作流</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                      <MapPin size={22} className="text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{selectedWorkflow.pointName}</h3>
                      {selectedPoint && (
                        <p className="text-xs text-slate-500 mt-0.5">{selectedPoint.location}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(selectedWorkflow.status)}
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={12} />
                      创建于 {new Date(selectedWorkflow.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4">
                  {[
                    { num: 1, title: '导入公交数据', desc: '检查重复导入' },
                    { num: 2, title: '补录红线备注', desc: '检测时段冲突' },
                    { num: 3, title: '更新点位清单', desc: '生成处理报告' },
                  ].map((item) => (
                    <div
                      key={item.num}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg',
                        selectedWorkflow.currentStep === item.num && 'bg-primary-100 border border-primary-200',
                        selectedWorkflow.currentStep > item.num && 'bg-emerald-50 border border-emerald-200'
                      )}
                    >
                      {getStepIcon(item.num, selectedWorkflow.currentStep)}
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
"""

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"写入完成，共 {len(content)} 字符, {content.count(chr(10))} 行")
