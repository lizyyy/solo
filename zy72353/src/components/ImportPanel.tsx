import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  Check,
  AlertTriangle,
  FileSpreadsheet,
  FileJson,
  FileText,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  Copy,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useThresholdStore } from '../store/thresholdStore';
import type { ImportResult, ImportFileFormat, ImportSource, ThresholdData, Device } from '../types';
import { sampleImportCSV } from '../data/mockData';

interface ParsedRow {
  rowIndex: number;
  original: Record<string, any>;
}

interface ValidationError {
  rowIndex: number;
  reason: string;
  original: Record<string, any>;
}

interface DuplicateInfo {
  rowIndex: number;
  thresholdId?: string;
  original: Record<string, any>;
}

interface ImportDetail {
  success: Array<{
    rowIndex: number;
    thresholdId: string;
    original: Record<string, any>;
  }>;
  duplicates: DuplicateInfo[];
  errors: ValidationError[];
}

interface ImportPanelProps {
  onViewBatch?: (batchId: string) => void;
}

const ACCEPTED_EXTENSIONS = ['.csv', '.json', '.xlsx', '.xls'];
const ACCEPTED_MIME = [
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const getFileFormat = (fileName: string): ImportFileFormat => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  return 'unknown';
};

const resolveDeviceId = (deviceInput: string, devices: Device[]): string | null => {
  const trimmed = deviceInput?.trim();
  if (!trimmed) return null;

  const byId = devices.find((d) => d.id.toLowerCase() === trimmed.toLowerCase());
  if (byId) return byId.id;

  const byName = devices.find((d) => {
    const dName = d.name.toLowerCase();
    const input = trimmed.toLowerCase();
    return (
      dName.includes(input) ||
      input.includes(dName) ||
      d.name.includes(trimmed) ||
      trimmed.includes(d.name)
    );
  });
  if (byName) return byName.id;

  const codeMatch = trimmed.match(/([A-Z]-\d+)/i);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    const byCode = devices.find((d) => d.name.toUpperCase().includes(code));
    if (byCode) return byCode.id;
  }

  return null;
};

const parseCSV = (text: string): Record<string, any>[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, any> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
};

const parseFile = async (
  file: File | Blob,
  format: ImportFileFormat
): Promise<Record<string, any>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('文件读取失败'));
          return;
        }

        if (format === 'csv') {
          const text = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data as ArrayBuffer);
          resolve(parseCSV(text));
        } else if (format === 'json') {
          const text = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data as ArrayBuffer);
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            resolve(parsed);
          } else if (parsed.data && Array.isArray(parsed.data)) {
            resolve(parsed.data);
          } else {
            reject(new Error('JSON 格式错误：需要数组格式'));
          }
        } else if (format === 'xlsx') {
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          resolve(jsonData as Record<string, any>[]);
        } else {
          reject(new Error('不支持的文件格式'));
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error('解析失败'));
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));

    if (format === 'csv' || format === 'json') {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

const validateAndTransform = (
  rows: Record<string, any>[],
  devices: Device[]
): { valid: Partial<ThresholdData>[]; detail: ImportDetail } => {
  const valid: Partial<ThresholdData>[] = [];
  const detail: ImportDetail = { success: [], duplicates: [], errors: [] };

  rows.forEach((row, idx) => {
    const rowIndex = idx + 1;
    const errors: string[] = [];

    const name = String(row.name ?? row.Name ?? row['名称'] ?? '').trim();
    const rawValue = row.value ?? row.Value ?? row['数值'];
    const rawDevice = String(
      row.deviceId ?? row.DeviceId ?? row.device ?? row.Device ?? row['设备'] ?? row['设备ID'] ?? ''
    ).trim();
    const unit = (
      String(row.unit ?? row.Unit ?? row['单位'] ?? 'Celsius').trim() || 'Celsius') as
      | 'Celsius'
      | 'Kelvin';
    const remark = String(row.remark ?? row.Remark ?? row['备注'] ?? '').trim();
    const calculationModel = String(
      row.calculationModel ?? row.CalculationModel ?? row['计算模型'] ?? ''
    ).trim();
    const modelVersion = String(
      row.modelVersion ?? row.ModelVersion ?? row['模型版本'] ?? ''
    ).trim();
    const tradeOffReason = String(
      row.tradeOffReason ?? row.TradeOffReason ?? row['权衡原因'] ?? ''
    ).trim();

    if (!name) {
      errors.push('缺少必填字段: name');
    }

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      errors.push('缺少必填字段: value');
    } else {
      const numValue = Number(rawValue);
      if (isNaN(numValue)) {
        errors.push('value 必须为数字');
      }
    }

    if (!rawDevice) {
      errors.push('缺少必填字段: deviceId');
    }

    const resolvedDeviceId = resolveDeviceId(rawDevice, devices);
    if (rawDevice && !resolvedDeviceId) {
      errors.push(`无法识别的设备标识: ${rawDevice}`);
    }

    if (errors.length > 0) {
      detail.errors.push({
        rowIndex,
        reason: errors.join('; '),
        original: { ...row },
      });
      return;
    }

    valid.push({
      name,
      value: Number(rawValue),
      unit,
      deviceId: resolvedDeviceId!,
      remark: remark || '导入数据',
      calculationModel: calculationModel || undefined,
      modelVersion: modelVersion || undefined,
      tradeOffReason: tradeOffReason || undefined,
    });
  });

  return { valid, detail };
};

const ImportPanel = ({ onViewBatch }: ImportPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDetail, setImportDetail] = useState<ImportDetail | null>(null);
  const [batchNo, setBatchNo] = useState<string>('');
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [currentFormat, setCurrentFormat] = useState<ImportFileFormat>('unknown');
  const [currentSource, setCurrentSource] = useState<ImportSource>('file');
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'success' | 'duplicate' | 'error'>('success');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importThresholds, devices, getBatchById } = useThresholdStore();

  const processParsedData = useCallback(
    async (file: File | Blob, format: ImportFileFormat, source: ImportSource, fileName: string) => {
      setIsLoading(true);
      setParseError('');
      setImportResult(null);
      setImportDetail(null);

      try {
        const rows = await parseFile(file, format);
        if (rows.length === 0) {
          setParseError('文件内容为空或格式不正确');
          setIsLoading(false);
          return;
        }

        const { valid, detail } = validateAndTransform(rows, devices);

        const result = importThresholds(valid, { source, format, fileName });

        const validMap = new Map<number, Record<string, any>>();
        let validIdx = 0;
        rows.forEach((row, idx) => {
          const hasError = detail.errors.some((e) => e.rowIndex === idx + 1);
          if (!hasError) {
            validMap.set(idx + 1, row);
            validIdx++;
          }
        });

        const existingThresholds = useThresholdStore.getState().thresholds;
        const importedIdsSet = new Set(result.importedIds);

        valid.forEach((v, i) => {
          const rowIdx = Array.from(validMap.keys())[i];
          const originalRow = validMap.get(rowIdx)!;
          const isDuplicate = existingThresholds.some(
            (t) =>
              t.name === v.name &&
              t.deviceId === v.deviceId &&
              Math.abs(t.value - (v.value || 0)) < 0.01 &&
              !importedIdsSet.has(t.id)
          );
          if (isDuplicate) {
            detail.duplicates.push({
              rowIndex: rowIdx,
              original: originalRow,
            });
          } else {
            const thId = result.importedIds[detail.success.length];
            if (thId) {
              detail.success.push({
                rowIndex: rowIdx,
                thresholdId: thId,
                original: originalRow,
              });
            }
          }
        });

        detail.duplicates.forEach((dup) => {
          const orig = dup.original;
          const origDevice = String(
            orig.deviceId || orig.DeviceId || orig.device || orig.Device || ''
          );
          const resolvedOrigDevice = resolveDeviceId(origDevice, devices);
          const dupTh = existingThresholds.find(
            (t) =>
              t.name === orig.name &&
              t.deviceId === (orig.deviceId || resolvedOrigDevice) &&
              Math.abs(t.value - Number(orig.value || orig.Value)) < 0.01
          );
          if (dupTh) {
            dup.thresholdId = dupTh.id;
          }
        });

        setImportDetail(detail);
        setImportResult(result);

        if (result.batchId) {
          setTimeout(() => {
            const batch = getBatchById(result.batchId!);
            if (batch) {
              setBatchNo(batch.batchNo);
            }
          }, 0);
        }

        setCurrentFileName(fileName);
        setCurrentFormat(format);
        setCurrentSource(source);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : '解析失败');
      } finally {
        setIsLoading(false);
      }
    },
    [devices, importThresholds, getBatchById]
  );

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const format = getFileFormat(file.name);

      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext) && format === 'unknown') {
        setParseError('不支持的文件格式，请上传 .csv, .json, .xlsx, .xls 文件');
        return;
      }

      processParsedData(file, format, 'file', file.name);
    },
    [processParsedData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleSampleImport = useCallback(() => {
    const blob = new Blob([sampleImportCSV], { type: 'text/csv;charset=utf-8' });
    processParsedData(blob, 'csv', 'sample', 'sample_data.csv');
  }, [processParsedData]);

  const handleClose = () => {
    setIsOpen(false);
    setImportResult(null);
    setImportDetail(null);
    setCurrentFileName('');
    setParseError('');
    setBatchNo('');
    setActiveTab('success');
  };

  const formatOriginalText = (row: Record<string, any>) => {
    const parts = [];
    if (row.name) parts.push(String(row.name));
    if (row.value !== undefined) parts.push(`值:${row.value}`);
    if (row.deviceId) parts.push(String(row.deviceId));
    if (row.unit) parts.push(String(row.unit));
    if (row.remark) parts.push(String(row.remark));
    return parts.join(' | ');
  };

  const copyBatchNo = async () => {
    if (batchNo) {
      try {
        await navigator.clipboard.writeText(batchNo);
      } catch {}
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50"
      >
        <Upload className="w-5 h-5" />
        <span className="font-medium">导入阈值表</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-industrial-600 rounded-xl w-full max-w-3xl shadow-2xl border border-industrial-500 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-industrial-500 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">导入安全阈值表</h3>
                  <p className="text-industrial-300 text-sm">支持 CSV、JSON、Excel 格式</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-industrial-300 hover:text-white transition-colors p-1 rounded hover:bg-industrial-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
            {importResult ? (
              <div className="space-y-5">
                {batchNo && (
                  <div className="bg-industrial-700/80 rounded-xl p-4 border border-primary-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                          <FileSpreadsheet className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                          <p className="text-industrial-300 text-xs uppercase tracking-wider">
                            批次编号
                          </p>
                          <p className="text-white font-mono font-bold text-xl tracking-wider">
                            {batchNo}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={copyBatchNo}
                          className="p-2 rounded-lg bg-industrial-500 hover:bg-industrial-400 text-industrial-200 transition-colors"
                          title="复制批次号"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {onViewBatch && importResult?.batchId && (
                          <button
                            onClick={() => onViewBatch(importResult.batchId!)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>查看此批次所有记录</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-industrial-500 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-industrial-400">来源：</span>
                        <span className="text-industrial-200">
                          {currentSource === 'file' ? '文件上传' : '示例数据'}
                        </span>
                      </div>
                      <div>
                        <span className="text-industrial-400">格式：</span>
                        <span className="text-industrial-200 uppercase">{currentFormat}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-industrial-400">文件名：</span>
                        <span className="text-industrial-200 font-mono">{currentFileName}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-success-500/15 border border-success-500/30 rounded-xl p-4 text-center">
                    <Check className="w-8 h-8 text-success-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-success-400">{importResult.success}</p>
                    <p className="text-industrial-300 text-sm">成功导入</p>
                  </div>
                  <div className="bg-warning-500/15 border border-warning-500/30 rounded-xl p-4 text-center">
                    <AlertTriangle className="w-8 h-8 text-warning-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-warning-400">{importResult.duplicate}</p>
                    <p className="text-industrial-300 text-sm">重复跳过</p>
                  </div>
                  <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-4 text-center">
                    <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-red-400">{importResult.error}</p>
                    <p className="text-industrial-300 text-sm">导入失败</p>
                  </div>
                </div>

                {importDetail && (
                  <div className="bg-industrial-700 rounded-xl border border-industrial-500 overflow-hidden">
                    <div className="flex border-b border-industrial-500">
                      <button
                        onClick={() => setActiveTab('success')}
                        className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                          activeTab === 'success'
                            ? 'text-success-400 bg-industrial-600'
                            : 'text-industrial-300 hover:text-white hover:bg-industrial-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" />
                          成功 ({importDetail.success.length})
                        </div>
                        {activeTab === 'success' && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success-500" />
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab('duplicate')}
                        className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                          activeTab === 'duplicate'
                            ? 'text-warning-400 bg-industrial-600'
                            : 'text-industrial-300 hover:text-white hover:bg-industrial-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          重复 ({importDetail.duplicates.length})
                        </div>
                        {activeTab === 'duplicate' && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-warning-500" />
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab('error')}
                        className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
                          activeTab === 'error'
                            ? 'text-red-400 bg-industrial-600'
                            : 'text-industrial-300 hover:text-white hover:bg-industrial-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          错误 ({importDetail.errors.length})
                        </div>
                        {activeTab === 'error' && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
                        )}
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                      {activeTab === 'success' && (
                        <div>
                          {importDetail.success.length === 0 ? (
                            <div className="p-8 text-center text-industrial-400">
                              无成功记录
                            </div>
                          ) : (
                            <div className="divide-y divide-industrial-500">
                              {importDetail.success.map((item, i) => (
                                <div key={i} className="p-4 hover:bg-industrial-600/30 transition-colors">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 bg-success-500/20 text-success-400 text-xs font-mono rounded">
                                        行 {item.rowIndex}
                                      </span>
                                      <span className="text-industrial-200 font-medium">
                                        {item.original.name || '-'}
                                      </span>
                                    </div>
                                    <span className="text-primary-400 font-mono text-sm">
                                      {item.thresholdId}
                                    </span>
                                  </div>
                                  <div className="text-industrial-400 text-sm pl-1">
                                    <span className="text-industrial-500">值:</span>{' '}
                                    <span className="text-industrial-200">{item.original.value}</span>
                                    {item.original.unit && (
                                      <>
                                        {' '}
                                        <span className="text-industrial-500">单位:</span>{' '}
                                        <span className="text-industrial-200">
                                          {item.original.unit}
                                        </span>
                                      </>
                                    )}
                                    {item.original.deviceId && (
                                      <>
                                        {' '}
                                        <span className="text-industrial-500">设备:</span>{' '}
                                        <span className="text-industrial-200">
                                          {item.original.deviceId}
                                        </span>
                                      </>
                                    )}
                                    {item.original.remark && (
                                      <>
                                        {' '}
                                        <span className="text-industrial-500">备注:</span>{' '}
                                        <span className="text-industrial-200">
                                          {item.original.remark}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'duplicate' && (
                        <div>
                          {importDetail.duplicates.length === 0 ? (
                            <div className="p-8 text-center text-industrial-400">无重复记录</div>
                          ) : (
                            <div className="divide-y divide-industrial-500">
                              {importDetail.duplicates.map((item, i) => (
                                <div key={i} className="p-4 hover:bg-industrial-600/30 transition-colors">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 bg-warning-500/20 text-warning-400 text-xs font-mono rounded">
                                        行 {item.rowIndex}
                                      </span>
                                      <span className="text-industrial-200 font-medium">
                                        {item.original.name || '-'}
                                      </span>
                                    </div>
                                    {item.thresholdId && (
                                      <span className="text-warning-400 font-mono text-xs bg-warning-500/20 px-2 py-0.5 rounded">
                                        已存在: {item.thresholdId}
                                      </span>
                                    )}
                                  </div>
                                  <div className="bg-warning-500/10 rounded-lg p-3 mt-2">
                                    <p className="text-industrial-400 text-xs mb-1">原始记录:</p>
                                    <p className="text-industrial-300 text-sm">
                                      {formatOriginalText(item.original)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'error' && (
                        <div>
                          {importDetail.errors.length === 0 ? (
                            <div className="p-8 text-center text-industrial-400">无错误记录</div>
                          ) : (
                            <div className="divide-y divide-industrial-500">
                              {importDetail.errors.map((item, i) => (
                                <div key={i} className="p-4 hover:bg-industrial-600/30 transition-colors">
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-mono rounded flex-shrink-0">
                                      行 {item.rowIndex}
                                    </span>
                                    <div className="flex-1">
                                      <p className="text-red-400 text-sm font-medium">
                                        {item.reason}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="bg-red-500/10 rounded-lg p-3 mt-2">
                                    <p className="text-industrial-400 text-xs mb-1">原始数据:</p>
                                    <p className="text-industrial-300 text-sm break-all">
                                      {formatOriginalText(item.original)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setImportResult(null);
                      setImportDetail(null);
                      setBatchNo('');
                      setParseError('');
                    }}
                    className="flex-1 py-3 bg-industrial-700 hover:bg-industrial-500 text-industrial-200 rounded-lg transition-all border border-industrial-500 hover:border-primary-500 font-medium"
                  >
                    继续导入
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all font-medium"
                  >
                    完成
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer bg-industrial-700/50 transition-all ${
                    isDragOver
                      ? 'border-primary-500 bg-primary-500/10 scale-[1.01]'
                      : 'border-industrial-400 hover:border-primary-500'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                  {isLoading ? (
                    <Loader2 className="w-12 h-12 text-primary-400 mx-auto mb-3 animate-spin" />
                  ) : (
                    <Upload className="w-12 h-12 text-industrial-300 mx-auto mb-3" />
                  )}
                  <p className="text-industrial-200 mb-1 font-medium">
                    拖拽文件到此处或点击上传
                  </p>
                  <p className="text-industrial-400 text-sm mb-4">
                    支持 .csv, .json, .xlsx, .xls
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-industrial-600 rounded text-industrial-300">
                      <FileText className="w-3 h-3" />
                      CSV
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-industrial-600 rounded text-industrial-300">
                      <FileJson className="w-3 h-3" />
                      JSON
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-industrial-600 rounded text-industrial-300">
                      <FileSpreadsheet className="w-3 h-3" />
                      Excel
                    </span>
                  </div>
                </div>

                {parseError && (
                  <div className="mt-4 p-4 bg-red-500/15 border border-red-500/30 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium text-sm">解析失败</p>
                      <p className="text-industrial-300 text-sm mt-1">{parseError}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-px bg-industrial-500" />
                  <span className="text-industrial-400 text-sm">或</span>
                  <div className="flex-1 h-px bg-industrial-500" />
                </div>

                <button
                  onClick={handleSampleImport}
                  disabled={isLoading}
                  className="w-full mt-4 py-3 bg-industrial-700 hover:bg-industrial-500 text-industrial-200 rounded-lg transition-all border border-industrial-500 hover:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ChevronRight className="w-5 h-5" />
                  <span>使用示例数据测试导入</span>
                </button>

                <div className="mt-4 p-4 bg-industrial-700 rounded-xl border border-industrial-500">
                  <p className="text-industrial-300 text-sm leading-relaxed">
                    <span className="text-primary-400 font-medium">字段说明：</span>
                    <span className="text-industrial-200">必填字段</span>：
                    <code className="px-1.5 py-0.5 bg-industrial-600 rounded text-primary-300 mx-1">name</code>
                    <span>名称、</span>
                    <code className="px-1.5 py-0.5 bg-industrial-600 rounded text-primary-300 mx-1">value</code>
                    <span>数值（数字）、</span>
                    <code className="px-1.5 py-0.5 bg-industrial-600 rounded text-primary-300 mx-1">deviceId</code>
                    <span>设备ID/名称。</span>
                  </p>
                  <p className="text-industrial-400 text-xs mt-2">
                    <span className="text-warning-400">设备识别：</span>支持设备 ID（如 dev-001）或设备名称（如 A-01、冷凝管机组 A-01），系统将自动关联匹配。
                  </p>
                  <p className="text-industrial-400 text-xs mt-1">
                    <span className="text-warning-400">重复判定：</span>名称 + 设备 + 数值相同则判定为重复，将自动跳过。
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
};

export default ImportPanel;
