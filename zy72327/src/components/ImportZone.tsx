import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import type { ImportResult } from '../types';
import { cn } from '../lib/utils';

interface Props {
  title: string;
  description: string;
  onImport: (file: File) => Promise<ImportResult>;
  disabled?: boolean;
}

export default function ImportZone({ title, description, onImport, disabled = false }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (disabled || isUploading) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = async (file: File) => {
    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    
    const fileName = file.name.toLowerCase();
    const isValidExtension = fileName.endsWith('.csv') || 
                             fileName.endsWith('.xlsx') || 
                             fileName.endsWith('.xls');
    
    if (!validTypes.includes(file.type) && !isValidExtension) {
      setResult({
        success: false,
        message: '请上传 CSV 或 Excel 文件',
        duplicateCount: 0,
        mixedFormatCount: 0,
        importedCount: 0,
        overwrittenCount: 0,
        skippedCount: 0,
        batchId: '',
        tableId: '',
        duplicateProductIds: [],
        overwrittenProductIds: [],
        skippedProductIds: [],
        mixedProductIds: [],
        allProductIds: [],
      });
      return;
    }

    setIsUploading(true);
    setResult(null);
    
    try {
      const importResult = await onImport(file);
      setResult(importResult);
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '导入失败',
        duplicateCount: 0,
        mixedFormatCount: 0,
        importedCount: 0,
        overwrittenCount: 0,
        skippedCount: 0,
        batchId: '',
        tableId: '',
        duplicateProductIds: [],
        overwrittenProductIds: [],
        skippedProductIds: [],
        mixedProductIds: [],
        allProductIds: [],
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all duration-200 cursor-pointer',
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-300' : '',
          !disabled && isDragging ? 'border-blue-500 bg-blue-50' : '',
          !disabled && !isDragging ? 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50' : '',
          isUploading ? 'cursor-wait' : ''
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleChange}
          disabled={disabled || isUploading}
          className="hidden"
        />
        
        {isUploading ? (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-gray-700">正在处理文件...</p>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-full bg-blue-50 p-4">
              {isDragging ? (
                <FileSpreadsheet className="h-10 w-10 text-blue-600" />
              ) : (
                <Upload className="h-10 w-10 text-blue-600" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 mb-2 text-center">{description}</p>
            <p className="text-xs text-gray-400">
              支持 CSV、XLSX、XLS 格式
            </p>
          </>
        )}
      </div>

      {result && (
        <div className="space-y-3">
          {result.success ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">成功导入</p>
                      <p className="text-2xl font-bold text-green-600">{result.importedCount}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </div>
                
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">重复数据</p>
                      <p className={cn(
                        'text-2xl font-bold',
                        result.duplicateCount > 0 ? 'text-amber-600' : 'text-gray-400'
                      )}>
                        {result.duplicateCount}
                      </p>
                    </div>
                    <AlertCircle className={cn(
                      'h-8 w-8',
                      result.duplicateCount > 0 ? 'text-amber-500' : 'text-gray-300'
                    )} />
                  </div>
                </div>
                
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">混合格式</p>
                      <p className={cn(
                        'text-2xl font-bold',
                        result.mixedFormatCount > 0 ? 'text-amber-600' : 'text-gray-400'
                      )}>
                        {result.mixedFormatCount}
                      </p>
                    </div>
                    <AlertCircle className={cn(
                      'h-8 w-8',
                      result.mixedFormatCount > 0 ? 'text-amber-500' : 'text-gray-300'
                    )} />
                  </div>
                </div>
              </div>
              
              {(result.duplicateCount > 0 || result.mixedFormatCount > 0) && (
                <div className="flex items-start space-x-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">导入完成，但存在以下问题：</p>
                    <ul className="mt-1 list-disc list-inside space-y-0.5">
                      {result.duplicateCount > 0 && (
                        <li>{result.duplicateCount} 条重复数据已被跳过</li>
                      )}
                      {result.mixedFormatCount > 0 && (
                        <li>{result.mixedFormatCount} 条数据格式混合，需要后续处理</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
              
              {result.duplicateCount === 0 && result.mixedFormatCount === 0 && (
                <div className="flex items-center space-x-2 rounded-lg border border-green-200 bg-green-50 p-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <p className="text-sm text-green-800 font-medium">{result.message}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start space-x-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium">导入失败</p>
                <p className="mt-1">{result.message}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
