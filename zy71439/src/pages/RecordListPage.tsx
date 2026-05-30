import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  ArrowLeft,
  ListTodo,
  Search,
  AlertCircle,
  CheckCircle,
  RotateCcw
} from 'lucide-react';
import { useRecordStore } from '../store/recordStore';
import { useWorkflowStore } from '../store/workflowStore';
import RecordCard from '../components/RecordList/RecordCard';
import StatusFilter from '../components/RecordList/StatusFilter';
import { WorkflowStatus, TrainingRecord } from '../types';
import { exportHTMLReport } from '../utils/exportReport';
import { getScenarioById } from '../data/scenarios';
import { getLighthousesByScenario } from '../data/lighthouses';

const RecordListPage: React.FC = () => {
  const navigate = useNavigate();
  const { records, updateRecordWorkflow } = useRecordStore();
  const { currentUser } = useWorkflowStore();
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReturnModal, setShowReturnModal] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState('');

  const counts = {
    [WorkflowStatus.PENDING]: records.filter(r => r.workflow.status === WorkflowStatus.PENDING).length,
    [WorkflowStatus.APPROVED]: records.filter(r => r.workflow.status === WorkflowStatus.APPROVED).length,
    [WorkflowStatus.RETURNED]: records.filter(r => r.workflow.status === WorkflowStatus.RETURNED).length
  };

  const filteredRecords = records.filter(record => {
    const matchesStatus = statusFilter === 'all' || record.workflow.status === statusFilter;
    const matchesSearch = searchQuery.trim() === '' ||
      record.traineeName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const isInstructor = currentUser?.role === 'instructor';

  const handleExport = async (record: TrainingRecord) => {
    const scenario = getScenarioById(record.scenarioId);
    const lighthouses = scenario ? getLighthousesByScenario(scenario.lighthouseIds) : [];
    if (scenario) {
      await exportHTMLReport(record, scenario, lighthouses);
    }
  };

  const handleApprove = (record: TrainingRecord) => {
    if (!isInstructor) return;
    updateRecordWorkflow(record.id, WorkflowStatus.APPROVED, currentUser.name, '训练完成，数据准确，已通过复核。');
  };

  const handleReturn = (recordId: string) => {
    if (!isInstructor || !returnComment.trim()) return;
    updateRecordWorkflow(recordId, WorkflowStatus.RETURNED, currentUser.name, returnComment);
    setShowReturnModal(null);
    setReturnComment('');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Compass size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">训练记录</h1>
                <p className="text-sm text-slate-400">
                  共 {records.length} 条记录
                  {isInstructor && <span className="text-yellow-400 ml-2">（教员模式）</span>}
                </p>
              </div>
            </div>

            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索学员姓名..."
                className="pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-slate-500 transition-colors w-64"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <div className="mb-6">
          <StatusFilter
            currentFilter={statusFilter}
            onFilterChange={setStatusFilter}
            counts={counts}
          />
        </div>

        {isInstructor && counts[WorkflowStatus.PENDING] > 0 && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-yellow-400 font-medium">
                有 {counts[WorkflowStatus.PENDING]} 条记录待复核
              </div>
              <p className="text-sm text-yellow-400/70">
                请检查学员提交的训练记录，确认无误后通过，或退回要求补充材料。
              </p>
            </div>
          </div>
        )}

        {filteredRecords.length === 0 ? (
          <div className="text-center py-20">
            <ListTodo size={64} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">暂无记录</h3>
            <p className="text-slate-500 mb-6">
              {searchQuery ? '没有找到匹配的训练记录' : '还没有任何训练记录'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              开始新训练
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecords.map(record => (
              <RecordCard
                key={record.id}
                record={record}
                onExport={handleExport}
                onApprove={handleApprove}
                onReturn={() => setShowReturnModal(record.id)}
                isInstructor={isInstructor}
              />
            ))}
          </div>
        )}
      </main>

      {showReturnModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <RotateCcw size={24} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">退回训练记录</h2>
                <p className="text-sm text-slate-400">请说明退回原因</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">
                退回原因（必填）
              </label>
              <textarea
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="例如：方位角数据不完整，请补充所有灯塔的测量值..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-slate-500 transition-colors resize-none h-28"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowReturnModal(null); setReturnComment(''); }}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
              >
                取消
              </button>
              <button
                onClick={() => handleReturn(showReturnModal)}
                disabled={!returnComment.trim()}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认退回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordListPage;
