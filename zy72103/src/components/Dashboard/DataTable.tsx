import { useState } from 'react';
import { useDataStore } from '@/store/useDataStore';
import { formatDateTime } from '@/utils/csvParser';
import { DataQualityBadges } from '@/components/common/DataQualityBadges';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RESULT_LABELS, FIELD_LABELS, FIELD_UNITS } from '@/config/thresholds';
import { Table, FileText, Plus, ChevronDown, ChevronRight } from 'lucide-react';

interface DataTableProps {
  onAddNote: () => void;
}

export function DataTable({ onAddNote }: DataTableProps) {
  const { records, selectedRecordId, setSelectedRecordId, isAnalyzed } = useDataStore();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (records.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Table className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-slate-200">数据明细</h3>
        </div>
        <div className="text-center py-16 text-slate-500">
          <Table className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请先导入数据并运行分析</p>
        </div>
      </div>
    );
  }

  const getRowClass = (record: typeof records[0]) => {
    if (record.id === selectedRecordId) {
      return 'bg-red-500/20 border-l-2 border-l-red-500';
    }
    if (record.dataQuality.isExtreme) {
      return 'bg-red-500/5 hover:bg-red-500/10 border-l-2 border-l-transparent';
    }
    if (record.dataQuality.isNull || record.dataQuality.isDuplicate) {
      return 'bg-slate-800/50 hover:bg-slate-700/50 border-l-2 border-l-transparent';
    }
    return 'hover:bg-slate-700/30 border-l-2 border-l-transparent';
  };

  const getLastResult = (record: typeof records[0]) => {
    if (record.detectionSteps.length === 0) return null;
    return record.detectionSteps[record.detectionSteps.length - 1].result;
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <Table className="w-5 h-5 text-blue-400" />
          数据明细
          <span className="text-sm font-normal text-slate-400">
            （{records.length} 条记录）
          </span>
        </h3>
        {selectedRecordId && (
          <button
            onClick={onAddNote}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            补录备注
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700 max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 sticky top-0">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-slate-400 w-8"></th>
              <th className="px-3 py-3 text-left font-medium text-slate-400">记录ID</th>
              <th className="px-3 py-3 text-left font-medium text-slate-400">时间</th>
              <th className="px-3 py-3 text-right font-medium text-slate-400">
                {FIELD_LABELS.temperature}
              </th>
              <th className="px-3 py-3 text-right font-medium text-slate-400">
                {FIELD_LABELS.voltage}
              </th>
              <th className="px-3 py-3 text-right font-medium text-slate-400">
                {FIELD_LABELS.current}
              </th>
              <th className="px-3 py-3 text-right font-medium text-slate-400">
                {FIELD_LABELS.internalResistance}
              </th>
              <th className="px-3 py-3 text-left font-medium text-slate-400">判定结果</th>
              <th className="px-3 py-3 text-left font-medium text-slate-400">数据质量</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {records.map((record) => {
              const lastResult = getLastResult(record);
              const isExpanded = expandedRow === record.id;

              return (
                <>
                  <tr
                    key={record.id}
                    onClick={() => {
                      setSelectedRecordId(record.id === selectedRecordId ? null : record.id);
                    }}
                    className={`cursor-pointer transition-colors ${getRowClass(record)}`}
                  >
                    <td className="px-3 py-2">
                      {isAnalyzed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRow(isExpanded ? null : record.id);
                          }}
                          className="p-1 hover:bg-slate-600 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{record.id}</td>
                    <td className="px-3 py-2 text-slate-300 text-xs">{formatDateTime(record.timestamp)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${
                      record.temperature === null
                        ? 'text-slate-500 bg-slate-800/50'
                        : record.dataQuality.isExtreme
                          ? 'text-red-400 font-bold'
                          : 'text-slate-300'
                    }`}>
                      {record.temperature?.toFixed(1) ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${
                      record.voltage === null ? 'text-slate-500 bg-slate-800/50' : 'text-slate-300'
                    }`}>
                      {record.voltage?.toFixed(2) ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${
                      record.current === null ? 'text-slate-500 bg-slate-800/50' : 'text-slate-300'
                    }`}>
                      {record.current?.toFixed(1) ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${
                      record.internalResistance === null ? 'text-slate-500 bg-slate-800/50' : 'text-slate-300'
                    }`}>
                      {record.internalResistance?.toFixed(1) ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isAnalyzed && lastResult ? (
                        <StatusBadge type={lastResult} size="sm">
                          {RESULT_LABELS[lastResult]}
                        </StatusBadge>
                      ) : (
                        <span className="text-slate-500 text-xs">未分析</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <DataQualityBadges quality={record.dataQuality} />
                    </td>
                  </tr>
                  {isExpanded && isAnalyzed && (
                    <tr className="bg-slate-900/50">
                      <td colSpan={9} className="px-6 py-4">
                        <div className="space-y-2">
                          {record.detectionSteps.map((step, idx) => (
                            <div key={step.step} className="flex items-start gap-3 text-sm">
                              <span className="text-slate-500 font-mono w-6">{idx + 1}.</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300 font-medium">{step.step}</span>
                                  <StatusBadge type={step.result} size="sm">
                                    {RESULT_LABELS[step.result]}
                                  </StatusBadge>
                                </div>
                                <div className="text-xs text-slate-400 font-mono mt-1 bg-slate-800 p-2 rounded">
                                  {step.formula}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-slate-300">
                                  {step.value.toFixed(1)} / {step.threshold.toFixed(1)}
                                </div>
                              </div>
                            </div>
                          ))}
                          {record.supplementNote && (
                            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                              <div className="flex items-center gap-2 text-xs text-blue-400 mb-1">
                                <FileText className="w-3 h-3" />
                                补录备注 · {record.supplementNote.author}
                              </div>
                              <p className="text-sm text-slate-300">{record.supplementNote.content}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-3 text-center">
        点击行选择记录 · 点击箭头展开查看判断过程 · 选择记录后可补录备注
      </p>
    </div>
  );
}
