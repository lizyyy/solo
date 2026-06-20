import { useState, useMemo } from 'react';
import { Bus, FileText, CheckCircle, AlertTriangle, Database, FileCheck, Layers, Hash, MapPin, User, Clock, ChevronRight, CheckSquare, ArrowRight, Search, AlertCircle, RefreshCw } from 'lucide-react';
import { useStore } from '@/store/useStore';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import type { Workflow as WorkflowType, Point } from '@/types';

const statusLabels: Record<string, string> = { normal: '正常', pending: '待处理', conflict: '有冲突', 'pending-review': '待复核', 'not-needed': '无需复核', approved: '已通过', rejected: '已驳回', 'in-progress': '进行中', completed: '已完成' };
const getStatusBadge = (s: string) => ({ normal: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700', conflict: 'bg-red-100 text-red-700', 'pending-review': 'bg-orange-100 text-orange-700' }[s] || 'bg-gray-100 text-gray-700');

export default function Workflow() {
  const { workflows, points, checkDuplicateImport, completeStep1, completeStep2, completeStep3 } = useStore();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [busCardTime, setBusCardTime] = useState('');
  const [importSource, setImportSource] = useState('');
  const [batchId, setBatchId] = useState('');
  const [redLineNote, setRedLineNote] = useState('');
  const [dupCheckResult, setDupCheckResult] = useState<any>(null);
  const [step2ConflictResult, setStep2ConflictResult] = useState<any>(null);
  const [step3Result, setStep3Result] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredWorkflows = useMemo(() => workflows.filter(w => w.pointName.toLowerCase().includes(searchTerm.toLowerCase())), [workflows, searchTerm]);
  const selectedWorkflow = useMemo(() => workflows.find(w => w.id === selectedWorkflowId) || null, [workflows, selectedWorkflowId]);
  const point = useMemo(() => selectedWorkflow ? points.find(p => p.id === selectedWorkflow.pointId) || null : null, [selectedWorkflow, points]);
  const currentStep = selectedWorkflow?.currentStep || 1;
  const stepData = selectedWorkflow?.stepData;

  const handleSelectWorkflow = (w: WorkflowType) => {
    setSelectedWorkflowId(w.id);
    setDupCheckResult(null);
    setStep2ConflictResult(null);
    setStep3Result(null);
    setBusCardTime(w.stepData?.step1?.busCardTime || '');
    setImportSource(w.stepData?.step1?.importSource || '');
    setBatchId(w.stepData?.step1?.batchId || '');
    setRedLineNote(w.stepData?.step2?.redLineNote || '');
  };

  const handleCheckDuplicate = () => {
    if (!point || !busCardTime.trim()) return;
    setDupCheckResult(checkDuplicateImport(point.id, busCardTime.trim(), batchId.trim() || undefined));
  };

  const handleCompleteStep1 = () => {
    if (!selectedWorkflow || !busCardTime.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      const r = completeStep1(selectedWorkflow.id, busCardTime.trim(), importSource.trim() || undefined, batchId.trim() || undefined);
      setBatchId(r.batchId);
      setIsProcessing(false);
    }, 300);
  };

  const handleCompleteStep2 = () => {
    if (!selectedWorkflow || !redLineNote.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      setStep2ConflictResult(completeStep2(selectedWorkflow.id, redLineNote.trim()));
      setIsProcessing(false);
    }, 300);
  };

  const handleCompleteStep3 = () => {
    if (!selectedWorkflow) return;
    setIsProcessing(true);
    setTimeout(() => {
      setStep3Result(completeStep3(selectedWorkflow.id));
      setIsProcessing(false);
    }, 300);
  };

  const renderDupResult = () => {
    if (!dupCheckResult) return null;
    const { isSameBatch, isDuplicate, sameBatchCount, batchId: bid, lastSource } = dupCheckResult;
    if (isSameBatch && isDuplicate) return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800"><span className="font-mono font-medium">{bid}</span><span className="ml-2">第 {sameBatchCount} 次重传</span><p className="mt-1">同一批次重传，系统自动去重，数据未翻倍</p></div>
      </div>
    );
    if (!isSameBatch && bid) return (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">不同来源批次（{lastSource || '新来源'}），未拦截，作为新数据导入</div>
      </div>
    );
    return (
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-emerald-800">首次导入，无重复</div>
      </div>
    );
  };

  const renderFinalReport = (report: any) => {
    const overallColor = report.overallStatus === 'pass' ? 'border-emerald-300 bg-emerald-50' : report.overallStatus === 'error' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50';
    const iconColor = report.overallStatus === 'pass' ? 'text-emerald-600' : report.overallStatus === 'error' ? 'text-red-600' : 'text-amber-600';
    const OverallIcon = report.overallStatus === 'pass' ? CheckCircle : report.overallStatus === 'error' ? AlertCircle : AlertTriangle;
    return (
      <div className="mt-6">
        <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileCheck className="w-5 h-5" />最终报告</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3"><Database className="w-5 h-5 text-blue-600" /><h5 className="font-medium text-gray-900">重复导入检测</h5></div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">批次ID</span><span className="font-mono text-gray-900">{report.duplicateCheck.batchId || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">来源</span><span className="text-gray-900">{report.duplicateCheck.batchSource || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">导入次数</span><span className="text-gray-900">{report.duplicateCheck.count || 1}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">是否重复</span><span className={cn('font-medium', report.duplicateCheck.passed ? 'text-emerald-600' : 'text-amber-600')}>{report.duplicateCheck.passed ? '否' : '是'}</span></div>
              {!report.duplicateCheck.passed && <p className="text-xs text-amber-600 mt-2 pt-2 border-t border-amber-100">同一批次重传 {report.duplicateCheck.count || 1} 次，已自动去重，数据未翻倍</p>}
            </div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5 text-orange-600" /><h5 className="font-medium text-gray-900">施工改道同步</h5></div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">是否有改道</span><span className={cn('font-medium', report.detourSync.passed ? 'text-emerald-600' : 'text-red-600')}>{report.detourSync.passed ? '否' : '是'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">改道来源</span><span className="text-gray-900">{report.detourSync.source || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">同步状态</span><span className={cn('font-medium', report.detourSync.passed ? 'text-emerald-600' : 'text-red-600')}>{report.detourSync.passed ? '已同步' : '未同步'}</span></div>
              {!report.detourSync.passed && <p className="text-xs text-red-600 mt-2 pt-2 border-t border-red-100">待居民代表复核，不归为正常</p>}
            </div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3"><FileText className="w-5 h-5 text-purple-600" /><h5 className="font-medium text-gray-900">补录后重算</h5></div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">备注补录</span><span className={cn('font-medium', report.supplementRecalc.passed ? 'text-emerald-600' : 'text-amber-600')}>{report.supplementRecalc.passed ? '已补录' : '待补录'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">时段冲突</span><span className={cn('font-medium', report.supplementRecalc.hasConflict ? 'text-red-600' : 'text-emerald-600')}>{report.supplementRecalc.hasConflict ? '检测到' : '未检测到'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">统计重算</span><span className="text-emerald-600 font-medium">已自动重算</span></div>
            </div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3"><FileCheck className="w-5 h-5 text-teal-600" /><h5 className="font-medium text-gray-900">导出一致性</h5></div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-600">来源批次</span><CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" /></div>
              <div className="flex items-center gap-2"><Hash className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-600">导入次数</span><CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" /></div>
              <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-600">点位状态</span><CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" /></div>
              <div className="flex items-center gap-2"><CheckSquare className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-600">复核状态</span><CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" /></div>
              <div className="flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-600">改道信息</span><CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" /></div>
            </div>
          </div>
        </div>
        <div className={cn('border-2 rounded-2xl p-6 mt-6', overallColor)}>
          <div className="flex items-start gap-4">
            <OverallIcon className={cn('w-14 h-14 flex-shrink-0', iconColor)} />
            <div className="flex-1">
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">{report.overallConclusion}</h3>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1.5"><span className="text-gray-600">最终点位状态：</span><span className={cn('font-medium px-2 py-0.5 rounded', getStatusBadge(report.finalPointStatus || ''))}>{statusLabels[report.finalPointStatus || ''] || report.finalPointStatus}</span></div>
                <div className="flex items-center gap-1.5"><span className="text-gray-600">复核状态：</span><span className="font-medium text-gray-900">{statusLabels[report.finalReviewStatus || ''] || report.finalReviewStatus}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      <div className="col-span-4 flex flex-col h-full">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">流程列表</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="搜索点位名称..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredWorkflows.map((w) => {
            const p = points.find(pp => pp.id === w.pointId);
            return (
              <div key={w.id} onClick={() => handleSelectWorkflow(w)} className={cn('p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md', selectedWorkflowId === w.id ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300')}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-500" /><h3 className="font-medium text-gray-900">{w.pointName}</h3></div>
                  {p && <StatusBadge status={p.status} />}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3" />步骤 {w.currentStep}/3</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(w.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="col-span-8 flex flex-col h-full overflow-y-auto">
        {!selectedWorkflow ? (
          <div className="flex-1 flex items-center justify-center text-gray-400"><div className="text-center"><FileText className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>请从左侧选择一个流程</p></div></div>
        ) : (
          <div className="space-y-6 pb-6">
            {point && (
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><MapPin className="w-5 h-5 text-blue-600" /></div>
                    <div><h2 className="text-lg font-semibold text-gray-900">{point.name}</h2><p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{point.location}</p></div>
                  </div>
                  <StatusBadge status={point.status} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between px-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors', currentStep > step ? 'bg-emerald-500 text-white' : currentStep === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-gray-200 text-gray-500')}>
                      {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                    </div>
                    <span className={cn('mt-2 text-xs font-medium', currentStep >= step ? 'text-gray-900' : 'text-gray-400')}>{step === 1 ? '导入时段' : step === 2 ? '补录备注' : '生成报告'}</span>
                  </div>
                  {step < 3 && <div className={cn('w-24 h-0.5 mx-2', currentStep > step ? 'bg-emerald-500' : 'bg-gray-200')} />}
                </div>
              ))}
            </div>
            {currentStep === 1 && (
              <div className="space-y-6">
                <div><h3 className="text-lg font-semibold text-gray-900 mb-1">步骤 1：导入公交刷卡时段</h3><p className="text-sm text-gray-500">录入公交刷卡时段并检测重复导入</p></div>
                <div className="space-y-4">
                  <div><label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5"><Bus className="w-4 h-4" />公交时段</label><textarea value={busCardTime} onChange={(e) => setBusCardTime(e.target.value)} placeholder="如：早高峰 7:00-9:00，晚高峰 17:00-19:00" rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" /></div>
                  <div><label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5"><Database className="w-4 h-4" />数据来源</label><input type="text" value={importSource} onChange={(e) => setImportSource(e.target.value)} placeholder="如：公交公司数据科" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div>
                  <div><label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5"><Layers className="w-4 h-4" />批次ID</label><div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="留空自动生成新批次；填写与历史相同则判定同一批重传" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div></div>
                  <div className="flex gap-3">
                    <button onClick={handleCheckDuplicate} disabled={!busCardTime.trim() || isProcessing} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"><Search className="w-4 h-4" />检测重复</button>
                    <button onClick={handleCompleteStep1} disabled={!busCardTime.trim() || isProcessing} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">{isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}确认并完成第一步</button>
                  </div>
                  {dupCheckResult && renderDupResult()}
                </div>
              </div>
            )}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div><h3 className="text-lg font-semibold text-gray-900 mb-1">步骤 2：补看红线图备注</h3><p className="text-sm text-gray-500">补录红线图备注并检测冲突</p></div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200"><p className="text-sm font-medium text-gray-700 mb-2">已导入公交时段</p><p className="text-sm text-gray-900">{stepData?.step1?.busCardTime || "-"}</p>{stepData?.step1?.isDuplicate && <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />存在重复导入，系统已自动去重</p>}</div>
                <div className="space-y-4">
                  <div><label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5"><FileText className="w-4 h-4" />红线图备注</label><textarea value={redLineNote} onChange={(e) => setRedLineNote(e.target.value)} placeholder="如：7:00-8:00 禁止停靠；17:30-18:30 禁设站点" rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" /></div>
                  <div><label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5"><User className="w-4 h-4" />修改原因（可选）</label><input type="text" placeholder="如：最新红线图更新" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div>
                  <button onClick={handleCompleteStep2} disabled={!redLineNote.trim() || isProcessing} className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">{isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}补录并检测冲突</button>
                  {step2ConflictResult && (
                    <div className={cn('p-3 rounded-lg flex items-start gap-2', step2ConflictResult.hasConflict ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200')}>
                      {step2ConflictResult.hasConflict ? <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />}
                      <div className={cn('text-sm', step2ConflictResult.hasConflict ? 'text-red-800' : 'text-emerald-800')}>{step2ConflictResult.hasConflict ? step2ConflictResult.conflictDescription : '未检测到公交时段与红线备注冲突'}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div><h3 className="text-lg font-semibold text-gray-900 mb-1">步骤 3：更新点位清单并生成最终报告</h3><p className="text-sm text-gray-500">确认信息无误后执行更新</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl"><div className="flex items-center gap-2 mb-2"><Bus className="w-4 h-4 text-blue-600" /><span className="text-sm font-medium text-blue-900">公交时段</span></div><p className="text-sm text-blue-800">{stepData?.step1?.busCardTime || '-'}</p></div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl"><div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-purple-600" /><span className="text-sm font-medium text-purple-900">红线备注</span></div><p className="text-sm text-purple-800">{stepData?.step2?.redLineNote || '-'}</p></div>
                </div>
                {point?.hasConstructionDetour && !point.mapSynced && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" /><div><p className="text-sm font-medium text-orange-900">施工改道未同步</p><p className="text-xs text-orange-700 mt-1">该点位存在施工改道但地图未同步，不归为正常，待居民代表复核</p></div></div>
                )}
                {!selectedWorkflow.finalReport && (
                  <button onClick={handleCompleteStep3} disabled={isProcessing} className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">{isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}执行更新并生成最终报告</button>
                )}
                {selectedWorkflow.finalReport && renderFinalReport(selectedWorkflow.finalReport)}
                {selectedWorkflow.status === 'pending-review' && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3"><AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" /><div><p className="text-sm font-medium text-orange-900">流程待复核</p><p className="text-xs text-orange-700 mt-0.5">该点位存在待复核事项，已转交居民代表处理</p></div></div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-600">改道信息</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
              </div>
            </div>
          </div>
        </div>

        <div className={cn('border-2 rounded-2xl p-6 mt-6', overallColor)}>
          <div className="flex items-start gap-4">
            <OverallIcon className={cn('w-14 h-14 flex-shrink-0', iconColor)} />
            <div className="flex-1">
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">{report.overallConclusion}</h3>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600">最终点位状态：</span>
                  <span className={cn('font-medium px-2 py-0.5 rounded', getStatusBadge(report.finalPointStatus || ''))}>
                    {statusLabels[report.finalPointStatus || ''] || report.finalPointStatus}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600">复核状态：</span>
                  <span className="font-medium text-gray-900">
                    {statusLabels[report.finalReviewStatus || ''] || report.finalReviewStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      <div className="col-span-4 flex flex-col h-full">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">流程列表</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索点位名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredWorkflows.map((w) => {
            const p = points.find(pp => pp.id === w.pointId);
            return (
              <div
                key={w.id}
                onClick={() => handleSelectWorkflow(w)}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md',
                  selectedWorkflowId === w.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <h3 className="font-medium text-gray-900">{w.pointName}</h3>
                  </div>
                  {p && <StatusBadge status={p.status} />}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    步骤 {w.currentStep}/3
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(w.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="col-span-8 flex flex-col h-full overflow-y-auto">
        {!selectedWorkflow ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>请从左侧选择一个流程</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-6">
            {point && (
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{point.name}</h2>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {point.location}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={point.status} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors',
                      currentStep > step
                        ? 'bg-emerald-500 text-white'
                        : currentStep === step
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-gray-200 text-gray-500'
                    )}>
                      {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                    </div>
                    <span className={cn(
                      'mt-2 text-xs font-medium',
                      currentStep >= step ? 'text-gray-900' : 'text-gray-400'
                    )}>
                      {step === 1 ? '导入时段' : step === 2 ? '补录备注' : '生成报告'}
                    </span>
                  </div>
                  {step < 3 && (
                    <div className={cn(
                      'w-24 h-0.5 mx-2',
                      currentStep > step ? 'bg-emerald-500' : 'bg-gray-200'
                    )} />
                  )}
                </div>
              ))}
            </div>

            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">步骤 1：导入公交刷卡时段</h3>
                  <p className="text-sm text-gray-500">录入公交刷卡时段并检测重复导入</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Bus className="w-4 h-4" />
                      公交时段
                    </label>
                    <textarea
                      value={busCardTime}
                      onChange={(e) => setBusCardTime(e.target.value)}
                      placeholder="如：早高峰 7:00-9:00，晚高峰 17:00-19:00"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Database className="w-4 h-4" />
                      数据来源
                    </label>
                    <input
                      type="text"
                      value={importSource}
                      onChange={(e) => setImportSource(e.target.value)}
                      placeholder="如：公交公司数据科"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Layers className="w-4 h-4" />
                      批次ID
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={batchId}
                        onChange={(e) => setBatchId(e.target.value)}
                        placeholder="留空自动生成新批次；填写与历史相同则判定同一批重传"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCheckDuplicate}
                      disabled={!busCardTime.trim() || isProcessing}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <Search className="w-4 h-4" />
                      检测重复
                    </button>
                    <button
                      onClick={handleCompleteStep1}
                      disabled={!busCardTime.trim() || isProcessing}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      确认并完成第一步
                    </button>
                  </div>

                  {dupCheckResult && renderDupResult()}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">步骤 2：补看红线图备注</h3>
                  <p className="text-sm text-gray-500">补录红线图备注并检测冲突</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">已导入公交时段</p>
                  <p className="text-sm text-gray-900">{stepData?.step1?.busCardTime || "-"}</p>
                  {stepData?.step1?.isDuplicate && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      存在重复导入，系统已自动去重
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <FileText className="w-4 h-4" />
                      红线图备注
                    </label>
                    <textarea
                      value={redLineNote}
                      onChange={(e) => setRedLineNote(e.target.value)}
                      placeholder="如：7:00-8:00 禁止停靠；17:30-18:30 禁设站点"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <User className="w-4 h-4" />
                      修改原因（可选）
                    </label>
                    <input
                      type="text"
                      placeholder="如：最新红线图更新"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={handleCompleteStep2}
                    disabled={!redLineNote.trim() || isProcessing}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckSquare className="w-4 h-4" />
                    )}
                    补录并检测冲突
                  </button>

                  {step2ConflictResult && (
                    <div className={cn(
                      'p-3 rounded-lg flex items-start gap-2',
                      step2ConflictResult.hasConflict
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-emerald-50 border border-emerald-200'
                    )}>
                      {step2ConflictResult.hasConflict ? (
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className={cn(
                        'text-sm',
                        step2ConflictResult.hasConflict ? 'text-red-800' : 'text-emerald-800'
                      )}>
                        {step2ConflictResult.hasConflict
                          ? step2ConflictResult.conflictDescription
                          : '未检测到公交时段与红线备注冲突'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">步骤 3：更新点位清单并生成最终报告</h3>
                  <p className="text-sm text-gray-500">确认信息无误后执行更新</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Bus className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">公交时段</span>
                    </div>
                    <p className="text-sm text-blue-800">{stepData?.step1?.busCardTime || '-'}</p>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">红线备注</span>
                    </div>
                    <p className="text-sm text-purple-800">{stepData?.step2?.redLineNote || '-'}</p>
                  </div>
                </div>

                {point?.hasConstructionDetour && !point.mapSynced && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-900">施工改道未同步</p>
                      <p className="text-xs text-orange-700 mt-1">该点位存在施工改道但地图未同步，不归为正常，待居民代表复核</p>
                    </div>
                  </div>
                )}

                {!selectedWorkflow.finalReport && (
                  <button
                    onClick={handleCompleteStep3}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    执行更新并生成最终报告
                  </button>
                )}

                {selectedWorkflow.finalReport && renderFinalReport(selectedWorkflow.finalReport)}

                {selectedWorkflow.status === 'pending-review' && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-900">流程待复核</p>
                      <p className="text-xs text-orange-700 mt-0.5">该点位存在待复核事项，已转交居民代表处理</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
                <span className="text-gray-600">复核状态</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-600">改道信息</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
              </div>
            </div>
          </div>
        </div>

        <div className={cn('border-2 rounded-2xl p-6 mt-6', overallColor)}>
          <div className="flex items-start gap-4">
            <OverallIcon className={cn('w-14 h-14 flex-shrink-0', iconColor)} />
            <div className="flex-1">
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">{report.overallConclusion}</h3>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600">最终点位状态：</span>
                  <span className={cn('font-medium px-2 py-0.5 rounded', getStatusBadge(report.finalPointStatus || ''))}>
                    {statusLabels[report.finalPointStatus || ''] || report.finalPointStatus}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600">复核状态：</span>
                  <span className="font-medium text-gray-900">
                    {statusLabels[report.finalReviewStatus || ''] || report.finalReviewStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      <div className="col-span-4 flex flex-col h-full">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">流程列表</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索点位名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredWorkflows.map((w) => {
            const p = points.find(pp => pp.id === w.pointId);
            return (
              <div
                key={w.id}
                onClick={() => handleSelectWorkflow(w)}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md',
                  selectedWorkflowId === w.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <h3 className="font-medium text-gray-900">{w.pointName}</h3>
                  </div>
                  {p && <StatusBadge status={p.status} />}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    步骤 {w.currentStep}/3
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(w.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="col-span-8 flex flex-col h-full overflow-y-auto">
        {!selectedWorkflow ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>请从左侧选择一个流程</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-6">
            {point && (
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{point.name}</h2>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {point.location}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={point.status} />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors',
                      currentStep > step
                        ? 'bg-emerald-500 text-white'
                        : currentStep === step
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-gray-200 text-gray-500'
                    )}>
                      {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                    </div>
                    <span className={cn(
                      'mt-2 text-xs font-medium',
                      currentStep >= step ? 'text-gray-900' : 'text-gray-400'
                    )}>
                      {step === 1 ? '导入时段' : step === 2 ? '补录备注' : '生成报告'}
                    </span>
                  </div>
                  {step < 3 && (
                    <div className={cn(
                      'w-24 h-0.5 mx-2',
                      currentStep > step ? 'bg-emerald-500' : 'bg-gray-200'
                    )} />
                  )}
                </div>
              ))}
            </div>

            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">步骤 1：导入公交刷卡时段</h3>
                  <p className="text-sm text-gray-500">录入公交刷卡时段并检测重复导入</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Bus className="w-4 h-4" />
                      公交时段
                    </label>
                    <textarea
                      value={busCardTime}
                      onChange={(e) => setBusCardTime(e.target.value)}
                      placeholder="如：早高峰 7:00-9:00，晚高峰 17:00-19:00"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Database className="w-4 h-4" />
                      数据来源
                    </label>
                    <input
                      type="text"
                      value={importSource}
                      onChange={(e) => setImportSource(e.target.value)}
                      placeholder="如：公交公司数据科"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <Layers className="w-4 h-4" />
                      批次ID
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={batchId}
                        onChange={(e) => setBatchId(e.target.value)}
                        placeholder="留空自动生成新批次；填写与历史相同则判定同一批重传"
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCheckDuplicate}
                      disabled={!busCardTime.trim() || isProcessing}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <Search className="w-4 h-4" />
                      检测重复
                    </button>
                    <button
                      onClick={handleCompleteStep1}
                      disabled={!busCardTime.trim() || isProcessing}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      确认并完成第一步
                    </button>
                  </div>

                  {dupCheckResult && renderDupResult()}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">步骤 2：补看红线图备注</h3>
                  <p className="text-sm text-gray-500">补录红线图备注并检测冲突</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">已导入公交时段</p>
                  <p className="text-sm text-gray-900">{stepData?.step1?.busCardTime || "-"}</p>
                  {stepData?.step1?.isDuplicate && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      存在重复导入，系统已自动去重
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <FileText className="w-4 h-4" />
                      红线图备注
                    </label>
                    <textarea
                      value={redLineNote}
                      onChange={(e) => setRedLineNote(e.target.value)}
                      placeholder="如：7:00-8:00 禁止停靠；17:30-18:30 禁设站点"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                      <User className="w-4 h-4" />
                      修改原因（可选）
                    </label>
                    <input
                      type="text"
                      placeholder="如：最新红线图更新"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={handleCompleteStep2}
                    disabled={!redLineNote.trim() || isProcessing}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckSquare className="w-4 h-4" />
                    )}
                    补录并检测冲突
                  </button>

                  {step2ConflictResult && (
                    <div className={cn(
                      'p-3 rounded-lg flex items-start gap-2',
                      step2ConflictResult.hasConflict
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-emerald-50 border border-emerald-200'
                    )}>
                      {step2ConflictResult.hasConflict ? (
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className={cn(
                        'text-sm',
                        step2ConflictResult.hasConflict ? 'text-red-800' : 'text-emerald-800'
                      )}>
                        {step2ConflictResult.hasConflict
                          ? step2ConflictResult.conflictDescription
                          : '未检测到公交时段与红线备注冲突'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">步骤 3：更新点位清单并生成最终报告</h3>
                  <p className="text-sm text-gray-500">确认信息无误后执行更新</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Bus className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">公交时段</span>
                    </div>
                    <p className="text-sm text-blue-800">{stepData?.step1?.busCardTime || '-'}</p>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">红线备注</span>
                    </div>
                    <p className="text-sm text-purple-800">{stepData?.step2?.redLineNote || '-'}</p>
                  </div>
                </div>

                {point?.hasConstructionDetour && !point.mapSynced && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-900">施工改道未同步</p>
                      <p className="text-xs text-orange-700 mt-1">该点位存在施工改道但地图未同步，不归为正常，待居民代表复核</p>
                    </div>
                  </div>
                )}

                {!selectedWorkflow.finalReport && (
                  <button
                    onClick={handleCompleteStep3}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    执行更新并生成最终报告
                  </button>
                )}

                {selectedWorkflow.finalReport && renderFinalReport(selectedWorkflow.finalReport)}

                {selectedWorkflow.status === 'pending-review' && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-orange-900">流程待复核</p>
                      <p className="text-xs text-orange-700 mt-0.5">该点位存在待复核事项，已转交居民代表处理</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        批次ID <span className="text-slate-400 font-normal text-xs">（可选，留空自动生成）</span>
                      </label>
                      <div className="relative">
                        <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text" value={batchId}
                          onChange={(e) => setBatchId(e.target.value)}
                          placeholder="填写相同ID判定为同批重传"
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">留空自动生成新批次，填写相同ID判定为同批重传</p>
                    </div>

                    <button
                      onClick={handleCheckDuplicate}
                      disabled={!busCardTime}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw size={14} />检测重复
                    </button>

                    {renderDupeAlert()}

                    <div className="pt-2">
                      <button
                        onClick={handleStep1Next}
                        disabled={!busCardTime}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一步 <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-4 max-w-lg">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-700 mb-1">
                        <Bus size={16} />
                        <span className="text-sm font-medium">已导入公交时段</span>
                      </div>
                      <p className="text-sm text-blue-600">{selected.stepData.step1?.busCardTime}</p>
                      {selected.stepData.step1?.isDuplicate && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          同一批次重传，已自动去重
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        红线图备注 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={redLineNote}
                        onChange={(e) => setRedLineNote(e.target.value)}
                        placeholder="输入红线图备注内容..."
                        rows={4}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">修改原因</label>
                      <input
                        type="text" value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="请输入修改原因（可选）"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    {conflictResult && conflictResult.hasConflict && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700 mb-1">
                          <AlertTriangle size={16} />
                          <span className="text-sm font-medium">检测到冲突</span>
                        </div>
                        <p className="text-xs text-red-600">{conflictResult.description}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => {}}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                      >
                        <ChevronLeft size={16} />上一步
                      </button>
                      <button
                        onClick={handleStep2Next}
                        disabled={!redLineNote}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一步 <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 text-blue-700 mb-2">
                          <Bus size={16} />
                          <span className="text-sm font-medium">公交时段</span>
                        </div>
                        <p className="text-sm text-blue-800">{selected.stepData.step1?.busCardTime || '—'}</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="flex items-center gap-2 text-purple-700 mb-2">
                          <FileText size={16} />
                          <span className="text-sm font-medium">红线备注</span>
                        </div>
                        <p className="text-sm text-purple-800">{selected.stepData.step2?.redLineNote || '—'}</p>
                      </div>
                    </div>

                    {selected.status === 'pending-review' && (
                      <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-700">
                          <AlertTriangle size={20} />
                          <span className="font-semibold">不归正常</span>
                        </div>
                        <p className="text-sm text-amber-600 mt-1">施工改道未同步，需待居民代表复核后归位正常</p>
                      </div>
                    )}

                    {finalReport && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                          <FileCheck size={16} className="text-primary-500" />最终处理报告
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-slate-600">重复导入检测</span>
                              {finalReport.duplicateCheck.passed ? (
                                <CheckCircle size={14} className="text-emerald-500" />
                              ) : (
                                <AlertTriangle size={14} className="text-amber-500" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{finalReport.duplicateCheck.detail}</p>
                            {finalReport.duplicateCheck.batchId && (
                              <p className="text-xs text-slate-400 mt-1">
                                批次：<span className="font-mono">{finalReport.duplicateCheck.batchId}</span>
                                {' · '}{finalReport.duplicateCheck.batchSource}
                                {' · '}{finalReport.duplicateCheck.count}次
                              </p>
                            )}
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-slate-600">施工改道同步</span>
                              {finalReport.detourSync.passed ? (
                                <CheckCircle size={14} className="text-emerald-500" />
                              ) : (
                                <AlertCircle size={14} className="text-red-500" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{finalReport.detourSync.detail}</p>
                            <p className="text-xs text-slate-400 mt-1">来源：{finalReport.detourSync.source}</p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-slate-600">补录后重算</span>
                              {finalReport.supplementRecalc.passed ? (
                                <CheckCircle size={14} className="text-emerald-500" />
                              ) : (
                                <AlertTriangle size={14} className="text-amber-500" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{finalReport.supplementRecalc.detail}</p>
                            {finalReport.supplementRecalc.hasConflict && (
                              <p className="text-xs text-amber-500 mt-1">冲突状态：存在冲突</p>
                            )}
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-slate-600">导出一致性</span>
                              {finalReport.exportConsistent.passed ? (
                                <CheckCircle size={14} className="text-emerald-500" />
                              ) : (
                                <AlertCircle size={14} className="text-red-500" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{finalReport.exportConsistent.detail}</p>
                            <p className="text-xs text-slate-400 mt-1">导出字段：点位名称、公交时段、红线备注、状态</p>
                          </div>
                        </div>

                        <div className={cn(
                          'p-4 rounded-lg border-2',
                          overallStatusConfig[finalReport.overallStatus || 'pass'].className
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            {(() => {
                              const cfg = overallStatusConfig[finalReport.overallStatus || 'pass'];
                              const Icon = cfg.icon;
                              return <Icon size={20} />;
                            })()}
                            <span className="font-semibold">整体结论</span>
                          </div>
                          <p className="text-sm mb-3">{finalReport.overallConclusion}</p>
                          <div className="flex items-center gap-4 text-xs">
                            <span>最终点位状态：<span className="font-medium">{finalReport.finalPointStatus}</span></span>
                            <span>复核状态：<span className="font-medium">{finalReport.finalReviewStatus}</span></span>
                          </div>
                        </div>
                      </div>
                    )}

                    {selected.status !== 'completed' && selected.status !== 'pending-review' && (
                      <div className="pt-2">
                        <button
                          onClick={handleStep3Complete}
                          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600"
                        >
                          <CheckCircle size={16} />完成更新
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selected.status === 'pending-review' && (
                <div className="p-3 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
                  <Clock size={16} className="text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-amber-700">
                    待居民代表复核施工改道同步情况，复核通过后点位自动归正常
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[calc(100vh-220px)] flex items-center justify-center text-slate-400">
              <div className="text-center">
                <FileText size={48} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">请选择一个工作流</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
