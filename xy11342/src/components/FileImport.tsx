import React, { useCallback, useState } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { BatchResult } from '@/types';

interface FileImportProps<T> {
  accept: string;
  onImport: (data: Record<string, any>[]) => BatchResult<T>;
  template?: { label: string; data: Record<string, any>[] };
  description?: string;
}

export function FileImport<T>({
  accept,
  onImport,
  template,
  description
}: FileImportProps<T>) {
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<BatchResult<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setResult(null);

    try {
      if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const importResult = onImport(results.data);
            setResult(importResult);
            setIsLoading(false);
          },
          error: (error) => {
            console.error('CSV parse error:', error);
            setIsLoading(false);
          }
        });
      } else if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        const importResult = onImport(Array.isArray(data) ? data : [data]);
        setResult(importResult);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('File parse error:', error);
      setIsLoading(false);
    }
  }, [onImport]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const downloadTemplate = () => {
    if (!template) return;
    if (accept.includes('csv')) {
      const csv = Papa.unparse(template.data);
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.label}.csv`;
      a.click();
    } else {
      const json = JSON.stringify(template.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.label}.json`;
      a.click();
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
          <p className="text-slate-600 mb-2">
            拖放文件到此处，或 <span className="text-blue-600 hover:text-blue-700">点击上传</span>
          </p>
          {description && (
            <p className="text-sm text-slate-500">{description}</p>
          )}
        </label>
      </div>

      {template && (
        <div className="flex justify-center">
          <button
            onClick={downloadTemplate}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <FileText className="w-4 h-4" />
            下载{template.label}模板
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-4 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>正在导入数据...</span>
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-xl ${
          result.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            {result.failed === 0 ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600" />
            )}
            <span className={`font-medium ${
              result.failed === 0 ? 'text-green-700' : 'text-amber-700'
            }`}>
              导入完成：共 {result.total} 条，成功 {result.success} 条，失败 {result.failed} 条
            </span>
          </div>
          {result.failedItems.length > 0 && (
            <div className="mt-3 bg-white rounded-lg p-3 max-h-48 overflow-y-auto">
              <p className="text-sm font-medium text-slate-700 mb-2">失败记录详情：</p>
              <div className="space-y-2">
                {result.failedItems.slice(0, 5).map((item, index) => (
                  <div key={index} className="text-sm text-slate-600 bg-slate-50 p-2 rounded">
                    <span className="font-medium text-red-600">错误：</span> {item.error}
                    <br />
                    <span className="font-medium text-amber-600">建议：</span> {item.suggestion}
                  </div>
                ))}
                {result.failedItems.length > 5 && (
                  <p className="text-sm text-slate-500 text-center">
                    还有 {result.failedItems.length - 5} 条失败记录，请在数据导入页面查看详情
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
