import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ShieldCheck, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import useImportStore from '@/stores/importStore';
import type { ExportVerifyResult, ReviewRecord } from '@/types';

type ExportScope = 'all' | 'anomaly' | 'pending';

const SCOPE_OPTIONS: { value: ExportScope; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'anomaly', label: '仅异常' },
  { value: 'pending', label: '仅待复核' },
];

export default function Export() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryImportId = searchParams.get('importId') || '';
  const [selectedImportId, setSelectedImportId] = useState(queryImportId);
  const [scope, setScope] = useState<ExportScope>('all');
  const [verifyResult, setVerifyResult] = useState<ExportVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<ReviewRecord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

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
    setVerifyResult(null);
    setPreviewRecords([]);
    setSearchParams(id ? { importId: id } : {}, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (!selectedImportId) {
      setPreviewRecords([]);
      return;
    }
    setPreviewLoading(true);
    api.review.batch(selectedImportId)
      .then((data) => {
        const records = Array.isArray(data?.records) ? data.records : [];
        setPreviewRecords(records.slice(0, 10));
      })
      .catch(() => setPreviewRecords([]))
      .finally(() => setPreviewLoading(false));
  }, [selectedImportId]);

  const handleDownload = useCallback(() => {
    if (!selectedImportId) return;
    const url = api.export.download(selectedImportId, scope);
    window.open(url, '_blank');
  }, [selectedImportId, scope]);

  const handleVerify = useCallback(async () => {
    if (!selectedImportId) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const data = await api.export.verify(selectedImportId);
      setVerifyResult(data);
    } catch {
      setVerifyResult({ dataHash: '', csvHash: '', consistent: false, recordCount: 0, error: true });
    } finally {
      setVerifying(false);
    }
  }, [selectedImportId]);

  const previewColumns = previewRecords.length > 0
    ? Object.keys(previewRecords[0] as unknown as Record<string, unknown>).filter((k) => typeof (previewRecords[0] as unknown as Record<string, unknown>)[k] !== 'object')
    : [];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">数据导出</h1>

      <div className="flex items-center gap-4 flex-wrap">
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
      </div>

      {selectedImportId && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">导出范围</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setScope(opt.value)}
                    className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                      scope === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">格式</span>
              <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-lg font-medium">CSV</span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出
              </button>

              <button
                onClick={handleVerify}
                disabled={verifying}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {verifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                一致性校验
              </button>
            </div>
          </div>

          {verifyResult && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">校验结果</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <div className="text-xs text-gray-500 mb-1">数据哈希</div>
                  <div className="text-sm font-mono text-gray-800 break-all">{verifyResult.dataHash || '-'}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <div className="text-xs text-gray-500 mb-1">CSV 哈希</div>
                  <div className="text-sm font-mono text-gray-800 break-all">{verifyResult.csvHash || '-'}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <div className="text-xs text-gray-500 mb-1">一致性</div>
                  <div className="flex items-center justify-center gap-1">
                    {verifyResult.consistent ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${verifyResult.consistent ? 'text-emerald-600' : 'text-red-600'}`}>
                      {verifyResult.consistent ? '一致' : '不一致'}
                    </span>
                  </div>
                </div>
              </div>
              {verifyResult.recordCount != null && (
                <div className="mt-3 text-sm text-gray-500">
                  记录总数: <span className="font-medium text-gray-700">{verifyResult.recordCount}</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">预览 (前 10 条)</h3>

            {previewLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-500 text-sm">加载预览...</span>
              </div>
            )}

            {!previewLoading && previewRecords.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {previewColumns.map((col) => (
                        <th key={col} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRecords.map((record, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {previewColumns.map((col) => (
                          <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                            {(record as unknown as Record<string, unknown>)[col] != null ? String((record as unknown as Record<string, unknown>)[col]) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!previewLoading && previewRecords.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">暂无预览数据</div>
            )}
          </div>
        </>
      )}

      {!selectedImportId && (
        <div className="text-center py-12 text-gray-400">请先选择导入批次</div>
      )}
    </div>
  );
}
