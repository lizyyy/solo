import React, { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExperimentRecord } from '@/types';
import { exportRecordsToCsv, downloadCsv } from '@/utils/export/csv';
import { exportRecordsToJson, downloadJson } from '@/utils/export/json';

interface ExportPreviewProps {
  records: ExperimentRecord[];
}

export const ExportPreview: React.FC<ExportPreviewProps> = ({ records }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExportCsv = async () => {
    setIsExporting(true);
    setExportProgress(0);

    for (let i = 0; i <= 100; i += 20) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      setExportProgress(i);
    }

    const csv = exportRecordsToCsv(records);
    const filename = `三体引力实验记录_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCsv(csv, filename);

    setIsExporting(false);
    setExportProgress(0);
  };

  const handleExportJson = async () => {
    setIsExporting(true);
    setExportProgress(0);

    for (let i = 0; i <= 100; i += 20) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      setExportProgress(i);
    }

    const json = exportRecordsToJson(records);
    const filename = `三体引力实验记录_${new Date().toISOString().split('T')[0]}.json`;
    downloadJson(json, filename);

    setIsExporting(false);
    setExportProgress(0);
  };

  if (records.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 font-mono text-sm">没有可导出的记录</p>
        <p className="text-gray-600 font-mono text-xs mt-1">请先完成一些实验或调整筛选条件</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-300 font-mono">数据导出</h3>
          <p className="text-[10px] text-gray-500 font-mono">
            共 {records.length} 条记录将被导出，包含所有错误标记和备注版本
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold transition-all',
              'bg-green-600 hover:bg-green-500 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'active:scale-95'
            )}
          >
            {isExporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            导出 CSV
          </button>
          <button
            onClick={handleExportJson}
            disabled={isExporting}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold transition-all',
              'bg-blue-600 hover:bg-blue-500 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'active:scale-95'
            )}
          >
            {isExporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileJson size={16} />
            )}
            导出 JSON
          </button>
        </div>
      </div>

      {isExporting && (
        <div className="space-y-2">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-200"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 font-mono text-right">
            正在处理数据... {exportProgress}%
          </p>
        </div>
      )}

      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-500 text-left">
                <th className="px-3 py-2 border-b border-gray-800">时间</th>
                <th className="px-3 py-2 border-b border-gray-800">结果</th>
                <th className="px-3 py-2 border-b border-gray-800">角度</th>
                <th className="px-3 py-2 border-b border-gray-800">速度</th>
                <th className="px-3 py-2 border-b border-gray-800">总能量</th>
                <th className="px-3 py-2 border-b border-gray-800">异常</th>
                <th className="px-3 py-2 border-b border-gray-800">备注</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 50).map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-3 py-2 text-gray-400">
                    {new Date(record.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold',
                        record.conclusion.result === 'escape' && 'bg-green-500/20 text-green-400',
                        record.conclusion.result === 'collide' && 'bg-red-500/20 text-red-400',
                        record.conclusion.result === 'orbit' && 'bg-blue-500/20 text-blue-400',
                        record.conclusion.result === 'chaos' && 'bg-purple-500/20 text-purple-400',
                        record.conclusion.result === 'timeout' && 'bg-yellow-500/20 text-yellow-400'
                      )}
                    >
                      {record.conclusion.result}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400">{record.raw.launchAngle.toFixed(1)}°</td>
                  <td className="px-3 py-2 text-gray-400">{record.raw.launchSpeed.toFixed(1)}</td>
                  <td
                    className={cn(
                      'px-3 py-2 font-bold',
                      record.conclusion.finalEnergy.total > 0 ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {record.conclusion.finalEnergy.total.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    {record.conclusion.errorMarks.length > 0 ? (
                      <span className="text-orange-400">
                        {record.conclusion.errorMarks.length} 个
                      </span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {record.noteVersions.length > 0 ? (
                      <span className="text-purple-400">
                        v{record.noteVersions.length}
                      </span>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.length > 50 && (
          <div className="px-3 py-2 bg-gray-900 border-t border-gray-800 text-[10px] text-gray-500 font-mono text-center">
            仅显示前 50 条预览，共 {records.length} 条记录将被完整导出
          </div>
        )}
      </div>
    </div>
  );
};
