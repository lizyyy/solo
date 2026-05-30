import { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileText, AlertTriangle, CheckCircle, X, FileSpreadsheet } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cleanRawData, calculateDataQualityScore } from '@/utils/dataCleaner';
import type { DataIssue } from '@/types';

export default function DataImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [localIssues, setLocalIssues] = useState<DataIssue[]>([]);
  const [dataQuality, setDataQuality] = useState(100);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importData = useAppStore((state) => state.importData);
  const setDataIssues = useAppStore((state) => state.setDataIssues);

  const processFile = (file: File) => {
    setFileName(file.name);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as Record<string, unknown>[];
          setPreviewData(data.slice(0, 5));
          const cleaned = cleanRawData(data);
          setLocalIssues(cleaned.issues);
          setDataQuality(calculateDataQualityScore(cleaned.issues));
          importData(data);
          setDataIssues(cleaned.issues);
        },
      });
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
        setPreviewData(jsonData.slice(0, 5));
        const cleaned = cleanRawData(jsonData);
        setLocalIssues(cleaned.issues);
        setDataQuality(calculateDataQualityScore(cleaned.issues));
        importData(jsonData);
        setDataIssues(cleaned.issues);
      };
      reader.readAsBinaryString(file);
    } else if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as Record<string, unknown>[];
          const dataArray = Array.isArray(data) ? data : [data];
          setPreviewData(dataArray.slice(0, 5));
          const cleaned = cleanRawData(dataArray);
          setLocalIssues(cleaned.issues);
          setDataQuality(calculateDataQualityScore(cleaned.issues));
          importData(dataArray);
          setDataIssues(cleaned.issues);
        } catch {
          console.error('Failed to parse JSON');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const clearFile = () => {
    setFileName(null);
    setPreviewData([]);
    setLocalIssues([]);
    setDataQuality(100);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-danger-400';
      case 'warning':
        return 'text-warning-400';
      default:
        return 'text-slate-400';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <X className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${
          isDragging
            ? 'border-aviation-400 bg-aviation-500/20'
            : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv,.xlsx,.xls,.json"
          className="hidden"
        />

        {!fileName ? (
          <div className="space-y-3">
            <div className="flex justify-center">
              <Upload className="w-12 h-12 text-slate-400" />
            </div>
            <p className="text-slate-300">拖拽文件到此处，或点击选择文件</p>
            <p className="text-sm text-slate-500">支持 CSV、Excel、JSON 格式</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              选择文件
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-aviation-400" />
                <div className="text-left">
                  <p className="font-medium text-slate-200">{fileName}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-sm ${
                        dataQuality >= 80
                          ? 'text-success-400'
                          : dataQuality >= 60
                            ? 'text-warning-400'
                            : 'text-danger-400'
                      }`}
                    >
                      {dataQuality >= 80 ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      数据质量: {dataQuality}%
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={clearFile}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {localIssues.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning-400" />
            数据问题检测 ({localIssues.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {localIssues.slice(0, 10).map((issue) => (
              <div
                key={issue.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  issue.fixed ? 'bg-success-500/10' : 'bg-slate-700/50'
                }`}
              >
                <span className={`${getSeverityColor(issue.severity)} mt-0.5`}>
                  {getSeverityIcon(issue.severity)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">
                    {issue.field && <span className="font-mono text-aviation-300">[{issue.field}]</span>}{' '}
                    {issue.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{issue.suggestion}</p>
                </div>
              </div>
            ))}
            {localIssues.length > 10 && (
              <p className="text-sm text-slate-400 text-center py-2">
                还有 {localIssues.length - 10} 条问题...
              </p>
            )}
          </div>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-slate-200 mb-3">数据预览 (前5行)</h3>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600">
                  {Object.keys(previewData[0] || {}).map((key) => (
                    <th
                      key={key}
                      className="px-3 py-2 text-left text-slate-400 font-mono text-xs"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-2 text-slate-300 font-mono text-xs">
                        {String(val ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
