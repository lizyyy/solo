import { useDataStore } from '@/store/useDataStore';
import { formatDateTime } from '@/utils/csvParser';
import { DataQualityBadges } from '@/components/common/DataQualityBadges';
import { Table, AlertTriangle, Eye } from 'lucide-react';
import { FIELD_LABELS, FIELD_UNITS } from '@/config/thresholds';

export function DataPreview() {
  const { records, selectedRecordId, setSelectedRecordId } = useDataStore();

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Table className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>暂无数据，请先导入或加载样例数据</p>
      </div>
    );
  }

  const previewRecords = records.slice(0, 10);
  const hasMore = records.length > 10;

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-400" />
          数据预览
          <span className="text-sm font-normal text-slate-400">
            （{hasMore ? `前10条 / 共${records.length}条` : `${records.length}条记录`}）
          </span>
        </h3>
        {records.some((r) => r.dataQuality.isNull || r.dataQuality.isDuplicate || r.dataQuality.isBoundary) && (
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>检测到数据质量问题</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-400">记录ID</th>
              <th className="px-4 py-3 text-left font-medium text-slate-400">时间</th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">
                {FIELD_LABELS.temperature} ({FIELD_UNITS.temperature})
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">
                {FIELD_LABELS.voltage} ({FIELD_UNITS.voltage})
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">
                {FIELD_LABELS.current} ({FIELD_UNITS.current})
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">
                {FIELD_LABELS.internalResistance} ({FIELD_UNITS.internalResistance})
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-400">数据质量</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {previewRecords.map((record) => (
              <tr
                key={record.id}
                onClick={() => setSelectedRecordId(record.id === selectedRecordId ? null : record.id)}
                className={`cursor-pointer transition-colors ${getRowClass(record)}`}
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{record.id}</td>
                <td className="px-4 py-3 text-slate-300">{formatDateTime(record.timestamp)}</td>
                <td className={`px-4 py-3 text-right font-mono ${
                  record.temperature === null
                    ? 'text-slate-500 bg-slate-800/50'
                    : record.dataQuality.isExtreme
                      ? 'text-red-400 font-bold'
                      : 'text-slate-300'
                }`}>
                  {record.temperature?.toFixed(1) ?? <span className="text-slate-600">—</span>}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${
                  record.voltage === null ? 'text-slate-500 bg-slate-800/50' : 'text-slate-300'
                }`}>
                  {record.voltage?.toFixed(2) ?? <span className="text-slate-600">—</span>}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${
                  record.current === null ? 'text-slate-500 bg-slate-800/50' : 'text-slate-300'
                }`}>
                  {record.current?.toFixed(1) ?? <span className="text-slate-600">—</span>}
                </td>
                <td className={`px-4 py-3 text-right font-mono ${
                  record.internalResistance === null ? 'text-slate-500 bg-slate-800/50' : 'text-slate-300'
                }`}>
                  {record.internalResistance?.toFixed(1) ?? <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3">
                  <DataQualityBadges quality={record.dataQuality} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <p className="text-center text-sm text-slate-500">
          ...还有 {records.length - 10} 条记录，完整数据请在分析仪表盘查看
        </p>
      )}
    </div>
  );
}
