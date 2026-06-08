import { usePipelineStore } from '@/store/pipelineStore';
import type { PipelineRecord, WorkflowStatus, MaterialType } from '@/types';
import { STATUS_LABELS, MATERIAL_LABELS, COORDINATE_TYPE_LABELS } from '@/types';
import { Link } from 'react-router-dom';
import {
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Compass,
  ChevronRight,
  ArrowRight,
  FileCode,
  FileText,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_TAG: Record<WorkflowStatus, string> = {
  step1: 'bg-blue-100 text-blue-800',
  step2: 'bg-yellow-100 text-yellow-800',
  step3: 'bg-purple-100 text-purple-800',
  pending_review: 'bg-orange-100 text-orange-800',
  confirmed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const MATERIAL_TAG: Record<MaterialType, string> = {
  normal: 'bg-blue-50 text-blue-700',
  wrong_caliber: 'bg-red-50 text-red-700',
  supplementary: 'bg-amber-50 text-amber-700',
};

const WORKFLOW_STEPS = [
  { key: 'step1', label: '第一步：导入照片编号', icon: Upload, path: '/import' },
  { key: 'step2', label: '第二步：补录CAD图层名', icon: FileCode, path: '/cad' },
  { key: 'step3', label: '第三步：更新现场说明', icon: FileText, path: '/instructions' },
] as const;

function getCurrentStep(record: PipelineRecord): number {
  if (record.status === 'rejected' || record.status === 'confirmed') return 4;
  if (record.isCoordinateMixed || record.status === 'pending_review') return 0;
  if (record.status === 'step3') return 3;
  if (record.status === 'step2') return 2;
  if (record.status === 'step1') return 1;
  return 0;
}

export default function Home() {
  const { records, conflicts } = usePipelineStore();

  const statusCounts = records.reduce<Record<WorkflowStatus, number>>(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { step1: 0, step2: 0, step3: 0, pending_review: 0, confirmed: 0, rejected: 0 }
  );

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending').length;
  const mixedCount = records.filter((r) => r.isCoordinateMixed).length;

  const statCards = [
    { label: 'Step1 已导入照片', value: statusCounts.step1, color: 'text-blue-600', icon: Upload, hint: '等待补录CAD' },
    { label: 'Step2 已补录CAD', value: statusCounts.step2, color: 'text-yellow-600', icon: FileCode, hint: '等待更新说明' },
    { label: 'Step3 已填说明', value: statusCounts.step3, color: 'text-purple-600', icon: FileText, hint: '流程完成' },
    { label: '待巡检组复核', value: statusCounts.pending_review, color: 'text-industrial-orange', icon: Compass, hint: '坐标混合' },
    { label: '已确认归档', value: statusCounts.confirmed, color: 'text-industrial-green', icon: CheckCircle, hint: '最终结论' },
    { label: '已驳回', value: statusCounts.rejected, color: 'text-industrial-red', icon: XCircle, hint: '业务处理' },
    { label: '冲突待处理', value: pendingConflicts, color: 'text-industrial-orange', icon: AlertTriangle, hint: '照片↔CAD' },
    { label: '坐标混合标记', value: mixedCount, color: mixedCount > 0 ? 'text-industrial-red' : 'text-industrial-gray', icon: Layers, hint: mixedCount > 0 ? '巡检组处理中' : '坐标类型统一' },
  ];

  const maxStepReached = records.length === 0 ? 0 : records.reduce<number>((max, r) => {
    return Math.max(max, getCurrentStep(r));
  }, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-primary-800">工作流面板</h1>
        <p className="text-sm text-industrial-gray mt-1">
          管线定位数据总览 · 三步流程追踪 · 同一条记录状态变化一眼看清
        </p>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {WORKFLOW_STEPS.map((step, i) => {
            const stepNum = i + 1;
            const isActive = stepNum <= maxStepReached;
            const isCurrent = stepNum === maxStepReached;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center flex-1 min-w-[220px]">
                <Link
                  to={step.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 border-2 transition-all duration-200 flex-1',
                    isActive
                      ? 'border-primary-800 bg-primary-50 text-primary-800'
                      : 'border-gray-200 bg-gray-50 text-gray-400',
                    isCurrent && 'border-industrial-orange bg-orange-50 animate-pulse-orange'
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center font-mono-data font-bold text-sm',
                    isActive ? 'bg-primary-800 text-white' : 'bg-gray-300 text-white'
                  )}>
                    {stepNum}
                  </div>
                  <div className="flex-1">
                    <Icon size={18} className="inline mr-1.5 -mt-0.5" />
                    <span className="font-display font-medium text-sm">{step.label}</span>
                  </div>
                </Link>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight
                    size={20}
                    className={cn(
                      'mx-3 shrink-0',
                      stepNum < maxStepReached ? 'text-primary-800' : 'text-gray-300'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {mixedCount > 0 && (
          <div className="mt-4 flex items-center gap-3 text-xs text-orange-700 bg-orange-50 border border-orange-200 p-3 rounded">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <div>
              <strong>流程暂停提示：</strong>
              系统中有 {mixedCount} 条记录标记为
              <strong>坐标混合</strong>（经纬度与米制坐标混用），
              按规则不自动归为正常，已跳至
              <Link to="/coordinates" className="underline mx-1">
                待巡检组复核
              </Link>
              状态，需人工确认后才能继续到下一步。
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4 flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                card.color, 'bg-opacity-10'
              )}>
                <Icon size={20} className={card.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-mono-data font-bold text-primary-900 truncate">{card.value}</p>
                <p className="text-xs text-industrial-gray font-display truncate">{card.label}</p>
                <p className="text-xs text-gray-400 truncate">{card.hint}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-display font-bold text-primary-800">
            管线记录 · 状态追踪
          </h2>
          <span className="text-xs text-industrial-gray font-mono-data">
            共 {records.length} 条
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-50 text-left">
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">照片编号</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">CAD图层名</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">材料类型</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">当前状态</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">流程进度</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">坐标</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">坐标混合</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">下一步</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400 font-display">
                    暂无管线记录
                    <Link to="/import" className="ml-2 text-primary-600 underline">
                      去数据导入 →
                    </Link>
                  </td>
                </tr>
              )}
              {records.map((record) => (
                <RecordRow key={record.id} record={record} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RecordRow({ record }: { record: PipelineRecord }) {
  const { actionPath, actionLabel, nextHint } = getActionContext(record);
  const curStep = getCurrentStep(record);

  return (
    <tr className={cn(
      'hover:bg-gray-50 transition-colors',
      record.isCoordinateMixed && 'bg-orange-50/40'
    )}>
      <td className="px-4 py-2.5 font-mono-data text-primary-800 font-medium">{record.photoNumber}</td>
      <td className="px-4 py-2.5 font-mono-data">
        {record.cadLayer ? (
          <span className="text-gray-600">{record.cadLayer}</span>
        ) : (
          <span className="text-gray-300 italic">—未录入—</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className={cn('status-tag', MATERIAL_TAG[record.materialType])}>
          {MATERIAL_LABELS[record.materialType]}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className={cn('status-tag', STATUS_TAG[record.status])}>
          {STATUS_LABELS[record.status]}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                'w-6 h-2 rounded-sm transition-colors',
                curStep >= n
                  ? (curStep === n && !record.isCoordinateMixed
                    ? (n === 1 ? 'bg-blue-500' : n === 2 ? 'bg-yellow-500' : 'bg-purple-500')
                    : 'bg-primary-700')
                  : 'bg-gray-200'
              )}
            />
          ))}
          {record.isCoordinateMixed && (
            <div className="w-2 h-2 rounded-full bg-industrial-orange animate-pulse ml-1" title="坐标混合待处理" />
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 font-mono-data text-xs">
        <div className="flex flex-col">
          <span>{COORDINATE_TYPE_LABELS[record.coordinate.type]}</span>
          {record.coordinate.type === 'latlng' ? (
            <span className="text-gray-500">
              {record.coordinate.lat?.toFixed(3)}, {record.coordinate.lng?.toFixed(3)}
            </span>
          ) : (
            <span className="text-gray-500">
              X{record.coordinate.metricX?.toFixed(1)} Y{record.coordinate.metricY?.toFixed(1)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5">
        {record.isCoordinateMixed ? (
          <span className="status-tag bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3 inline mr-1" />是
          </span>
        ) : (
          <span className="status-tag bg-green-50 text-green-600">
            <CheckCircle className="w-3 h-3 inline mr-1" />否
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-600 font-display">
        {nextHint}
      </td>
      <td className="px-4 py-2.5">
        <Link
          to={actionPath}
          className={cn(
            'text-xs px-2 py-1 inline-flex items-center gap-1 border transition-colors',
            record.isCoordinateMixed
              ? 'border-industrial-orange text-industrial-orange hover:bg-orange-50'
              : 'border-primary-500 text-primary-700 hover:bg-primary-50'
          )}
        >
          {actionLabel}
          <ChevronRight size={12} />
        </Link>
      </td>
    </tr>
  );
}

function getActionContext(record: PipelineRecord): {
  actionPath: string;
  actionLabel: string;
  nextHint: string;
} {
  if (record.status === 'rejected') {
    return { actionPath: '/history', actionLabel: '查看追溯', nextHint: '已驳回，追溯处理记录' };
  }
  if (record.isCoordinateMixed || record.status === 'pending_review') {
    return {
      actionPath: '/coordinates',
      actionLabel: '去复核',
      nextHint: '坐标混合 → 巡检组复核',
    };
  }
  if (record.status === 'step1') {
    return { actionPath: '/cad', actionLabel: '补录CAD', nextHint: '→ Step2 补录CAD图层名' };
  }
  if (record.status === 'step2') {
    return { actionPath: '/instructions', actionLabel: '填说明', nextHint: '→ Step3 更新现场说明' };
  }
  if (record.status === 'step3') {
    return { actionPath: '/instructions', actionLabel: '查看详情', nextHint: '流程完成，可导出' };
  }
  if (record.status === 'confirmed') {
    return { actionPath: '/history', actionLabel: '查看追溯', nextHint: '已归档，查看操作记录' };
  }
  return { actionPath: '/cad', actionLabel: '处理', nextHint: '处理中' };
}
