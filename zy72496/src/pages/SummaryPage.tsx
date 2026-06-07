import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecordsStore } from '@/store/useRecordsStore';
import { RecordStatus } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin,
  FileText,
  Eye,
  ArrowLeft,
} from 'lucide-react';

export default function SummaryPage() {
  const navigate = useNavigate();
  const { records, selectRecord } = useRecordsStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const stats = useMemo(() => {
    const total = records.length;
    const pending = records.filter((r) => r.status === RecordStatus.PENDING).length;
    const reviewing = records.filter((r) => r.status === RecordStatus.REVIEWING).length;
    const plannerDone = records.filter((r) => r.status === RecordStatus.PLANNER_DONE).length;
    const normal = records.filter((r) => r.status === RecordStatus.NORMAL).length;
    const problem = records.filter((r) => r.status === RecordStatus.PROBLEM).length;
    const suspected = records.filter((r) => r.isSuspectedDuplicateName).length;
    const inspected = records.filter(
      (r) => r.status === RecordStatus.INSPECTOR_DONE || r.status === RecordStatus.NORMAL || r.status === RecordStatus.PROBLEM
    ).length;

    return { total, pending, reviewing, plannerDone, normal, problem, suspected, inspected };
  }, [records]);

  const suspectedRecords = records.filter((r) => r.isSuspectedDuplicateName);
  const problemRecords = records.filter((r) => r.status === RecordStatus.PROBLEM);
  const normalRecords = records.filter((r) => r.status === RecordStatus.NORMAL);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const RecordExpandableRow = ({ record }: { record: any }) => {
    const isExpanded = expandedIds.has(record.id);

    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden mb-2">
        <button
          onClick={() => toggleExpand(record.id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            {record.isSuspectedDuplicateName && (
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            )}
            {record.status === RecordStatus.PROBLEM && (
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            )}
            {record.status === RecordStatus.NORMAL && (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            )}
            <div>
              <p className="font-medium text-slate-800">{record.communityName}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {record.stationName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={record.status} size="sm" />
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 py-4 bg-slate-50 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  原始行号
                </p>
                <p className="text-sm text-slate-800 font-mono">{record.originalRowNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  公交刷卡时段
                </p>
                <p className="text-sm text-slate-800">{record.busSwipeTime || '未填写'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-slate-500 mb-1">路口照片描述</p>
                <p className="text-sm text-slate-800">{record.photoDescription || '无'}</p>
              </div>
              {record.plannerRemark && (
                <div className="md:col-span-2">
                  <p className="text-xs text-amber-600 mb-1 font-medium">
                    街道规划员小姜保留理由：
                  </p>
                  <p className="text-sm text-slate-800 bg-amber-50 p-3 rounded border border-amber-200">
                    {record.plannerRemark}
                  </p>
                </div>
              )}
              {record.inspectorRemark && (
                <div className="md:col-span-2">
                  <p className="text-xs text-blue-600 mb-1 font-medium">市政巡检员复核意见：</p>
                  <p className="text-sm text-slate-800 bg-blue-50 p-3 rounded border border-blue-200">
                    {record.inspectorRemark}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  selectRecord(record.id);
                  navigate('/workspace');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
              >
                <Eye className="w-3 h-3" />
                查看完整记录
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/workspace')}
          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回工作区
        </button>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">第三步：街道会摘要</h2>
        <p className="text-slate-600">
          汇总排查结果，支持钻取查看每条记录的详情和规划员保留理由
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-500 mt-1">排查总数</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <p className="text-3xl font-bold text-amber-600">{stats.reviewing}</p>
          <p className="text-sm text-slate-500 mt-1">待复核</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-5">
          <p className="text-3xl font-bold text-green-600">{stats.normal}</p>
          <p className="text-sm text-slate-500 mt-1">已确认正常</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-5">
          <p className="text-3xl font-bold text-red-600">{stats.problem}</p>
          <p className="text-sm text-slate-500 mt-1">有问题需处理</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {suspectedRecords.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-amber-50/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-slate-800">
                  疑似同一小区新旧名称（{suspectedRecords.length}条）
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                点击展开查看街道规划员小姜当时保留的理由
              </p>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {suspectedRecords.map((record) => (
                <RecordExpandableRow key={record.id} record={record} />
              ))}
            </div>
          </div>
        )}

        {problemRecords.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-red-50/50">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-slate-800">
                  存在问题需处理（{problemRecords.length}条）
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">雨棚存在问题，需安排维修</p>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {problemRecords.map((record) => (
                <RecordExpandableRow key={record.id} record={record} />
              ))}
            </div>
          </div>
        )}
      </div>

      {normalRecords.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-green-50/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-slate-800">
                已确认正常（{normalRecords.length}条）
              </h3>
            </div>
          </div>
          <div className="p-4 max-h-64 overflow-y-auto">
            {normalRecords.map((record) => (
              <RecordExpandableRow key={record.id} record={record} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-5 bg-slate-50 rounded-xl border border-slate-200">
        <h4 className="font-semibold text-slate-800 mb-3">街道会汇报要点</h4>
        <ul className="text-sm text-slate-600 space-y-2">
          <li>
            • 本次共排查轨交站口雨棚 <span className="font-bold text-slate-800">{stats.total}</span> 处
          </li>
          <li>
            • 其中 <span className="font-bold text-amber-600">{stats.reviewing + stats.suspected}</span>{' '}
            处存在同一小区新旧名称疑似问题，需市政巡检员重点复核
          </li>
          <li>
            • <span className="font-bold text-green-600">{stats.normal}</span> 处已确认正常，{' '}
            <span className="font-bold text-red-600">{stats.problem}</span> 处存在问题需安排维修
          </li>
          <li>
            • 所有记录均保留原始行号、变更历史，可随时追溯证据链
          </li>
        </ul>
      </div>
    </div>
  );
}
