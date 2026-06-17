import React, { useState, useCallback, useRef } from 'react';
import {
  X, Upload, FileText, ChevronRight, ChevronLeft, CheckCircle2,
  AlertTriangle, ArrowRight, Download
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useShelter } from '@/hooks/useShelter';
import { parseCSV, autoMapColumns, buildPreviews } from '@/utils/csvImport';
import {
  ColumnMapping, CsvRawRow, ImportPreviewItem,
  importFieldDefs, ImportFieldKey
} from '@/types';
import { cn } from '@/lib/utils';

type Step = 'upload' | 'mapping' | 'preview' | 'result';

export const ImportDialog: React.FC = () => {
  const { showImportDialog, closeImportDialog } = useUIStore();
  const { importFromCsv, shelters } = useShelter();

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRawRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [previews, setPreviews] = useState<ImportPreviewItem[]>([]);
  const [importResult, setImportResult] = useState<{
    addedCount: number;
    updatedCount: number;
    feedbackCount: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setColumnMapping({});
    setPreviews([]);
    setImportResult(null);
  }, []);

  const handleClose = () => {
    closeImportDialog();
    setTimeout(resetState, 300);
  };

  const handleFileContent = useCallback((text: string, name: string) => {
    const { headers: h, rows: r } = parseCSV(text);
    if (h.length === 0 || r.length === 0) {
      alert('CSV文件为空或格式不正确，请检查文件内容。');
      return;
    }
    setFileName(name);
    setHeaders(h);
    setRows(r);

    const autoMapping = autoMapColumns(h);
    setColumnMapping(autoMapping);

    const previewItems = buildPreviews(r, autoMapping, shelters);
    setPreviews(previewItems);

    setStep('mapping');
  }, [shelters]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      alert('请上传 CSV 格式文件（.csv 或 .txt）');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleFileContent(text, file.name);
    };
    reader.readAsText(file, 'utf-8');
  }, [handleFileContent]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleMappingChange = useCallback((fieldKey: ImportFieldKey, csvCol: string) => {
    setColumnMapping(prev => {
      const next = { ...prev };
      if (csvCol === '') {
        delete next[fieldKey];
      } else {
        next[fieldKey] = csvCol;
      }
      return next;
    });
  }, []);

  const handleRemap = useCallback(() => {
    const previewItems = buildPreviews(rows, columnMapping, shelters);
    setPreviews(previewItems);
    setStep('preview');
  }, [rows, columnMapping, shelters]);

  const handleConfirmImport = useCallback(() => {
    const result = importFromCsv(previews);
    setImportResult(result);
    setStep('result');
  }, [importFromCsv, previews]);

  const handleLoadSample = useCallback(() => {
    fetch('/sample-shelter-ledger.csv')
      .then(r => r.text())
      .then(text => {
        handleFileContent(text, 'sample-shelter-ledger.csv');
      })
      .catch(() => {
        alert('样例文件加载失败，请手动上传CSV文件。');
      });
  }, [handleFileContent]);

  if (!showImportDialog) return null;

  const requiredMapped = importFieldDefs
    .filter(f => f.required)
    .every(f => columnMapping[f.key]);

  const uniqueNormalizedCount = new Set(previews.map(p => p.normalizedName)).size;
  const duplicateCount = previews.filter(p => p.isDuplicate).length;
  const conflictCount = previews.filter(p => {
    const cap = parseInt(p.mappedValues.reportedCount || '0', 10);
    const des = parseInt(p.mappedValues.designCapacity || '0', 10);
    return cap > des;
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">导入台账数据</h2>
            <p className="text-xs text-gray-400">
              上传CSV文件，系统自动映射列名、归一化点位名称、检测冲突
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center border-b border-gray-700 px-6 py-3">
          {[
            { key: 'upload', label: '上传文件', icon: Upload },
            { key: 'mapping', label: '列名映射', icon: FileText },
            { key: 'preview', label: '预览确认', icon: AlertTriangle },
            { key: 'result', label: '导入结果', icon: CheckCircle2 },
          ].map((s, idx) => {
            const stepOrder = ['upload', 'mapping', 'preview', 'result'];
            const currentIdx = stepOrder.indexOf(step);
            const thisIdx = idx;
            const isActive = step === s.key;
            const isDone = currentIdx > thisIdx;

            return (
              <React.Fragment key={s.key}>
                {idx > 0 && (
                  <ChevronRight className="mx-2 h-4 w-4 text-gray-600" />
                )}
                <div className={cn(
                  'flex items-center gap-2 text-sm font-medium',
                  isActive ? 'text-blue-400' : isDone ? 'text-green-400' : 'text-gray-500'
                )}>
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs',
                    isActive ? 'bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/50' :
                    isDone ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'
                  )}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                  </div>
                  <span className="hidden md:inline">{s.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-all',
                  dragOver
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-600 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-800/50'
                )}
              >
                <Upload className={cn('mb-4 h-12 w-12', dragOver ? 'text-blue-400' : 'text-gray-500')} />
                <p className="mb-2 text-lg font-medium text-gray-200">
                  将CSV文件拖放到此处
                </p>
                <p className="mb-4 text-sm text-gray-400">
                  或点击下方按钮选择文件（支持 .csv / .txt）
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                  >
                    <Upload className="h-4 w-4" />
                    选择文件
                  </button>
                  <button
                    onClick={handleLoadSample}
                    className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-6 py-2.5 text-sm text-gray-300 transition-colors hover:bg-gray-700"
                  >
                    <Download className="h-4 w-4" />
                    加载样例CSV
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
                <h4 className="mb-3 text-sm font-medium text-gray-200">CSV文件格式要求</h4>
                <div className="grid gap-2 text-xs text-gray-400 md:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>第一行为列名，后续行为数据</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>必填列：点位名称、经度、纬度、设计容量、反馈人数</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>选填列：反馈经度、反馈纬度、反馈人、反馈时间、时段、备注</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>系统自动识别同名列并建议映射</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5">
                <h4 className="mb-2 text-sm font-medium text-yellow-400">导入说明</h4>
                <ul className="space-y-1 text-xs text-gray-400">
                  <li>• 同一点位不同写法会自动归一化（如"东门路口"、"东门口交叉口"→"东门路口"）</li>
                  <li>• 导入的每一行原始数据都会保留在来源记录中</li>
                  <li>• 如果与现有数据冲突，不会自动决策，需在冲突处理中心人工确认</li>
                  <li>• 已有点位数据会合并更新，新点位会新增</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">
                    文件 <span className="font-mono text-blue-400">{fileName}</span>，
                    共 <span className="font-mono text-white">{rows.length}</span> 行数据
                  </p>
                  <p className="text-xs text-gray-400">
                    系统已自动匹配列名，请检查并调整映射关系
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-300">系统字段</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-300 w-10">必填</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-300 w-16"></th>
                      <th className="px-4 py-3 text-left font-medium text-gray-300">CSV列名</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-300">示例数据</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {importFieldDefs.map((field) => {
                      const mappedCol = columnMapping[field.key];
                      const sampleValue = mappedCol && rows.length > 0
                        ? rows[0]._raw[mappedCol] || ''
                        : '';

                      return (
                        <tr key={field.key} className={cn(
                          'transition-colors',
                          field.required && !mappedCol ? 'bg-red-500/5' : ''
                        )}>
                          <td className="px-4 py-3">
                            <span className="text-gray-200">{field.label}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {field.required && (
                              <span className="text-xs text-red-400">*</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ArrowRight className="mx-auto h-3 w-3 text-gray-600" />
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={mappedCol || ''}
                              onChange={(e) => handleMappingChange(field.key, e.target.value)}
                              className={cn(
                                'w-full rounded-lg border px-3 py-1.5 text-sm',
                                mappedCol
                                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                                  : field.required
                                  ? 'border-red-500/50 bg-red-500/10 text-red-300'
                                  : 'border-gray-600 bg-gray-800 text-gray-400'
                              )}
                            >
                              <option value="">-- 不映射 --</option>
                              {headers.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <span className="max-w-[200px] truncate font-mono text-xs text-gray-500">
                              {sampleValue || '-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => { resetState(); }}
                  className="flex items-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                  重新选择文件
                </button>
                <button
                  onClick={handleRemap}
                  disabled={!requiredMapped}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium transition-all',
                    requiredMapped
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  )}
                >
                  下一步：预览
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                  <p className="text-xs text-gray-400">总行数</p>
                  <p className="mt-1 text-2xl font-bold text-white">{rows.length}</p>
                </div>
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                  <p className="text-xs text-blue-400">归一化后点位</p>
                  <p className="mt-1 text-2xl font-bold text-blue-400">{uniqueNormalizedCount}</p>
                </div>
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                  <p className="text-xs text-orange-400">疑似重复</p>
                  <p className="mt-1 text-2xl font-bold text-orange-400">{duplicateCount}</p>
                </div>
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                  <p className="text-xs text-red-400">容量超限</p>
                  <p className="mt-1 text-2xl font-bold text-red-400">{conflictCount}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">行号</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">原始名称</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-400"></th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">归一化名称</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">容量</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">人数</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {previews.map((p, idx) => {
                      const cap = parseInt(p.mappedValues.designCapacity || '0', 10);
                      const cnt = parseInt(p.mappedValues.reportedCount || '0', 10);
                      const isOverflow = cnt > cap;

                      return (
                        <tr key={idx} className={cn(
                          'transition-colors',
                          p.isDuplicate ? 'bg-orange-500/5' : '',
                          isOverflow ? 'bg-red-500/5' : ''
                        )}>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.rowIndex}</td>
                          <td className="px-3 py-2 text-xs text-gray-300">{p.rawName}</td>
                          <td className="px-3 py-2 text-center">
                            {p.rawName !== p.normalizedName ? (
                              <ArrowRight className="mx-auto h-3 w-3 text-blue-400" />
                            ) : (
                              <span className="text-gray-600">=</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <span className={cn(
                              p.rawName !== p.normalizedName ? 'text-blue-400' : 'text-gray-300'
                            )}>
                              {p.normalizedName}
                            </span>
                            {p.matchedShelterId && (
                              <span className="ml-2 text-[10px] text-green-400">已有</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-xs text-gray-400">{cap}</td>
                          <td className={cn(
                            'px-3 py-2 text-center font-mono text-xs',
                            isOverflow ? 'text-red-400 font-bold' : 'text-gray-300'
                          )}>
                            {cnt}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {p.isDuplicate && (
                                <span className="inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] text-orange-400">
                                  疑似重复
                                </span>
                              )}
                              {isOverflow && (
                                <span className="inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
                                  超限{Math.round(((cnt / cap) - 1) * 100)}%
                                </span>
                              )}
                              {p.rawName !== p.normalizedName && (
                                <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400">
                                  已归一化
                                </span>
                              )}
                              {p.matchedShelterId && (
                                <span className="inline-flex items-center rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] text-green-400">
                                  合并更新
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep('mapping')}
                  className="flex items-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                  返回映射
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-2 text-sm font-medium text-white shadow-lg shadow-green-500/30 transition-all hover:from-green-600 hover:to-green-700"
                >
                  确认导入 {uniqueNormalizedCount} 个点位
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && importResult && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-white">导入完成</h3>
                <p className="text-sm text-gray-400">
                  已从 <span className="font-mono text-blue-400">{fileName}</span> 成功导入数据
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5">
                  <p className="text-sm text-green-300">新增点位</p>
                  <p className="mt-2 text-3xl font-bold text-green-400">{importResult.addedCount}</p>
                  <p className="mt-1 text-xs text-green-400/70">CSV中新增的避难场所</p>
                </div>
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
                  <p className="text-sm text-blue-300">更新点位</p>
                  <p className="mt-2 text-3xl font-bold text-blue-400">
                    {uniqueNormalizedCount - importResult.addedCount}
                  </p>
                  <p className="mt-1 text-xs text-blue-400/70">合并更新已有记录</p>
                </div>
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
                  <p className="text-sm text-purple-300">来源记录</p>
                  <p className="mt-2 text-3xl font-bold text-purple-400">{importResult.feedbackCount}</p>
                  <p className="mt-1 text-xs text-purple-400/70">全部原始行已保留</p>
                </div>
              </div>

              {conflictCount > 0 && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-400" />
                    <p className="text-sm font-medium text-orange-400">
                      发现 {conflictCount} 条容量超限，已进入冲突处理中心
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    请在"冲突处理"页面人工确认采信哪方数据，系统不会自动决策。
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleClose}
                  className="flex items-center gap-2 rounded-lg border border-gray-600 px-6 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
                >
                  关闭
                </button>
                <button
                  onClick={() => {
                    handleClose();
                    const { setActiveTab } = useUIStore.getState();
                    setActiveTab('conflicts');
                  }}
                  className="flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                >
                  前往冲突处理
                  <AlertTriangle className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
