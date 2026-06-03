import { usePipelineStore } from '@/store/pipelineStore';
import type { PipelineRecord, WorkflowStatus, MaterialType } from '@/types';
import { STATUS_LABELS, MATERIAL_LABELS, COORDINATE_TYPE_LABELS } from '@/types';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Compass,
  ChevronRight,
  ArrowRight,
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
  { key: 'step2', label: '第二步：补录CAD图层名', icon: LayoutDashboard, path: '/cad' },
  { key: 'step3', label: '第三步：更新现场说明', icon: Compass, path: '/instructions' },
] as const;

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
    { label: '第一步记录', value: statusCounts.step1, color: 'text-blue-600', icon: Upload },
    { label: '第二步记录', value: statusCounts.step2, color: 'text-yellow-600', icon: ChevronRight },
    { label: '第三步记录', value: statusCounts.step3, color: 'text-purple-600', icon: ChevronRight },
    { label: '待复核', value: statusCounts.pending_review, color: 'text-orange-600', icon: Compass },
    { label: '已确认', value: statusCounts.confirmed, color: 'text-industrial-green', icon: CheckCircle },
    { label: '已驳回', value: statusCounts.rejected, color: 'text-industrial-red', icon: XCircle },
    { label: '冲突待处理', value: pendingConflicts, color: 'text-industrial-orange', icon: AlertTriangle },
    { label: '坐标混合', value: mixedCount, color: 'text-industrial-gray', icon: Compass },
  ];

  const maxStepReached = records.reduce<number>((max, r) => {
    if (r.status === 'confirmed' || r.status === 'rejected' || r.status === 'pending_review') return 3;
    if (r.status === 'step3') return Math.max(max, 3);
    if (r.status === 'step2') return Math.max(max, 2);
    if (r.status === 'step1') return Math.max(max, 1);
    return max;
  }, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-primary-800">工作流面板</h1>
        <p className="text-sm text-industrial-gray mt-1">管线定位数据总览与流程追踪</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS.map((step, i) => {
            const stepNum = i + 1;
            const isActive = stepNum <= maxStepReached;
            const isCurrent = stepNum === maxStepReached;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center flex-1">
                <Link
                  to={step.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 border-2 transition-all duration-200',
                    isActive
                      ? 'border-primary-800 bg-primary-50 text-primary-800'
                      : 'border-gray-200 bg-gray-50 text-gray-400',
                    isCurrent && 'border-industrial-orange bg-orange-50 animate-pulse-orange'
                  )}
                >
                  <Icon size={20} />
                  <span className="font-display font-medium text-sm">{step.label}</span>
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
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4 flex items-center gap-3">
              <Icon size={20} className={cn(card.color, 'shrink-0')} />
              <div>
                <p className="text-2xl font-mono-data font-bold text-primary-900">{card.value}</p>
                <p className="text-xs text-industrial-gray font-display">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-display font-bold text-primary-800">管线记录</h2>
          <span className="text-xs text-industrial-gray font-mono-data">共 {records.length} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-50 text-left">
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">照片编号</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">CAD图层名</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">材料类型</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">状态</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">坐标类型</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">是否混合</th>
                <th className="px-4 py-2.5 font-display font-medium text-primary-800">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 font-display">
                    暂无管线记录，请先导入数据
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
  const actionPath = getActionPath(record);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5 font-mono-data text-primary-800">{record.photoNumber}</td>
      <td className="px-4 py-2.5 font-mono-data text-gray-600">
        {record.cadLayer || <span className="text-gray-300">—</span>}
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
      <td className="px-4 py-2.5 font-mono-data text-xs">
        {COORDINATE_TYPE_LABELS[record.coordinate.type]}
      </td>
      <td className="px-4 py-2.5">
        {record.isCoordinateMixed ? (
          <span className="status-tag bg-red-100 text-red-700">是</span>
        ) : (
          <span className="status-tag bg-gray-100 text-gray-500">否</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <Link
          to={actionPath}
          className="btn-outline text-xs px-2 py-1 inline-flex items-center gap-1"
        >
          处理 <ChevronRight size={12} />
        </Link>
      </td>
    </tr>
  );
}

function getActionPath(record: PipelineRecord): string {
  if (record.status === 'step1') return '/cad';
  if (record.status === 'step2') return '/instructions';
  if (record.status === 'pending_review') return '/coordinates';
  if (record.isCoordinateMixed) return '/coordinates';
  return '/cad';
}
