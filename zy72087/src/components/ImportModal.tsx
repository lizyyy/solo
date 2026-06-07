import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RotateCcw, ArrowRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  parseCSVFile,
  suggestColumnMapping,
  applyColumnMapping,
  STANDARD_FIELDS,
  FIELD_MAPPING,
} from '@/engine/csvParser';
import type { ColumnMap, ImportResult } from '@/engine/csvParser';
import type { HistoricalSample } from '@/types';
import { cn } from '@/lib/utils';

const FIELD_LABELS: Record<keyof HistoricalSample, string> = {
  id: '样本ID',
  lineId: '线路ID',
  lineName: '线路名称',
  date: '日期',
  timePeriod: '时段',
  actualInterval: '实际间隔',
  actualIntervalUnit: '间隔单位',
  passengerCount: '客流量',
  costPerTrip: '单趟成本',
  onTimeRate: '准点率',
  source: '来源',
  remarks: '备注',
  caliberTag: '口径',
  isOutlier: '是否越界',
};

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'done';

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const importSamples = useStore((s) => s.importSamples);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [sourceTag, setSourceTag] = useState('CSV导入');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setSourceTag(`CSV导入·${selectedFile.name}`);

    try {
      const rows = await parseCSVFile(selectedFile);
      setRawRows(rows);

      if (rows.length > 0) {
        const headers = rows[0];
        const suggested = suggestColumnMapping(headers);
        setColumnMap(suggested);
      }

      setStep('mapping');
    } catch (e) {
      console.error('解析CSV失败', e);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handlePreview = useCallback(() => {
    if (rawRows.length === 0) return;
    const result = applyColumnMapping(rawRows, columnMap, sourceTag);
    setImportResult(result);
    setStep('preview');
  }, [rawRows, columnMap, sourceTag]);

  const handleConfirmImport = useCallback(() => {
    if (!importResult || !file) return;
    importSamples(importResult.samples, file.name);
    setStep('done');
  }, [importResult, file, importSamples]);

  const handleClose = useCallback(() => {
    setStep('upload');
    setFile(null);
    setRawRows([]);
    setColumnMap({});
    setImportResult(null);
    setSourceTag('CSV导入');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const headers = rawRows[0] || [];
  const previewRows = rawRows.slice(1, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#0F4C5C' }}>
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#0F4C5C' }}>导入CSV台账</h2>
              <p className="text-xs text-gray-500">支持逗号分隔、带引号的CSV文件</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            {['上传文件', '列名映射', '数据预览', '导入完成'].map((label, idx) => {
              const stepKeys: Step[] = ['upload', 'mapping', 'preview', 'done'];
              const currentIdx = stepKeys.indexOf(step);
              const isActive = idx <= currentIdx;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      isActive
                        ? 'text-white'
                        : 'bg-gray-200 text-gray-500'
                    )}
                    style={isActive ? { backgroundColor: '#0F4C5C' } : {}}
                  >
                    {idx + 1}
                  </div>
                  <span className={cn('text-xs', isActive ? 'text-gray-700 font-medium' : 'text-gray-400')}>
                    {label}
                  </span>
                  {idx < 3 && <div className={cn('w-8 h-0.5', isActive && idx < currentIdx ? 'bg-teal-500' : 'bg-gray-200')} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {step === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition-colors"
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm font-medium text-gray-700 mb-1">点击或拖拽CSV文件到此处</p>
              <p className="text-xs text-gray-400">支持 .csv 文件，建议包含线路、日期、时段、间隔、客流量等列</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">列名映射</h3>
                  <p className="text-xs text-gray-500 mt-0.5">系统已自动匹配，可手动调整。未映射的列将被忽略。</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">来源标记：</span>
                  <input
                    type="text"
                    value={sourceTag}
                    onChange={(e) => setSourceTag(e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">CSV列名</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">→</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">目标字段</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">预览值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((header, idx) => {
                      const mapped = columnMap[header];
                      const previewValue = previewRows[0]?.[idx] || '';
                      return (
                        <tr key={header} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-xs text-gray-700">{header}</td>
                          <td className="px-4 py-2 text-center">
                            <ArrowRight className="w-4 h-4 text-gray-400 mx-auto" />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={mapped || ''}
                              onChange={(e) => {
                                setColumnMap((prev) => ({
                                  ...prev,
                                  [header]: (e.target.value as keyof HistoricalSample) || null,
                                }));
                              }}
                              className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            >
                              <option value="">-- 不导入 --</option>
                              {STANDARD_FIELDS.map((f) => (
                                <option key={f} value={f}>
                                  {FIELD_LABELS[f]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500 font-mono truncate max-w-[120px]">
                            {previewValue}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                <p className="font-medium mb-1">💡 识别提示</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>支持的别名：{Object.keys(FIELD_MAPPING).slice(0, 8).join('、')}...</li>
                  <li>准点率支持百分比（如 92%）或小数（如 0.92）</li>
                  <li>间隔单位支持"秒""分""分钟""min"等，默认为秒</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'preview' && importResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">总行数</p>
                  <p className="text-2xl font-bold font-mono text-gray-800">{importResult.rowCount}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">有效导入</p>
                  <p className="text-2xl font-bold font-mono text-green-700">{importResult.validCount}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">警告数</p>
                  <p className="text-2xl font-bold font-mono text-yellow-700">{importResult.warnings.length}</p>
                </div>
              </div>

              {importResult.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-yellow-800 mb-1">以下警告需注意：</p>
                      <ul className="text-xs text-yellow-700 space-y-0.5 max-h-32 overflow-auto">
                        {importResult.warnings.slice(0, 10).map((w, i) => (
                          <li key={i}>· {w}</li>
                        ))}
                        {importResult.warnings.length > 10 && (
                          <li>· 另有 {importResult.warnings.length - 10} 条警告...</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-medium text-gray-600 mb-2">前 3 条预览：</h4>
                <div className="border border-gray-200 rounded-lg overflow-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        {Object.values(FIELD_LABELS).slice(0, 8).map((label) => (
                          <th key={label} className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.samples.slice(0, 3).map((s, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2 py-1 font-mono text-gray-600">{s.id}</td>
                          <td className="px-2 py-1 font-mono text-gray-600">{s.lineId}</td>
                          <td className="px-2 py-1 text-gray-700">{s.lineName}</td>
                          <td className="px-2 py-1 font-mono text-gray-600">{s.date}</td>
                          <td className="px-2 py-1 text-gray-700">{s.timePeriod}</td>
                          <td className="px-2 py-1 font-mono text-gray-600">{s.actualInterval ?? '—'}</td>
                          <td className="px-2 py-1 font-mono text-gray-600">{s.actualIntervalUnit}</td>
                          <td className="px-2 py-1 font-mono text-gray-600">{s.passengerCount ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && importResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">导入成功！</h3>
              <p className="text-sm text-gray-500 mb-4">
                已成功导入 <span className="font-bold text-green-600">{importResult.validCount}</span> 条记录
                {importResult.warnings.length > 0 && (
                  <>，含 <span className="text-yellow-600">{importResult.warnings.length}</span> 条警告</>
                )}
              </p>
              <p className="text-xs text-gray-400">关闭后可在数据总览页查看新导入的记录</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          {step === 'upload' && (
            <div className="text-xs text-gray-400">
              支持最大 10MB 的 CSV 文件
            </div>
          )}
          {step !== 'upload' && step !== 'done' && (
            <button
              onClick={() => setStep((s) => (s === 'mapping' ? 'upload' : s === 'preview' ? 'mapping' : 'upload'))}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              上一步
            </button>
          )}
          {step === 'done' && <div />}

          <div className="flex items-center gap-2">
            {step === 'mapping' && (
              <>
                <button
                  onClick={() => {
                    if (file) {
                      const suggested = suggestColumnMapping(headers);
                      setColumnMap(suggested);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置映射
                </button>
                <button
                  onClick={handlePreview}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#0F4C5C' }}
                >
                  预览数据
                </button>
              </>
            )}
            {step === 'preview' && (
              <button
                onClick={handleConfirmImport}
                className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#E36414' }}
              >
                确认导入
              </button>
            )}
            {step === 'done' && (
              <button
                onClick={handleClose}
                className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#0F4C5C' }}
              >
                完成
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
