import { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Upload, FileText, Download, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { CsvImportResult } from '../../../shared/types';
import { api } from '@/api/client';
import { useAppStore } from '@/store/useAppStore';
import { clsx } from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: CsvImportResult) => void;
}

export function CsvImportModal({ open, onClose, onSuccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, string>>>([]);

  const fetchMaterials = useAppStore(s => s.fetchMaterials);
  const fetchStats = useAppStore(s => s.fetchStats);
  const fetchHistoryAll = useAppStore(s => s.fetchHistoryAll);

  const reset = () => {
    setFileName('');
    setPreviewText('');
    setMode('file');
    setError(null);
    setResult(null);
    setPreviewRows([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);
    setParsing(true);
    try {
      const text = await file.text();
      setPreviewText(text);
      const pv = await api.csvParsePreview(text);
      setPreviewRows(pv.rows);
    } catch (e: any) {
      setError(e.message || '解析失败');
    } finally {
      setParsing(false);
    }
  };

  const handlePasteParse = async () => {
    if (!previewText.trim()) {
      setError('请粘贴CSV内容');
      return;
    }
    setError(null);
    setResult(null);
    setParsing(true);
    try {
      const pv = await api.csvParsePreview(previewText);
      setPreviewRows(pv.rows);
    } catch (e: any) {
      setError(e.message || '解析失败');
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!previewText.trim()) {
      setError('请先上传文件或粘贴CSV内容');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const r = await api.csvImportContent(previewText, '阿宁');
      setResult(r);
      await Promise.all([
        fetchMaterials(),
        fetchStats(),
        fetchHistoryAll(),
      ]);
      onSuccess?.(r);
    } catch (e: any) {
      setError(e.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const downloadSample = async () => {
    const blob = await api.csvSample();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '示例导入.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); reset(); }}
      title="CSV 材料导入"
      width="max-w-3xl"
      footer={
        <>
          <button
            onClick={downloadSample}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> 下载示例
          </button>
          <button
            onClick={() => { onClose(); reset(); }}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            disabled={importing}
          >
            关闭
          </button>
          <button
            onClick={doImport}
            disabled={importing || !previewText.trim() || !!result}
            className={clsx(
              'rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50',
              result ? 'bg-teal-600 hover:bg-teal-700' : 'bg-slate-900 hover:bg-slate-800',
            )}
          >
            {importing ? '导入中...' : result ? '导入成功' : '确认导入'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setMode('file')}
            className={clsx(
              'px-3 py-1.5 rounded-md text-sm transition-colors',
              mode === 'file' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            上传文件
          </button>
          <button
            onClick={() => setMode('paste')}
            className={clsx(
              'px-3 py-1.5 rounded-md text-sm transition-colors',
              mode === 'paste' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            粘贴内容
          </button>
        </div>

        {mode === 'file' ? (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors px-6 py-8 flex flex-col items-center gap-2"
            >
              <Upload className="w-8 h-8 text-slate-400" />
              <div className="text-sm text-slate-700 font-medium">
                {fileName ? `已选择：${fileName}` : '点击上传 CSV 文件'}
              </div>
              <div className="text-xs text-slate-500">支持 UTF-8 编码的 CSV，第一行为表头</div>
            </button>
          </div>
        ) : (
          <div>
            <textarea
              value={previewText}
              onChange={e => setPreviewText(e.target.value)}
              rows={8}
              placeholder={'材料编号,材料名称,规格型号,数量,单位,项目名称\nJG-2024-005,碳纤维布,300g/m²,100,m²,滨江大厦'}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handlePasteParse}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                解析预览
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-medium text-teal-900">
              <CheckCircle2 className="w-5 h-5" />
              导入完成！批次号：{result.batchNo}
            </div>
            <div className="grid grid-cols-4 gap-3 text-center text-sm">
              <div className="rounded-md bg-white p-2 border border-teal-100">
                <div className="text-2xl font-bold text-slate-900">{result.totalRows}</div>
                <div className="text-xs text-slate-500">总行数</div>
              </div>
              <div className="rounded-md bg-white p-2 border border-teal-100">
                <div className="text-2xl font-bold text-teal-700">{result.newCount}</div>
                <div className="text-xs text-slate-500">新增</div>
              </div>
              <div className="rounded-md bg-white p-2 border border-teal-100">
                <div className="text-2xl font-bold text-blue-700">{result.updatedCount}</div>
                <div className="text-xs text-slate-500">更新</div>
              </div>
              <div className="rounded-md bg-white p-2 border border-teal-100">
                <div className="text-2xl font-bold text-slate-500">{result.skippedCount}</div>
                <div className="text-xs text-slate-500">跳过</div>
              </div>
            </div>
            {result.duplicates.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium text-amber-800 mb-1.5">重复/跳过明细：</div>
                <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                  {result.duplicates.map((d, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'flex items-start gap-2 rounded px-2 py-1.5',
                        d.hasManualNote ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700',
                      )}
                    >
                      <span className="shrink-0 text-slate-500">#{d.row}</span>
                      <span className="font-medium shrink-0">{d.materialCode || '（无编号）'}</span>
                      <span className="flex-1">{d.reason}</span>
                      {d.hasManualNote && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 shrink-0">
                          人工备注已保留
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!result && previewRows.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <FileText className="w-4 h-4" />
              解析预览（共 {previewRows.length}+ 行）
            </div>
            <div className="max-h-48 overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    {previewRows[0] && Object.keys(previewRows[0]).slice(0, 8).map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-slate-600 font-medium border-b border-slate-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-white">
                      {Object.values(r).slice(0, 8).map((v, j) => (
                        <td key={j} className="px-2 py-1 text-slate-700 truncate max-w-[150px]">{v || '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
