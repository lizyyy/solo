#!/usr/bin/env python3
# -*- coding: utf-8 -*-

content = r'''import { useState } from 'react';
import {
  Workflow, Bus, FileText, MapPin, ChevronRight, ChevronLeft,
  Check, AlertTriangle, CheckCircle, Upload, XCircle, FileCheck,
  AlertCircle, RefreshCw, Layers, Hash, Clock, Database, User, Search
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import type { Workflow as WorkflowType } from '@/types';

const steps = [
  { step: 1, title: '导入公交刷卡时段', description: '上传或录入公交刷卡时段数据', icon: Bus },
  { step: 2, title: '补看红线图备注', description: '对照红线图补充备注信息', icon: FileText },
  { step: 3, title: '更新点位清单', description: '确认后更新点位清单数据', icon: MapPin },
];

const statusLabels: Record<string, string> = {
  normal: '正常', pending: '待处理', conflict: '有冲突',
  'pending-review': '待复核', 'not-needed': '无需复核',
  approved: '已通过', rejected: '已驳回',
  'in-progress': '进行中', completed: '已完成',
};

const wsBadge: Record<string, string> = {
  'in-progress': 'bg-blue-100 text-blue-700',
  'pending-review': 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

const ptBadge: Record<string, string> = {
  normal: 'bg-emerald-100 text-emerald-700',
  conflict: 'bg-red-100 text-red-700',
  'pending-review': 'bg-amber-100 text-amber-700',
  pending: 'bg-slate-100 text-slate-700',
};

export default function WorkflowPage() {
  const { workflows, points, checkDuplicateImport, completeStep1,
    completeStep2, completeStep3 } = useStore();

  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(
    workflows.find((w) => w.status === 'in-progress')?.id || null
  );
  const [busCardTime, setBusCardTime] = useState('');
  const [importSource, setImportSource] = useState('公交公司数据批次2026-06-B');
  const [batchId, setBatchId] = useState('');
  const [redLineNote, setRedLineNote] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [showDuplicateHint, setShowDuplicateHint] = useState<any>(null);
  const [stepResult, setStepResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const wf = workflows.find((w) => w.id === selectedWorkflow) || null;
  const pt = wf ? points.find((p) => p.id === wf.pointId) : null;
  const cs = wf?.currentStep || 1;
  const fr = wf?.finalReport;
  const detourWarn = pt?.hasConstructionDetour && !pt?.mapSynced;

  const getStatusBadge = (status: string) => {
    const cls = wsBadge[status] || 'bg-slate-100 text-slate-700';
    return cn('px-2 py-0.5 rounded text-xs font-medium', cls);
  };

  const getCheckIcon = (passed: boolean) => passed
    ? <CheckCircle className='w-4 h-4 text-emerald-600' />
    : <AlertTriangle className='w-4 h-4 text-amber-600' />;

  const handleSelect = (id: string) => {
    const w = workflows.find((x) => x.id === id);
    setSelectedWorkflow(id);
    setBusCardTime(w?.stepData.step1?.busCardTime || '');
    setRedLineNote(w?.stepData.step2?.redLineNote || '');
    setImportSource(w?.stepData.step1?.importSource || '公交公司数据批次2026-06-B');
    setBatchId('');
    setShowDuplicateHint(null);
    setStepResult(null);
  };

  const handleCheckDup = () => {
    if (!pt || !busCardTime.trim()) return;
    setShowDuplicateHint(checkDuplicateImport(pt.id, busCardTime, batchId.trim() || undefined));
  };

  const handleStep1 = () => {
    if (!wf || !busCardTime.trim()) return;
    setIsProcessing(true);
    const result = completeStep1(wf.id, busCardTime, importSource, batchId.trim() || undefined);
    setShowDuplicateHint(result);
    setIsProcessing(false);
  };

  const handleStep2 = () => {
    if (!wf) return;
    setIsProcessing(true);
    const result = completeStep2(wf.id, redLineNote, changeReason || undefined);
    setStepResult(result);
    setIsProcessing(false);
  };

  const handleStep3 = () => {
    if (!wf) return;
    setIsProcessing(true);
    const result = completeStep3(wf.id);
    setStepResult(result);
    setIsProcessing(false);
  };

  const backToList = () => {
    setSelectedWorkflow(null);
    setStepResult(null);
    setShowDuplicateHint(null);
  };

  const StepCard = ({ n, done, active, title, desc, icon: I, children }: any) => (
    <div className={cn(
      'bg-white rounded-xl border shadow-sm p-5',
      cs === n && wf?.status !== 'completed' ? 'border-slate-200' : 'border-slate-100',
      cs < n && 'opacity-70'
    )}>
      <div className='flex items-center gap-2 mb-4'>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
          n === 1 ? 'bg-blue-100' : n === 2 ? 'bg-amber-100' : 'bg-emerald-100')}>
          <I className={cn('w-4 h-4',
            n === 1 ? 'text-blue-600' : n === 2 ? 'text-amber-600' : 'text-emerald-600')} />
        </div>
        <div>
          <h3 className='font-bold text-slate-900'>第{n}步：{title}</h3>
          <p className='text-xs text-slate-500'>{desc}</p>
        </div>
        {done && <CheckCircle className='w-5 h-5 text-emerald-500 ml-auto' />}
      </div>
      {children}
    </div>
  );

  const renderDuplicateHint = () => {
    if (!showDuplicateHint) return null;
    const isSameBatch = showDuplicateHint.isSameBatch;
    const isDup = showDuplicateHint.isDuplicate;
    const colors = isSameBatch
      ? { bg: 'bg-amber-50', bd: 'border-amber-200', icBg: 'bg-amber-100', ic: 'text-amber-600', tx: 'text-amber-800' }
      : isDup
        ? { bg: 'bg-blue-50', bd: 'border-blue-200', icBg: 'bg-blue-100', ic: 'text-blue-600', tx: 'text-blue-800' }
        : { bg: 'bg-emerald-50', bd: 'border-emerald-200', icBg: 'bg-emerald-100', ic: 'text-emerald-600', tx: 'text-emerald-800' };
    const Icon = isSameBatch ? AlertCircle : isDup ? Layers : CheckCircle;
    const text = isSameBatch
      ? `同一批次重传（${showDuplicateHint.batchId}），第${showDuplicateHint.sameBatchCount || 1}次导入，系统自动去重，数据不翻倍`
      : isDup
        ? '不同批次，正常导入，不拦截'
        : '首次导入成功';
    return (
      <div className={cn('rounded-lg border p-4', colors.bg, colors.bd)}>
        <div className='flex items-start gap-3'>
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', colors.icBg)}>
            <Icon className={cn('w-4 h-4', colors.ic)} />
          </div>
          <p className={cn('flex-1 text-sm font-semibold', colors.tx)}>{text}</p>
        </div>
      </div>
    );
  };

  return (
    <div className='space-y-6 max-w-7xl mx-auto'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center'>
            <Workflow className='w-5 h-5 text-white' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-slate-900'>流程工作台</h1>
            <p className='text-sm text-slate-500'>三步法规范处理点位数据</p>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-12 gap-6'>
        <div className='col-span-4 space-y-4'>
          <div className='bg-white rounded-xl border border-slate-200 shadow-sm p-4'>
            <h3 className='text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2'>
              <Layers className='w-4 h-4 text-slate-500' /> 工作流列表
            </h3>
            <div className='relative mb-3'>
              <Search className='w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2' />
              <input type='text' placeholder='搜索点位名称...'
                className='w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div className='space-y-2 max-h-[560px] overflow-y-auto pr-1'>
              {workflows.map((item) => {
                const p = points.find((x) => x.id === item.pointId);
                const sel = item.id === selectedWorkflow;
                return (
                  <div key={item.id} onClick={() => handleSelect(item.id)}
                    className={cn('p-3 rounded-xl border cursor-pointer transition-all',
                      sel ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm')}>
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-1.5 mb-1'>
                          <MapPin className='w-3.5 h-3.5 text-slate-500 flex-shrink-0' />
                          <span className='font-semibold text-slate-900 text-sm truncate'>{item.pointName}</span>
                        </div>
                        {p?.location && <p className='text-xs text-slate-500 ml-5 line-clamp-1 mb-1.5'>{p.location}</p>}
                        <div className='flex items-center gap-1.5 ml-5 flex-wrap'>
                          <span className={getStatusBadge(item.status)}>{statusLabels[item.status] || item.status}</span>
                          <span className='text-xs text-slate-400'>Step {item.currentStep}/3</span>
                        </div>
                      </div>
                      <ChevronRight className={cn('w-4 h-4 flex-shrink-0 mt-1', sel ? 'text-blue-500' : 'text-slate-300')} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className='col-span-8 space-y-5'>
          {!wf ? (
            <div className='bg-white rounded-xl border border-dashed border-slate-300 p-16 text-center'>
              <div className='w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4'>
                <Workflow className='w-8 h-8 text-slate-400' />
              </div>
              <h3 className='text-lg font-semibold text-slate-700 mb-2'>请从左侧选择一个工作流</h3>
              <p className='text-sm text-slate-500'>选择后可查看并执行三步流程</p>
            </div>
          ) : (
            <div className='space-y-5'>
              <div className='bg-white rounded-xl border border-slate-200 shadow-sm p-5'>
                <div className='flex items-start justify-between gap-4 mb-4'>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 mb-2 flex-wrap'>
                      <MapPin className='w-5 h-5 text-blue-600' />
                      <h2 className='text-lg font-bold text-slate-900'>{wf.pointName}</h2>
                      <span className={getStatusBadge(wf.status)}>{statusLabels[wf.status] || wf.status}</span>
                      {pt?.status && (
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ptBadge[pt.status] || ptBadge.pending)}>
                          点位: {statusLabels[pt.status] || pt.status}
                        </span>
                      )}
                    </div>
                    {pt?.location && <p className='text-sm text-slate-500 ml-7 mb-2'>{pt.location}</p>}
                    <div className='flex items-center gap-4 ml-7 text-xs text-slate-500 flex-wrap'>
                      <span className='flex items-center gap-1'><Hash className='w-3 h-3' /> ID: {wf.pointId}</span>
                      <span className='flex items-center gap-1'><Clock className='w-3 h-3' /> 创建: {new Date(wf.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {detourWarn && (
                    <div className='flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium'>
                      <AlertTriangle className='w-3.5 h-3.5' /> 施工改道未同步
                    </div>
                  )}
                </div>
                <div className='flex items-center justify-between gap-2 pt-3 border-t border-slate-100'>
                  {steps.map((item, idx) => {
                    const Icon = item.icon;
                    const done = cs > item.step || (cs === item.step && wf.status === 'completed');
                    const active = cs === item.step && wf.status !== 'completed';
                    return (
                      <div key={item.step} className='flex items-center flex-1'>
                        <div className={cn('flex items-center gap-2 flex-1', idx > 0 ? 'pl-2' : '')}>
                          <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all',
                            done ? 'bg-emerald-500 border-emerald-500 text-white' :
                            active ? 'bg-blue-50 border-blue-500 text-blue-600' :
                            'bg-slate-50 border-slate-200 text-slate-400')}>
                            {done ? <Check className='w-4 h-4' /> : <Icon className='w-4 h-4' />}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <p className={cn('text-sm font-medium', active ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-slate-400')}>第{item.step}步</p>
                            <p className={cn('text-xs truncate', active ? 'text-blue-600' : done ? 'text-emerald-600' : 'text-slate-400')}>{item.title}</p>
                          </div>
                        </div>
                        {idx < 2 && <div className={cn('h-0.5 flex-1 mx-2 rounded-full', done ? 'bg-emerald-400' : 'bg-slate-200')} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {cs >= 1 && (
                <StepCard n={1} done={cs > 1} active={cs === 1} title='导入公交刷卡时段' desc='录入时段，检测重复导入' icon={Bus}>
                  <div className='space-y-4'>
                    <div>
                      <label className='block text-sm font-medium text-slate-700 mb-1'>公交刷卡时段</label>
                      <textarea rows={2} placeholder='如：早高峰7:00-9:00 / 晚高峰17:00-19:00'
                        value={busCardTime} onChange={(e) => setBusCardTime(e.target.value)}
                        disabled={cs > 1}
                        className='w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed resize-none'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-slate-700 mb-1'>数据来源</label>
                      <div className='relative'>
                        <Upload className='w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2' />
                        <input type='text' value={importSource} onChange={(e) => setImportSource(e.target.value)}
                          disabled={cs > 1}
                          className='w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed'
                        />
                      </div>
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1'>
                        <Layers className='w-3.5 h-3.5 text-slate-500' />
                        批次ID（可选，同一批次重传会自动去重）
                      </label>
                      <div className='relative'>
                        <Layers className='w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2' />
                        <input type='text'
                          placeholder='留空自动生成；填写相同batchId则判定为同一批重传'
                          value={batchId} onChange={(e) => setBatchId(e.target.value)}
                          disabled={cs > 1}
                          className='w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed'
                        />
                      </div>
                    </div>
                    {cs === 1 && (
                      <div className='flex items-center gap-3 pt-1'>
                        <button onClick={handleCheckDup} disabled={!busCardTime.trim() || isProcessing}
                          className='flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
                          <RefreshCw className='w-4 h-4' /> 检测重复
                        </button>
                        <button onClick={handleStep1} disabled={!busCardTime.trim() || isProcessing}
                          className='flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
                          <CheckCircle className='w-4 h-4' /> 下一步
                        </button>
                      </div>
                    )}
                    {renderDuplicateHint()}
                  </div>
                </StepCard>
              )}

              {cs >= 2 && (
                <StepCard n={2} done={cs > 2} active={cs === 2} title='补看红线图备注' desc='填写备注，检测冲突' icon={FileText}>
                  <div className='space-y-4'>
                    <div>
                      <label className='block text-sm font-medium text-slate-700 mb-1'>已导入公交时段</label>
                      <div className='px-4 py-2.5 rounded-lg bg-slate-100 text-sm text-slate-600 font-mono border border-slate-200'>
                        {wf.stepData.step1?.busCardTime || '无'}
                        {wf.stepData.step1?.isDuplicate && (
                          <span className='ml-2 text-xs text-amber-600'>(同一批次重传，已去重)</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-slate-700 mb-1'>红线图备注</label>
                      <textarea rows={4} placeholder='填写红线图备注、施工位置、改道信息等...'
                        value={redLineNote} onChange={(e) => setRedLineNote(e.target.value)}
                        disabled={cs > 2}
                        className='w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:cursor-not-allowed resize-none'
                      />
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-slate-700 mb-1'>修改原因</label>
                      <input type='text' placeholder='如：对照红线图补录/施工队上报改道等'
                        value={changeReason} onChange={(e) => setChangeReason(e.target.value)}
                        disabled={cs > 2}
                        className='w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:cursor-not-allowed'
                      />
                    </div>
                    {cs === 2 && (
                      <div className='pt-1'>
                        <button onClick={handleStep2} disabled={isProcessing}
                          className='inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-600 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
                          <FileText className='w-4 h-4' /> 下一步
                        </button>
                      </div>
                    )}
                    {stepResult && stepResult.hasConflict !== undefined && (
                      <div className={cn('rounded-lg border p-4 mt-2',
                        stepResult.hasConflict ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200')}>
                        <div className='flex items-start gap-3'>
                          {stepResult.hasConflict ? (
                            <AlertTriangle className='w-5 h-5 text-red-600 flex-shrink-0 mt-0.5' />
                          ) : (
                            <CheckCircle className='w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5' />
                          )}
                          <div className='flex-1 min-w-0 text-sm'>
                            <p className={cn('font-semibold mb-0.5', stepResult.hasConflict ? 'text-red-800' : 'text-emerald-800')}>
                              {stepResult.hasConflict ? '检测到与公交时段冲突' : '未检测到冲突'}
                            </p>
                            {stepResult.hasConflict && stepResult.conflictDescription && (
                              <p className='text-red-700 text-xs'>{stepResult.conflictDescription}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </StepCard>
              )}

              {cs >= 3 && (
                <StepCard n={3} done={wf.status === 'completed'} active={cs === 3 && wf.status === 'in-progress'} title='更新点位清单' desc='生成最终报告并更新' icon={MapPin}>
                  <div className='grid grid-cols-2 gap-3 mb-4'>
                    <div className='p-3 bg-blue-50 rounded-lg border border-blue-100'>
                      <p className='text-xs text-blue-600 mb-1 font-medium'>公交时段</p>
                      <p className='text-sm text-blue-900 font-mono'>{wf.stepData.step1?.busCardTime || '-'}</p>
                    </div>
                    <div className='p-3 bg-amber-50 rounded-lg border border-amber-100'>
                      <p className='text-xs text-amber-600 mb-1 font-medium'>红线备注</p>
                      <p className='text-sm text-amber-900 line-clamp-2'>{wf.stepData.step2?.redLineNote || '-'}</p>
                    </div>
                  </div>
                  {detourWarn && (
                    <div className='mb-4 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800'>
                      <AlertTriangle className='w-5 h-5 flex-shrink-0 text-amber-600' />
                      <span><strong>警告：</strong>存在施工改道未同步地图，需居民代表现场复核后再同步</span>
                    </div>
                  )}
                  {cs === 3 && wf.status === 'in-progress' && (
                    <div className='mb-4'>
                      <button onClick={handleStep3} disabled={isProcessing}
                        className='inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
                        <CheckCircle className='w-4 h-4' /> 完成更新
                      </button>
                    </div>
                  )}
                  {fr && (
                    <div className='space-y-4'>
                      <div className='grid grid-cols-2 gap-4'>
                        <div className={cn('rounded-xl border p-4',
                          (fr.duplicateCheck as any)?.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
                          <div className='flex items-start gap-3 mb-3'>
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                              (fr.duplicateCheck as any)?.passed ? 'bg-emerald-100' : 'bg-amber-100')}>
                              <Database className={cn('w-4 h-4',
                                (fr.duplicateCheck as any)?.passed ? 'text-emerald-600' : 'text-amber-600')} />
                            </div>
                            <div className='flex-1 min-w-0'>
                              <h4 className='font-bold text-slate-900 text-sm'>重复导入检测</h4>
                              <p className='text-xs text-slate-500'>{(fr.duplicateCheck as any)?.passed ? '通过' : '存在重复（已处理）'}</p>
                            </div>
                          </div>
                          <div className={cn('text-xs space-y-1.5',
                            (fr.duplicateCheck as any)?.passed ? 'text-emerald-700' : 'text-amber-700')}>
                            <p className='flex items-center gap-1'>
                              <Layers className='w-3 h-3' /> 批次ID:
                              <span className='font-mono bg-white/60 px-1 rounded'>{(fr.duplicateCheck as any)?.batchInfo?.lastBatchId || '-'}</span>
                            </p>
                            <p className='flex items-center gap-1'>
                              <User className='w-3 h-3' /> 来源: {(fr.duplicateCheck as any)?.batchInfo?.lastBatchSource || (fr.duplicateCheck as any)?.source || '-'}
                            </p>
                            <p className='flex items-center gap-1'>
                              <Hash className='w-3 h-3' /> 导入次数: {(fr.duplicateCheck as any)?.batchInfo?.totalImports || 0} 次
                            </p>
                            <p className='flex items-center gap-1'>
                              {getCheckIcon((fr.duplicateCheck as any)?.passed)} 是否重复: {(fr.duplicateCheck as any)?.passed ? '否' : '是（已去重）'}
                            </p>
                            {(fr.duplicateCheck as any)?.detail && (
                              <p className='pt-1 mt-1 border-t border-current/20 opacity-90'>{(fr.duplicateCheck as any).detail}</p>
                            )}
                          </div>
                        </div>
                        <div className={cn('rounded-xl border p-4',
                          (fr.detourSync as any)?.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
                          <div className='flex items-start gap-3 mb-3'>
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                              (fr.detourSync as any)?.passed ? 'bg-emerald-100' : 'bg-red-100')}>
                              <AlertTriangle className={cn('w-4 h-4',
                                (fr.detourSync as any)?.passed ? 'text-emerald-600' : 'text-red-600')} />
                            </div>
                            <div className='flex-1 min-w-0'>
                              <h4 className='font-bold text-slate-900 text-sm'>施工改道同步</h4>
                              <p className='text-xs text-slate-500'>{(fr.detourSync as any)?.passed ? '已同步' : '待复核'}</p>
                            </div>
                          </div>
                          <div className={cn('text-xs space-y-1.5',
                            (fr.detourSync as any)?.passed ? 'text-emerald-700' : 'text-red-700')}>
                            <p className='flex items-center gap-1'>
                              <User className='w-3 h-3' /> 改道来源: {(fr.detourSync as any)?.detourInfo?.reportSource || (fr.detourSync as any)?.source || '-'}
                            </p>
                            <p className='flex items-center gap-1'>
                              {getCheckIcon((fr.detourSync as any)?.passed)} 同步状态: {(fr.detourSync as any)?.detourInfo?.mapSynced ? '已同步' : '未同步'}
                            </p>
                            {(fr.detourSync as any)?.detail && (
                              <p className='pt-1 mt-1 border-t border-current/20 opacity-90'>{(fr.detourSync as any).detail}</p>
                            )}
                          </div>
                        </div>
                        <div className={cn('rounded-xl border p-4',
                          (fr.supplementRecalc as any)?.passed && !(fr.supplementRecalc as any)?.supplementInfo?.hasConflict
                            ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
                          <div className='flex items-start gap-3 mb-3'>
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                              (fr.supplementRecalc as any)?.passed && !(fr.supplementRecalc as any)?.supplementInfo?.hasConflict
                                ? 'bg-emerald-100' : 'bg-amber-100')}>
                              <FileText className={cn('w-4 h-4',
                                (fr.supplementRecalc as any)?.passed && !(fr.supplementRecalc as any)?.supplementInfo?.hasConflict
                                  ? 'text-emerald-600' : 'text-amber-600')} />
                            </div>
                            <div className='flex-1 min-w-0'>
                              <h4 className='font-bold text-slate-900 text-sm'>补录后重算</h4>
                              <p className='text-xs text-slate-500'>已完成</p>
                            </div>
                          </div>
                          <div className={cn('text-xs space-y-1.5',
                            (fr.supplementRecalc as any)?.passed && !(fr.supplementRecalc as any)?.supplementInfo?.hasConflict
                              ? 'text-emerald-700' : 'text-amber-700')}>
                            <p className='flex items-center gap-1'>
                              {getCheckIcon((fr.supplementRecalc as any)?.supplementInfo?.hasSupplement)} 备注状态: {(fr.supplementRecalc as any)?.supplementInfo?.hasSupplement ? '已补录' : '未补录'}
                            </p>
                            <p className='flex items-center gap-1'>
                              {getCheckIcon(!(fr.supplementRecalc as any)?.supplementInfo?.hasConflict)} 冲突检测: {(fr.supplementRecalc as any)?.supplementInfo?.hasConflict ? '有冲突' : '无冲突'}
                            </p>
                            <p className='flex items-center gap-1'>
                              {getCheckIcon((fr.supplementRecalc as any)?.supplementInfo?.statsRecalculated)} 统计重算: {(fr.supplementRecalc as any)?.supplementInfo?.statsRecalculated ? '已重算' : '未重算'}
                            </p>
                            {(fr.supplementRecalc as any)?.detail && (
                              <p className='pt-1 mt-1 border-t border-current/20 opacity-90'>{(fr.supplementRecalc as any).detail}</p>
                            )}
                          </div>
                        </div>
                        <div className='rounded-xl border border-emerald-200 bg-emerald-50 p-4'>
                          <div className='flex items-start gap-3 mb-3'>
                            <div className='w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0'>
                              <FileCheck className='w-4 h-4 text-emerald-600' />
                            </div>
                            <div className='flex-1 min-w-0'>
                              <h4 className='font-bold text-slate-900 text-sm'>导出一致性</h4>
                              <p className='text-xs text-slate-500'>字段完整</p>
                            </div>
                          </div>
                          <div className='text-xs text-emerald-700 space-y-1.5'>
                            <p className='font-medium mb-1'>导出字段：</p>
                            <p className='flex items-center gap-1.5'><Layers className='w-3 h-3' /> 批次信息</p>
                            <p className='flex items-center gap-1.5'><Hash className='w-3 h-3' /> 导入次数</p>
                            <p className='flex items-center gap-1.5'><MapPin className='w-3 h-3' /> 点位状态</p>
                            <p className='flex items-center gap-1.5'><CheckCircle className='w-3 h-3' /> 复核状态</p>
                            <p className='flex items-center gap-1.5'><AlertTriangle className='w-3 h-3' /> 改道状态</p>
                          </div>
                        </div>
                      </div>
                      <div className={cn('rounded-2xl border-2 p-6',
                        (fr as any)?.overallStatus === 'pass' ? 'bg-emerald-50 border-emerald-300' :
                        (fr as any)?.overallStatus === 'warning' ? 'bg-amber-50 border-amber-300' :
                        'bg-red-50 border-red-300')}>
                        <div className='flex items-start gap-4'>
                          <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
                            (fr as any)?.overallStatus === 'pass' ? 'bg-emerald-200' :
                            (fr as any)?.overallStatus === 'warning' ? 'bg-amber-200' : 'bg-red-200')}>
                            {(fr as any)?.overallStatus === 'pass' ? <CheckCircle className='w-7 h-7 text-emerald-700' /> :
                             (fr as any)?.overallStatus === 'warning' ? <AlertTriangle className='w-7 h-7 text-amber-700' /> :
                             <XCircle className='w-7 h-7 text-red-700' />}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <h3 className={cn('text-xl font-extrabold mb-2',
                              (fr as any)?.overallStatus === 'pass' ? 'text-emerald-800' :
                              (fr as any)?.overallStatus === 'warning' ? 'text-amber-800' : 'text-red-800')}>
                              {fr.overallConclusion || '整体结论'}
                            </h3>
                            <div className={cn('text-sm space-y-1.5',
                              (fr as any)?.overallStatus === 'pass' ? 'text-emerald-700' :
                              (fr as any)?.overallStatus === 'warning' ? 'text-amber-700' : 'text-red-700')}>
                              <p className='flex items-center gap-1.5'>
                                <MapPin className='w-4 h-4' /> 点位状态:
                                <span className='font-semibold'>{statusLabels[(fr as any)?.finalPointStatus] || wf.stepData.step3?.pointStatus || '-'}</span>
                              </p>
                              <p className='flex items-center gap-1.5'>
                                <CheckCircle className='w-4 h-4' /> 复核状态:
                                <span className='font-semibold'>{statusLabels[(fr as any)?.finalReviewStatus] || wf.stepData.step3?.reviewStatus || '-'}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {!fr && stepResult && wf.status !== 'in-progress' && (
                    <div className={cn('rounded-xl border p-5',
                      stepResult.needsReview ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200')}>
                      <div className='flex items-start gap-3'>
                        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                          stepResult.needsReview ? 'bg-amber-100' : 'bg-emerald-100')}>
                          {stepResult.needsReview
                            ? <AlertTriangle className='w-5 h-5 text-amber-600' />
                            : <CheckCircle className='w-5 h-5 text-emerald-600' />}
                        </div>
                        <div className='flex-1'>
                          <p className={cn('font-semibold mb-1', stepResult.needsReview ? 'text-amber-800' : 'text-emerald-800')}>
                            {stepResult.needsReview ? '流程完成，待居民代表复核（不归正常）' : '流程完成，点位已更新为正常'}
                          </p>
                          <p className={cn('text-sm', stepResult.needsReview ? 'text-amber-700' : 'text-emerald-700')}>
                            点位状态: {statusLabels[stepResult.pointStatus] || stepResult.pointStatus} · 复核状态: {statusLabels[stepResult.reviewStatus] || stepResult.reviewStatus}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </StepCard>
              )}

              {wf.status === 'pending-review' ? (
                <div className='bg-amber-50 border border-amber-200 rounded-xl p-5'>
                  <div className='flex items-center gap-3'>
                    <AlertTriangle className='w-5 h-5 text-amber-600 flex-shrink-0' />
                    <div>
                      <p className='font-semibold text-amber-800'>待居民代表复核</p>
                      <p className='text-sm text-amber-700'>施工改道信息已转交居民代表现场核实，复核通过后点位自动归为正常</p>
                    </div>
                  </div>
                </div>
              ) : wf.status === 'in-progress' ? (
                <div className='flex items-center justify-between gap-3 pt-2'>
                  <button onClick={backToList}
                    className='inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors'>
                    <ChevronLeft className='w-4 h-4' /> 返回列表
                  </button>
                  <span className='text-xs text-slate-500'>
                    {cs === 1 ? '请先完成第一步' : cs === 2 ? '请完成第二步补录' : '请完成第三步更新'}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
'''

with open('/Users/lzy/pro/solo/workspaces/zy72488/src/pages/Workflow.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

lines = content.count('\n') + 1
print(f'写入成功！文件行数: {lines}')
