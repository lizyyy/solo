import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecordsStore } from '@/store/useRecordsStore';
import { RecordCard } from '@/components/RecordCard';
import { RecordDetailPanel } from '@/components/RecordDetailPanel';
import { RecordStatus, OperatorRole, WorkflowStep } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Filter, Users, ChevronRight, ListFilter } from 'lucide-react';

const STATUS_FILTERS: { label: string; status: RecordStatus | 'all' | 'review' }[] = [
  { label: '全部', status: 'all' },
  { label: '待排查', status: RecordStatus.PENDING },
  { label: '待复核', status: RecordStatus.REVIEWING },
  { label: '规划员已处理', status: RecordStatus.PLANNER_DONE },
  { label: '已确认正常', status: RecordStatus.NORMAL },
  { label: '有问题', status: RecordStatus.PROBLEM },
];

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { records, selectedRecordId, currentStep, setOperator, currentOperator, currentOperatorName, setCurrentStep } =
    useRecordsStore();
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all' | 'review'>('all');
  const [showSuspectedOnly, setShowSuspectedOnly] = useState(false);

  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (showSuspectedOnly && !r.isSuspectedDuplicateName) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isSuspectedDuplicateName && !b.isSuspectedDuplicateName) return -1;
        if (!a.isSuspectedDuplicateName && b.isSuspectedDuplicateName) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [records, statusFilter, showSuspectedOnly]);

  const stats = useMemo(() => {
    return {
      total: records.length,
      pending: records.filter((r) => r.status === RecordStatus.PENDING).length,
      reviewing: records.filter((r) => r.status === RecordStatus.REVIEWING).length,
      plannerDone: records.filter((r) => r.status === RecordStatus.PLANNER_DONE).length,
      normal: records.filter((r) => r.status === RecordStatus.NORMAL).length,
      problem: records.filter((r) => r.status === RecordStatus.PROBLEM).length,
      suspected: records.filter((r) => r.isSuspectedDuplicateName).length,
    };
  }, [records]);

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">筛选：</span>
              <div className="flex items-center gap-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.status}
                    onClick={() => setStatusFilter(f.status as any)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      statusFilter === f.status
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 ml-4">
              <input
                type="checkbox"
                checked={showSuspectedOnly}
                onChange={(e) => setShowSuspectedOnly(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm text-amber-700">只看疑似同名</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600">当前身份：</span>
              <select
                value={currentOperator}
                onChange={(e) => {
                  const role = e.target.value as OperatorRole;
                  setOperator(role, role === OperatorRole.PLANNER ? '小姜' : '巡检员');
                }}
                className="px-2 py-1 border border-slate-300 rounded text-sm bg-white"
              >
                <option value={OperatorRole.PLANNER}>街道规划员（小姜）</option>
                <option value={OperatorRole.INSPECTOR}>市政巡检员</option>
              </select>
            </div>
            {currentStep === WorkflowStep.BUS_CHECK && (
              <button
                onClick={() => {
                  setCurrentStep(WorkflowStep.SUMMARY);
                  navigate('/summary');
                }}
                className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                进入下一步：更新街道会摘要
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 border-r border-slate-200 bg-slate-50 overflow-y-auto">
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                <p className="text-xs text-slate-500">总数</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-amber-200">
                <p className="text-2xl font-bold text-amber-600">{stats.reviewing}</p>
                <p className="text-xs text-slate-500">待复核</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center border border-green-200">
                <p className="text-2xl font-bold text-green-600">{stats.normal}</p>
                <p className="text-xs text-slate-500">已正常</p>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                记录列表
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({filteredRecords.length}条)
                </span>
              </h3>
            </div>

            <div className="space-y-2">
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ListFilter className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无符合条件的记录</p>
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <RecordCard key={record.id} record={record} />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {selectedRecord ? (
            <RecordDetailPanel record={selectedRecord} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Filter className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">选择左侧记录查看详情</p>
                <p className="text-sm mt-1">可编辑字段、修改状态、查看历史</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
