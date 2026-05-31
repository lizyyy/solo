import { useState } from 'react';
import { X, Download, FileText, FileJson, MapPin, Check } from 'lucide-react';
import { useUiStore } from '../../store/useUiStore';
import { useRecordsStore } from '../../store/useRecordsStore';
import { exportRecordsToCSV, exportToJSON, downloadFile } from '../../utils/export';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

export function ExportModal() {
  const { activeModal, closeModal } = useUiStore();
  const { records, history, issues, routeVersions } = useRecordsStore();

  const [exportType, setExportType] = useState<'csv' | 'json' | 'kml'>('csv');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (activeModal !== 'export') return null;

  const handleExport = async () => {
    setLoading(true);
    try {
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');

      switch (exportType) {
        case 'csv': {
          const csv = exportRecordsToCSV(records);
          downloadFile(csv, `空域协同记录_${timestamp}.csv`, 'text/csv');
          break;
        }
        case 'json': {
          const json = exportToJSON(records, history, issues, routeVersions);
          downloadFile(json, `空域协同完整备份_${timestamp}.json`, 'application/json');
          break;
        }
        case 'kml': {
          const currentRoutes = records
            .map((r) => routeVersions.find((v) => v.id === r.currentRouteVersionId))
            .filter((v) => v !== undefined);

          if (currentRoutes.length > 0) {
            const allKml = currentRoutes
              .map((v) => `<!-- ${v!.recordId} - ${v!.routeData.name} -->\n${v!.kmlData}`)
              .join('\n\n');
            downloadFile(allKml, `全部航线_${timestamp}.kml`, 'application/vnd.google-earth.kml+xml');
          }
          break;
        }
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setExportType('csv');
    setSuccess(false);
    closeModal();
  };

  const exportOptions = [
    {
      id: 'csv' as const,
      label: 'CSV 表格',
      desc: '导出记录列表为CSV表格',
      icon: FileText,
      count: records.length,
    },
    {
      id: 'json' as const,
      label: 'JSON 完整备份',
      desc: '导出所有数据（含历史、问题、航线版本）',
      icon: FileJson,
      count: records.length + history.length + issues.length + routeVersions.length,
    },
    {
      id: 'kml' as const,
      label: 'KML 航线',
      desc: '导出所有当前航线版本为KML',
      icon: MapPin,
      count: records.filter((r) => r.currentRouteVersionId).length,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 rounded-xl border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-slate-200">导出数据</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-green-400 font-medium">导出成功</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {exportOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setExportType(option.id)}
                    className={cn(
                      'w-full p-4 rounded-lg border text-left transition-colors flex items-center gap-4',
                      exportType === option.id
                        ? 'border-orange-500/50 bg-orange-500/10'
                        : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30'
                    )}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center',
                        exportType === option.id
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-slate-800 text-slate-400'
                      )}
                    >
                      <option.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-200">{option.label}</p>
                      <p className="text-xs text-slate-500">{option.desc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-bold text-slate-300">{option.count}</p>
                      <p className="text-xs text-slate-500">条数据</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-400">
                  <span className="font-medium">提示：</span>
                  JSON格式包含完整的操作历史和航线版本，适合数据备份。CSV格式适合在表格软件中查看。KML格式可在Google Earth等地图软件中打开。
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-700/50 bg-slate-900/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            取消
          </button>
          {!success && (
            <button
              onClick={handleExport}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  导出
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
