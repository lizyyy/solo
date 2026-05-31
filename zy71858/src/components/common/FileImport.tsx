import { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { parseExcelFile, downloadTemplate } from '@/utils/importExport';
import { useRecordStore } from '@/store/useRecordStore';
import { ImportRecord } from '@/utils/importExport';

interface FileImportProps {
  onClose?: () => void;
}

export function FileImport({ onClose }: FileImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewData, setPreviewData] = useState<ImportRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importRecords = useRecordStore((state) => state.importRecords);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const data = await parseExcelFile(file);
      if (data.length === 0) {
        setError('文件中没有有效数据');
        return;
      }
      setPreviewData(data);
    } catch (err) {
      setError('文件解析失败，请检查文件格式');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      importRecords(previewData);
      setIsImporting(false);
      setPreviewData([]);
      onClose?.();
    }, 500);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">导入数据</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {previewData.length === 0 ? (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600 mb-2">拖拽 Excel 文件到这里</p>
            <p className="text-sm text-slate-400">或点击选择文件</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="mt-4 flex justify-between items-center">
            <button
              onClick={downloadTemplate}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <FileText className="w-4 h-4" />
              下载导入模板
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 p-3 bg-green-50 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm">
              已读取 {previewData.length} 条记录，确认后导入
            </span>
          </div>

          <div className="max-h-64 overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">建筑名称</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">楼层</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">房间号</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">来源</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-3 py-2">{row.buildingName}</td>
                    <td className="px-3 py-2">{row.floor}</td>
                    <td className="px-3 py-2">{row.roomNumber}</td>
                    <td className="px-3 py-2 text-slate-500">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={() => setPreviewData([])}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              重新选择
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isImporting ? '导入中...' : '确认导入'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
