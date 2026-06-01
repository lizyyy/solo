import { useState, useCallback, useRef, Fragment } from 'react';
import { useStore } from '@/store';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { DataRecord } from '@/types';
import { UnitConverter } from '@/utils/unitConverter';

type ParsedRow = Record<string, string>;

export default function DataImport() {
  const { currentBatch, importData, runCalculation } = useStore();
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!currentBatch) return;
        importData(currentBatch.id, results.data, file.name);
        const updated = useStore.getState().currentBatch;
        if (updated) setRecords(updated.records);
      },
    });
  }, [currentBatch, importData]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onRunCalculation = useCallback(() => {
    if (!currentBatch) return;
    runCalculation(currentBatch.id);
  }, [currentBatch, runCalculation]);

  const totalRecords = records.length;
  const cleanCount = records.filter(r => r.dataStatus === 'clean').length;
  const missingCount = records.filter(r => r.dataStatus === 'missing').length;
  const mismatchCount = records.filter(r => r.dataStatus === 'unit_mismatch').length;

  const rowBg = (r: DataRecord) => {
    if (r.dataStatus === 'missing') return 'bg-yellow-50';
    if (r.dataStatus === 'unit_mismatch') return 'bg-orange-50';
    return '';
  };

  const rowBorder = (r: DataRecord) => {
    if (r.dataStatus === 'clean') return 'border-l-4 border-l-green-400';
    if (r.dataStatus === 'missing') return 'border-l-4 border-l-yellow-400';
    if (r.dataStatus === 'unit_mismatch') return 'border-l-4 border-l-orange-400';
    return 'border-l-4 border-l-red-400';
  };

  const statusBadge = (status: DataRecord['dataStatus']) => {
    const map: Record<string, { cls: string; icon: React.ReactNode; text: string }> = {
      clean: { cls: 'status-badge-normal', icon: <CheckCircle size={12} />, text: '正常' },
      missing: { cls: 'status-badge-pending', icon: <AlertTriangle size={12} />, text: '缺失' },
      unit_mismatch: { cls: 'status-badge-extreme', icon: <AlertTriangle size={12} />, text: '单位异常' },
      conflict: { cls: 'status-badge-conflict', icon: <XCircle size={12} />, text: '冲突' },
    };
    const info = map[status] || map.clean;
    return <span className={`status-badge ${info.cls} gap-1`}>{info.icon}{info.text}</span>;
  };

  const conversionSuggestion = (r: DataRecord) => {
    if (r.unitIssues.length === 0) return null;
    return r.unitIssues.map((issue, i) => {
      const parsed = UnitConverter.parseUnit(r.temperatureUnit);
      if (parsed.confidence < 1 && parsed.confidence > 0) {
        const formula = UnitConverter.getConversionFormula(r.temperatureUnit, parsed.unit);
        return <div key={i} className="text-xs text-orange-700 mt-1">💡 {issue} → 建议转换: {formula}</div>;
      }
      return <div key={i} className="text-xs text-orange-700 mt-1">⚠️ {issue}</div>;
    });
  };

  return (
    <div className="space-y-4">
      <div className="industrial-card">
        <div className="industrial-card-header flex items-center gap-2">
          <FileSpreadsheet size={16} />
          <span>数据导入</span>
        </div>
        <div className="p-4">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-primary-500 bg-primary-50' : 'border-primary-300 hover:border-primary-400'
            }`}
          >
            <Upload size={32} className="mx-auto mb-2 text-primary-400" />
            <p className="font-mono text-sm text-primary-600">拖拽 CSV 文件到此处，或点击选择文件</p>
            {fileName && <p className="font-mono text-xs text-primary-500 mt-1">已选择: {fileName}</p>}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={onFileChange} className="hidden" />
        </div>
      </div>

      {records.length > 0 && (
        <>
          <div className="industrial-card">
            <div className="industrial-card-header flex items-center gap-2">
              <CheckCircle size={16} />
              <span>数据质量概览</span>
            </div>
            <div className="p-4 grid grid-cols-4 gap-3">
              <div className="industrial-card p-3 text-center">
                <div className="font-mono text-2xl font-bold text-primary-700">{totalRecords}</div>
                <div className="font-mono text-xs text-primary-500">总记录</div>
              </div>
              <div className="industrial-card p-3 text-center border-l-4 border-l-green-400">
                <div className="font-mono text-2xl font-bold text-green-600">{cleanCount}</div>
                <div className="font-mono text-xs text-green-600">正常</div>
              </div>
              <div className="industrial-card p-3 text-center border-l-4 border-l-yellow-400">
                <div className="font-mono text-2xl font-bold text-yellow-600">{missingCount}</div>
                <div className="font-mono text-xs text-yellow-600">缺失</div>
              </div>
              <div className="industrial-card p-3 text-center border-l-4 border-l-orange-400">
                <div className="font-mono text-2xl font-bold text-orange-600">{mismatchCount}</div>
                <div className="font-mono text-xs text-orange-600">单位异常</div>
              </div>
            </div>
          </div>

          <div className="industrial-card">
            <div className="industrial-card-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} />
                <span>数据预览（{records.length} 条）</span>
              </div>
              <button onClick={onRunCalculation} className="industrial-btn-primary flex items-center gap-1">
                运行计算
              </button>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="industrial-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>时间戳</th>
                    <th>温度</th>
                    <th>湿度</th>
                    <th>制冷负荷</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <Fragment key={r.id}>
                      <tr className={`${rowBg(r)} ${rowBorder(r)} cursor-pointer`}
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                        <td className="w-8 text-center">
                          {expandedId === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                        <td>{new Date(r.timestamp).toLocaleString('zh-CN')}</td>
                        <td>{r.temperature} {r.temperatureUnit}</td>
                        <td>{r.humidity}%</td>
                        <td>{r.coolingLoad != null ? `${r.coolingLoad} ${r.coolingLoadUnit || ''}` : '—'}</td>
                        <td>{statusBadge(r.dataStatus)}</td>
                      </tr>
                      {expandedId === r.id && (
                        <tr>
                          <td colSpan={6} className="bg-primary-50/50 px-6 py-3">
                            <div className="space-y-1">
                              <div className="font-mono text-xs text-primary-600 font-semibold">来源信息</div>
                              {r.sources.map((s) => (
                                <div key={s.id} className="font-mono text-xs text-primary-700 flex gap-4">
                                  <span>文件: {s.sourceFile}</span>
                                  <span>行号: {s.sourceLine}</span>
                                </div>
                              ))}
                              <div className="font-mono text-xs text-primary-600">
                                原始值: {r.sources[0]?.originalValue}
                              </div>
                              {r.missingFields.length > 0 && (
                                <div className="font-mono text-xs text-yellow-700">
                                  缺失字段: {r.missingFields.join(', ')}
                                </div>
                              )}
                              {conversionSuggestion(r)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
