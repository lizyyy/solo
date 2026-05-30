import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { RecordsTable } from '../components/RecordsTable';
import { ExceptionList } from '../components/ExceptionList';
import {
  ListTodo,
  AlertTriangle,
  Filter,
  Download,
  Plus,
  Database,
} from 'lucide-react';
import {
  filterRecordsByStatus,
  filterRecordsByType,
  filterRecordsByBatch,
  createGameRecord,
} from '../utils/recordManager';
import { functionCards } from '../data/functionCards';
import { RecordStatus, RecordType } from '../types';

export const Records = () => {
  const {
    records,
    exceptions,
    currentBatchId,
    withdrawRecord,
    markDuplicate,
    updateNotes,
    confirmGameRecord,
    confirmExceptionRecord,
    addRecord,
    loadSampleData,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<'records' | 'exceptions'>('records');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBatch, setFilterBatch] = useState<string>('current');

  const allBatchIds = [...new Set(records.map((r) => r.batchId))];

  const filteredRecords = records.filter((record) => {
    const statusMatch =
      filterStatus === 'all' || record.status === filterStatus;
    const typeMatch = filterType === 'all' || record.recordType === filterType;
    const batchMatch =
      filterBatch === 'all' ||
      (filterBatch === 'current' && record.batchId === currentBatchId) ||
      record.batchId === filterBatch;
    return statusMatch && typeMatch && batchMatch;
  });

  const filteredExceptions = exceptions.filter((e) => {
    if (filterBatch === 'all') return true;
    if (filterBatch === 'current') return e.batchId === currentBatchId;
    return e.batchId === filterBatch;
  });

  const statusLabels: Record<string, string> = {
    all: '全部状态',
    normal: '正常',
    pending: '待确认',
    exception: '异常',
  };

  const typeLabels: Record<string, string> = {
    all: '全部类型',
    normal: '正常',
    late: '晚补',
    withdrawn: '撤回',
    duplicate: '重复',
  };

  const handleAddLateRecord = () => {
    if (functionCards.length === 0) return;

    const card = functionCards[0];
    const x = card.domain[0] + Math.random() * (card.domain[1] - card.domain[0]);
    const y = card.fn(x);

    const newRecord = createGameRecord(
      currentBatchId,
      `game-${Date.now()}`,
      card.id,
      { x, y },
      0,
      true,
      0.5,
      'pending',
      'late'
    );

    addRecord(newRecord);
  };

  useEffect(() => {
    if (records.length === 0 && exceptions.length === 0) {
      loadSampleData();
    }
  }, [records.length, exceptions.length, loadSampleData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 font-orbitron">
              记录管理
            </h1>
            <p className="text-slate-400">
              查看和管理所有游戏记录，支持补录、撤回、标记重复等操作
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddLateRecord}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              补录记录
            </button>
            <button
              onClick={loadSampleData}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
              <Database className="w-4 h-4" />
              加载示例数据
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('records')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === 'records'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              游戏记录 ({filteredRecords.length})
            </button>
            <button
              onClick={() => setActiveTab('exceptions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === 'exceptions'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              异常清单 ({filteredExceptions.filter(e => !e.confirmed).length})
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="current">当前批次</option>
              <option value="all">全部批次</option>
              {allBatchIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            {activeTab === 'records' && (
              <>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {activeTab === 'records' ? (
          <RecordsTable
            records={filteredRecords}
            onWithdraw={withdrawRecord}
            onMarkDuplicate={markDuplicate}
            onUpdateNotes={updateNotes}
            onConfirm={confirmGameRecord}
          />
        ) : (
          <ExceptionList
            exceptions={filteredExceptions}
            onConfirm={confirmExceptionRecord}
          />
        )}

        <div className="mt-8 grid grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-1">总记录数</p>
            <p className="text-2xl font-bold text-white font-orbitron">
              {records.length}
            </p>
          </div>
          <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
            <p className="text-xs text-green-400 mb-1">正常记录</p>
            <p className="text-2xl font-bold text-green-400 font-orbitron">
              {filterRecordsByStatus(records, 'normal').length}
            </p>
          </div>
          <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
            <p className="text-xs text-yellow-400 mb-1">待确认</p>
            <p className="text-2xl font-bold text-yellow-400 font-orbitron">
              {filterRecordsByStatus(records, 'pending').length}
            </p>
          </div>
          <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
            <p className="text-xs text-red-400 mb-1">晚补记录</p>
            <p className="text-2xl font-bold text-red-400 font-orbitron">
              {filterRecordsByType(records, 'late').length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
