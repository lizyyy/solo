import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, RefreshCw, Calculator, FileCheck, ChevronDown, ChevronUp, Play } from 'lucide-react';
import useSelfcheckStore from '@/stores/selfcheckStore';
import useImportStore from '@/stores/importStore';
import StatusBadge from '@/components/StatusBadge';

const CHECK_TYPES = [
  { key: 'duplicate_import', title: '重复导入检测', Icon: Copy },
  { key: 'sensor_id_changed', title: '传感器编号变更', Icon: RefreshCw },
  { key: 'recalc_after_supplement', title: '补录后重算', Icon: Calculator },
  { key: 'export_consistency', title: '导出一致性', Icon: FileCheck },
] as const;

const borderMap: Record<string, string> = {
  pass: 'border-emerald-400',
  warning: 'border-amber-400',
  fail: 'border-red-400',
};

export default function Selfcheck() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryImportId = searchParams.get('importId') || '';
  const [selectedImportId, setSelectedImportId] = useState(queryImportId);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { results, loading, runChecks } = useSelfcheckStore();
  const { importHistory, fetchHistory } = useImportStore();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (queryImportId && queryImportId !== selectedImportId) {
      setSelectedImportId(queryImportId);
    }
  }, [queryImportId, selectedImportId]);

  const handleImportChange = useCallback((id: string) => {
    setSelectedImportId(id);
    setSearchParams(id ? { importId: id } : {}, { replace: true });
  }, [setSearchParams]);

  const handleRunChecks = useCallback(async () => {
    if (!selectedImportId) return;
    try {
      await runChecks(selectedImportId);
    } catch {
      /* ignore check errors */
    }
  }, [selectedImportId, runChecks]);

  const getResult = (key: string) => results.find((r) => r.check_type === key);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">自检面板</h1>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={selectedImportId}
          onChange={(e) => handleImportChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
        >
          <option value="">选择导入批次</option>
          {importHistory.map((imp) => (
            <option key={imp.id} value={imp.id}>
              {imp.batch_label || imp.id}
            </option>
          ))}
        </select>

        <button
          onClick={handleRunChecks}
          disabled={!selectedImportId || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-4 h-4" />
          运行自检
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-500">正在运行自检...</span>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {CHECK_TYPES.map(({ key, title, Icon }) => {
            const result = getResult(key);
            const status = result?.status || '';
            const message = result?.message || '';
            const details = result?.details ? (typeof result.details === 'string' ? JSON.parse(result.details) : result.details) : null;
            const detailCount = Array.isArray(details) ? details.length : details ? Object.keys(details).length : 0;

            return (
              <div
                key={key}
                className={`rounded-xl border-2 bg-white p-5 cursor-pointer transition-all hover:shadow-md ${borderMap[status] || 'border-gray-200'}`}
                onClick={() => toggleExpand(key)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${status === 'pass' ? 'bg-emerald-50' : status === 'warning' ? 'bg-amber-50' : status === 'fail' ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <Icon className={`w-5 h-5 ${status === 'pass' ? 'text-emerald-600' : status === 'warning' ? 'text-amber-600' : status === 'fail' ? 'text-red-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{title}</h3>
                      {message && <p className="text-sm text-gray-500 mt-0.5">{message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {status && <StatusBadge status={status} size="sm" />}
                    {detailCount > 0 && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {detailCount} 条
                      </span>
                    )}
                    {expanded === key ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {expanded === key && details && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {Array.isArray(details) ? (
                      <ul className="space-y-1 text-sm text-gray-600">
                        {details.map((item: unknown, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">•</span>
                            <span>{typeof item === 'string' ? item : JSON.stringify(item, null, 2)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto">
                        {JSON.stringify(details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && results.length === 0 && selectedImportId && (
        <div className="text-center py-12 text-gray-400">
          点击"运行自检"开始检查
        </div>
      )}

      {!selectedImportId && (
        <div className="text-center py-12 text-gray-400">
          请先选择导入批次
        </div>
      )}
    </div>
  );
}
