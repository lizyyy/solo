import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge, ParameterBadge } from '@/components/common/Badges';
import type { RecordStatus } from '@/types';
import { AlertTriangle, CheckCircle, XCircle, FileWarning, ChevronRight, Clock, Eye, ArrowRight } from 'lucide-react';

const columns: { status: RecordStatus; label: string; color: string; icon: typeof AlertTriangle }[] = [
  { status: 'confirmed', label: '已确认', color: 'nautical-success', icon: CheckCircle },
  { status: 'supplement', label: '待补件', color: 'nautical-warning', icon: FileWarning },
  { status: 'returned', label: '退回', color: 'nautical-danger', icon: XCircle },
];

export default function Review() {
  const { records, updateRecordStatus, getMissingEvidenceCount } = useAppStore();
  const [draggedRecord, setDraggedRecord] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<RecordStatus | null>(null);

  const getRecordsByStatus = (status: RecordStatus) => {
    return records.filter((r) => r.status === status);
  };

  const handleDragStart = (recordId: string) => {
    setDraggedRecord(recordId);
  };

  const handleDragOver = (e: React.DragEvent, status: RecordStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDrop = (status: RecordStatus) => {
    if (draggedRecord) {
      updateRecordStatus(draggedRecord, status);
    }
    setDraggedRecord(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedRecord(null);
    setDragOverColumn(null);
  };

  const missingEvidenceCount = getMissingEvidenceCount();
  const supplementRecords = getRecordsByStatus('supplement');
  const totalRecords = records.length;
  const confirmedCount = getRecordsByStatus('confirmed').length;
  const progressPercent = totalRecords ? Math.round((confirmedCount / totalRecords) * 100) : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="bg-ocean-900/80 backdrop-blur border-b border-ocean-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">月度复核视图</h1>
            <p className="text-sm text-ocean-400 mt-0.5">
              2026年6月 · 已确认 {confirmedCount} / {totalRecords} · 完成度 {progressPercent}%
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-ocean-800 hover:bg-ocean-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Eye className="w-4 h-4" />
              项目经理视角
            </button>
          </div>
        </div>
      </header>

      <div className="px-6 py-4 bg-ocean-800/20 border-b border-ocean-700">
        <div className="bg-gradient-to-r from-nautical-warning/20 to-nautical-warning/5 border border-nautical-warning/30 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-nautical-warning/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-7 h-7 text-nautical-warning animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">
                  证据缺口总览
                </h3>
                <p className="text-sm text-ocean-300">
                  本月共有 <span className="text-nautical-warning font-bold text-lg">{supplementRecords.length}</span> 条记录待补件，
                  累计 <span className="text-nautical-warning font-bold text-lg">{missingEvidenceCount}</span> 项证据缺失
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-nautical-warning font-mono">
                {missingEvidenceCount}
              </p>
              <p className="text-xs text-ocean-400 mt-1">待补证据项</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-ocean-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-ocean-400">现场照片</span>
                <span className="text-sm font-mono text-nautical-warning">3 张</span>
              </div>
              <div className="h-2 bg-ocean-700 rounded-full overflow-hidden">
                <div className="h-full bg-nautical-warning/60 rounded-full" style={{ width: '60%' }} />
              </div>
            </div>
            <div className="bg-ocean-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-ocean-400">重测数据</span>
                <span className="text-sm font-mono text-nautical-warning">2 份</span>
              </div>
              <div className="h-2 bg-ocean-700 rounded-full overflow-hidden">
                <div className="h-full bg-nautical-warning/60 rounded-full" style={{ width: '40%' }} />
              </div>
            </div>
            <div className="bg-ocean-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-ocean-400">佐证文档</span>
                <span className="text-sm font-mono text-nautical-warning">2 份</span>
              </div>
              <div className="h-2 bg-ocean-700 rounded-full overflow-hidden">
                <div className="h-full bg-nautical-warning/60 rounded-full" style={{ width: '30%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {columns.map((column) => {
          const columnRecords = getRecordsByStatus(column.status);
          const isDragOver = dragOverColumn === column.status;
          const Icon = column.icon;

          return (
            <div
              key={column.status}
              className={`flex-1 flex flex-col rounded-xl border transition-all duration-200 ${
                isDragOver
                  ? `border-${column.color} bg-${column.color}/5`
                  : 'border-ocean-700 bg-ocean-800/30'
              }`}
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDrop={() => handleDrop(column.status)}
              onDragLeave={() => setDragOverColumn(null)}
            >
              <div className="p-4 border-b border-ocean-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    column.status === 'confirmed' ? 'bg-nautical-success/20' :
                    column.status === 'supplement' ? 'bg-nautical-warning/20' :
                    'bg-nautical-danger/20'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      column.status === 'confirmed' ? 'text-nautical-success' :
                      column.status === 'supplement' ? 'text-nautical-warning' :
                      'text-nautical-danger'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{column.label}</h3>
                    <p className="text-xs text-ocean-500">{columnRecords.length} 条记录</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${
                  column.status === 'confirmed' ? 'bg-nautical-success/20 text-nautical-success' :
                  column.status === 'supplement' ? 'bg-nautical-warning/20 text-nautical-warning' :
                  'bg-nautical-danger/20 text-nautical-danger'
                }`}>
                  {columnRecords.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {columnRecords.map((record) => (
                  <div
                    key={record.id}
                    draggable
                    onDragStart={() => handleDragStart(record.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-ocean-800/70 border border-ocean-700 rounded-lg p-4 cursor-grab active:cursor-grabbing transition-all hover:border-ocean-600 hover:shadow-lg ${
                      draggedRecord === record.id ? 'opacity-50 scale-95' : ''
                    } ${record.hasSupplementaryNote ? 'corner-fold' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <ParameterBadge type={record.parameterType} />
                      {record.hasDrift && (
                        <span className="text-xs px-1.5 py-0.5 bg-nautical-warning/20 text-nautical-warning rounded">
                          漂移
                        </span>
                      )}
                    </div>

                    <div className="mb-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-white font-mono">
                          {record.cleanedValue.toFixed(2)}
                        </span>
                        <span className="text-xs text-ocean-400">{record.unit}</span>
                      </div>
                    </div>

                    <div className="text-sm text-ocean-300 mb-1">
                      {record.shipName} · {record.location}
                    </div>
                    <div className="text-xs text-ocean-500 font-mono">
                      {record.measureDate} {record.measureTime}
                    </div>

                    {record.missingEvidence.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-ocean-700/50">
                        <p className="text-xs text-nautical-warning mb-1.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          缺失证据 ({record.missingEvidence.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {record.missingEvidence.map((item, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-0.5 bg-nautical-warning/10 text-nautical-warning/80 rounded"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <button className="text-xs text-ocean-400 hover:text-white flex items-center gap-1 transition-colors">
                        查看详情
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {columnRecords.length === 0 && (
                  <div className="text-center py-8">
                    <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                      column.status === 'confirmed' ? 'bg-nautical-success/10' :
                      column.status === 'supplement' ? 'bg-nautical-warning/10' :
                      'bg-nautical-danger/10'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        column.status === 'confirmed' ? 'text-nautical-success/50' :
                        column.status === 'supplement' ? 'text-nautical-warning/50' :
                        'text-nautical-danger/50'
                      }`} />
                    </div>
                    <p className="text-sm text-ocean-500">暂无记录</p>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-ocean-700">
                <button className="w-full py-2 text-sm text-ocean-400 hover:text-white hover:bg-ocean-700/50 rounded-lg transition-colors flex items-center justify-center gap-2">
                  批量操作
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
