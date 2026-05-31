import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { parseExcelFile, generateTemplateExcel, validateRow } from '@/utils/excelParser';
import { ParsedExcelRow, SourceType, SOURCE_TYPE_LABELS, DataSource } from '@/types';
import { transformToCableRecords } from '@/utils/excelParser';

interface FileUploadZoneProps {
  onParseComplete: (rows: ParsedExcelRow[], records: any[], source: DataSource) => void;
  onError?: (error: string) => void;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ onParseComplete, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>('inspection_photo');
  const [uploaderName, setUploaderName] = useState('张伟');

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      onError?.('请上传 Excel (.xlsx, .xls) 或 CSV 文件');
      return;
    }

    setIsParsing(true);
    try {
      const rows = await parseExcelFile(file);
      
      let validCount = 0;
      let invalidCount = 0;
      rows.forEach(row => {
        const result = validateRow(row);
        if (result.valid) validCount++;
        else invalidCount++;
      });

      setParseResult({ total: rows.length, valid: validCount, invalid: invalidCount });

      const now = new Date().toISOString();
      const source: DataSource = {
        id: `s_${Date.now()}`,
        type: sourceType,
        name: file.name,
        uploader: uploaderName,
        uploadDate: now,
        description: `上传于 ${new Date().toLocaleString('zh-CN')}`,
      };

      const records = transformToCableRecords(rows, sourceType, source.id, 'p001');
      
      setTimeout(() => {
        onParseComplete(rows, records, source);
      }, 500);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : '文件解析失败');
    } finally {
      setIsParsing(false);
    }
  }, [sourceType, uploaderName, onParseComplete, onError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">数据来源：</label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue"
          >
            {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map(type => (
              <option key={type} value={type}>{SOURCE_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">操作人：</label>
          <input
            type="text"
            value={uploaderName}
            onChange={(e) => setUploaderName(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-signal-blue/20 focus:border-signal-blue w-24"
          />
        </div>
        <button
          onClick={generateTemplateExcel}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-signal-blue hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          下载导入模板
        </button>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-signal-blue bg-blue-50'
            : isParsing
            ? 'border-gray-300 bg-gray-50'
            : 'border-gray-300 hover:border-signal-blue hover:bg-gray-50'
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center gap-3">
          {isParsing ? (
            <>
              <div className="w-12 h-12 border-4 border-signal-blue border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-gray-700">正在解析文件...</p>
            </>
          ) : parseResult ? (
            <>
              {parseResult.invalid === 0 ? (
                <CheckCircle className="w-12 h-12 text-signal-green" />
              ) : (
                <AlertCircle className="w-12 h-12 text-signal-orange" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-800">
                  解析完成，共 {parseResult.total} 条数据
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="text-signal-green">{parseResult.valid} 条有效</span>
                  {parseResult.invalid > 0 && (
                    <span className="text-signal-orange ml-2">{parseResult.invalid} 条需处理</span>
                  )}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                {isDragging ? (
                  <FileSpreadsheet className="w-8 h-8 text-signal-blue" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {isDragging ? '松开鼠标上传文件' : '点击或拖拽文件到此处'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  支持 Excel (.xlsx, .xls) 和 CSV 格式
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
