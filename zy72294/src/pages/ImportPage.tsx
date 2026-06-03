import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, Check, X, Play } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import type * as T from '@/types';
import { rangefinderRecords as mockRecords } from '@/mock';

type ImportStatus = 'idle' | 'success' | 'duplicate';

interface ImportPreview {
  record: T.RangefinderRecord;
  status: ImportStatus;
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importRecords, rangefinderRecords, duplicateRecordIds } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<T.DuplicateCheckResult | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreview[]>([]);

  const generateId = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;

      const records: T.RangefinderRecord[] = jsonData.map((row) => ({
        id: generateId(),
        batchNo: String(row.batchNo || row.批次号 || ''),
        pointX: Number(row.pointX || row.X坐标 || 0),
        pointY: Number(row.pointY || row.Y坐标 || 0),
        distance: Number(row.distance || row.距离 || 0),
        screenshotUrl: String(row.screenshotUrl || row.截图 || ''),
        alarmOccluded: Boolean(row.alarmOccluded || row.遮挡告警 || false),
        importBatch: '',
        createdAt: '',
        createdBy: '',
      }));

      const preview: ImportPreview[] = records.map((record) => {
        const isDuplicate = rangefinderRecords.some(
          (r) => r.batchNo === record.batchNo && r.pointX === record.pointX && r.pointY === record.pointY
        );
        return {
          record,
          status: isDuplicate ? 'duplicate' : 'success',
        };
      });

      setPreviewData(preview);
      const result = importRecords(records, '小陶');
      setImportResult(result);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
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
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      parseFile(file);
    }
  };

  const handleDemoImport = () => {
    const demoRecords = mockRecords.slice(0, 4).map((r) => ({
      ...r,
      id: generateId(),
    }));

    const preview: ImportPreview[] = demoRecords.map((record, index) => ({
      record,
      status: index % 2 === 0 ? 'success' : 'duplicate',
    }));

    setPreviewData(preview);
    const result = importRecords(demoRecords, '小陶');
    setImportResult(result);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">测距仪记录导入</h1>
        <button
          type="button"
          onClick={handleDemoImport}
          className="flex items-center gap-2 px-4 py-2 bg-industrial-500 text-white rounded-lg hover:bg-industrial-600 transition-colors"
        >
          <Play className="w-4 h-4" />
          模拟导入演示数据
        </button>
      </div>

      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center mb-6 transition-colors',
          isDragging ? 'border-industrial-500 bg-industrial-50' : 'border-gray-300 bg-white',
          'hover:border-industrial-400 hover:bg-gray-50 cursor-pointer'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-industrial-100 flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-industrial-600" />
          </div>
          <p className="text-lg font-medium text-gray-900 mb-2">拖拽文件到此处或点击上传</p>
          <p className="text-sm text-gray-500">支持 Excel (.xlsx, .xls) 和 CSV 格式</p>
        </div>
      </div>

      {importResult && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-card">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-success-100 flex items-center justify-center">
                <Check className="w-4 h-4 text-success-600" />
              </div>
              <span className="text-sm text-gray-700">
                新增 <span className="font-semibold text-success-600">{importResult.addedCount}</span> 条
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-warning-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-warning-600" />
              </div>
              <span className="text-sm text-gray-700">
                重复 <span className="font-semibold text-warning-600">{importResult.skippedCount}</span> 条已跳过
              </span>
            </div>
          </div>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-medium text-gray-900">数据预览</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">批次号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">测距点</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">距离 (m)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">截图</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">遮挡告警</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">导入状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previewData.map((item, index) => (
                  <tr
                    key={index}
                    className={cn(
                      item.status === 'duplicate' && 'bg-gray-100'
                    )}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.record.batchNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ({item.record.pointX}, {item.record.pointY})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">{item.record.distance}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex items-center justify-center">
                        <span className="text-xs text-gray-500">缩略图</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.record.alarmOccluded ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                          是
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-success-100 text-success-700">
                          否
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.status === 'duplicate' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-700">
                          <X className="w-3 h-3" />
                          重复已跳过
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-success-100 text-success-700">
                          <Check className="w-3 h-3" />
                          已导入
                        </span>
                      )}
                    </td>
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
