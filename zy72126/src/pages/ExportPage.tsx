import { useState } from 'react';
import { Download, FileSpreadsheet, FileJson, CheckCircle2, Music, AlertCircle, FileText } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppStore } from '@/store';
import { exportToExcel, exportToJSON, generateReport } from '@/utils/exporter';
import { cn } from '@/lib/utils';

export const ExportPage = () => {
  const { tracks, annotations, conflicts, importRecords } = useAppStore();
  const [format, setFormat] = useState<'xlsx' | 'json'>('xlsx');
  const [options, setOptions] = useState({
    includeAnnotations: true,
    includeConflicts: true,
    includeImportRecords: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const normalCount = tracks.filter((t) => t.status === 'normal').length;
  const conflictCount = tracks.filter((t) => t.status === 'conflict').length;
  const errorCount = tracks.filter((t) => t.status === 'error').length;

  const handleExport = () => {
    setIsExporting(true);
    setExportSuccess(false);

    setTimeout(() => {
      const exportOptions = {
        ...options,
        format,
      };

      if (format === 'xlsx') {
        exportToExcel(tracks, annotations, conflicts, importRecords, exportOptions);
      } else {
        exportToJSON(tracks, annotations, conflicts, importRecords, exportOptions);
      }

      setIsExporting(false);
      setExportSuccess(true);

      setTimeout(() => setExportSuccess(false), 3000);
    }, 1000);
  };

  const previewData = generateReport(
    tracks,
    annotations,
    conflicts,
    importRecords,
    {
      ...options,
      format,
    }
  ).slice(0, 5);

  return (
    <div>
      <PageHeader
        title="导出报告"
        subtitle="导出完整的音乐版权分成追踪报告，包含曲目、批注、冲突和导入记录"
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <div className="bg-white rounded-xl shadow-soft overflow-hidden">
            <div className="px-6 py-4 bg-olive-50 border-b border-olive-100">
              <h3 className="font-semibold text-olive-800">导出配置</h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-olive-700 mb-3">
                  导出格式
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFormat('xlsx')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all',
                      format === 'xlsx'
                        ? 'border-moss-500 bg-moss-50 text-moss-700'
                        : 'border-cream-300 bg-cream-50 text-olive-600 hover:border-olive-300'
                    )}
                  >
                    <FileSpreadsheet size={20} />
                    Excel
                  </button>
                  <button
                    onClick={() => setFormat('json')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all',
                      format === 'json'
                        ? 'border-moss-500 bg-moss-50 text-moss-700'
                        : 'border-cream-300 bg-cream-50 text-olive-600 hover:border-olive-300'
                    )}
                  >
                    <FileJson size={20} />
                    JSON
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-olive-700 mb-3">
                  包含内容
                </label>
                <div className="space-y-3">
                  {[
                    {
                      key: 'includeAnnotations',
                      label: '批注记录',
                      count: annotations.length,
                    },
                    {
                      key: 'includeConflicts',
                      label: '冲突记录',
                      count: conflicts.length,
                    },
                    {
                      key: 'includeImportRecords',
                      label: '导入记录',
                      count: importRecords.length,
                    },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between p-3 bg-cream-50 rounded-lg cursor-pointer hover:bg-cream-100 transition-colors"
                    >
                      <span className="text-olive-700">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-olive-500">{item.count} 条</span>
                        <input
                          type="checkbox"
                          checked={options[item.key as keyof typeof options]}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              [item.key]: e.target.checked,
                            })
                          }
                          className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={isExporting || tracks.length === 0}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all',
                  isExporting
                    ? 'bg-olive-300 text-white cursor-not-allowed'
                    : tracks.length === 0
                    ? 'bg-olive-200 text-olive-400 cursor-not-allowed'
                    : 'bg-olive-700 text-white hover:bg-olive-800 hover:shadow-lg active:scale-98'
                )}
              >
                {isExporting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    导出中...
                  </>
                ) : exportSuccess ? (
                  <>
                    <CheckCircle2 size={20} />
                    导出成功
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    导出报告
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-xl shadow-soft overflow-hidden">
            <div className="px-6 py-4 bg-olive-50 border-b border-olive-100">
              <h3 className="font-semibold text-olive-800">数据概览</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-olive-600">
                  <Music size={18} />
                  <span>总曲目数</span>
                </div>
                <span className="font-serif text-xl font-bold text-olive-900">
                  {tracks.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-moss-600">
                  <CheckCircle2 size={18} />
                  <span>正常曲目</span>
                </div>
                <span className="font-serif text-xl font-bold text-moss-600">
                  {normalCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle size={18} />
                  <span>待处理冲突</span>
                </div>
                <span className="font-serif text-xl font-bold text-amber-600">
                  {conflictCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brick-600">
                  <AlertCircle size={18} />
                  <span>异常项</span>
                </div>
                <span className="font-serif text-xl font-bold text-brick-600">
                  {errorCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-8">
          <div className="bg-white rounded-xl shadow-soft overflow-hidden">
            <div className="px-6 py-4 bg-olive-50 border-b border-olive-100 flex items-center justify-between">
              <h3 className="font-semibold text-olive-800 flex items-center gap-2">
                <FileText size={18} />
                报告预览
              </h3>
              <span className="text-sm text-olive-500">
                显示前 {previewData.length} 条记录
              </span>
            </div>

            {previewData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-cream-50">
                    <tr>
                      {Object.keys(previewData[0]).map((key) => (
                        <th
                          key={key}
                          className="px-4 py-3 text-left text-xs font-semibold text-olive-600 whitespace-nowrap"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200">
                    {previewData.map((row, i) => (
                      <tr key={i} className="hover:bg-cream-50/50">
                        {Object.values(row).map((value, j) => (
                          <td key={j} className="px-4 py-3 text-sm text-olive-700 whitespace-nowrap">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <FileText size={48} className="mx-auto text-olive-300 mb-4" />
                <p className="text-olive-500">暂无数据可导出</p>
                <p className="text-sm text-olive-400 mt-1">请先导入音频文件</p>
              </div>
            )}
          </div>

          <div className="mt-6 p-6 bg-amber-50 rounded-xl border border-amber-200">
            <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <AlertCircle size={18} />
              导出说明
            </h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• 所有导出文件包含异常原因说明，便于后续追踪</li>
              <li>• 冲突记录会保留双方证据和裁决结果，确保数据完整</li>
              <li>• 批注记录包含版本号和差异说明，支持审计追溯</li>
              <li>• 报告和明细数据保持一致，避免两套说法</li>
              <li>• 数据完全本地存储，导出后可安全传输</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
