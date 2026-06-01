import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Database } from 'lucide-react';
import { useDataStore } from '@/store/useDataStore';
import { parseCsvFile } from '@/utils/csvParser';

export function FileUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setRecords, records, loadSampleData } = useDataStore();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    setUploadStatus('loading');
    setFileName(file.name);
    setErrorMessage('');

    try {
      const records = await parseCsvFile(file);
      setRecords(records);
      setUploadStatus('success');
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '文件解析失败');
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadSample = () => {
    loadSampleData();
    setUploadStatus('success');
    setFileName('电池热失控阈值样例数据.csv');
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-red-500 bg-red-500/10'
            : uploadStatus === 'success'
              ? 'border-emerald-500 bg-emerald-500/5'
              : uploadStatus === 'error'
                ? 'border-red-500 bg-red-500/5'
                : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          {uploadStatus === 'success' ? (
            <>
              <CheckCircle className="w-12 h-12 text-emerald-400" />
              <div>
                <p className="text-lg font-medium text-emerald-400">数据导入成功</p>
                <p className="text-sm text-slate-400 mt-1">
                  {fileName} · {records.length} 条记录
                </p>
              </div>
            </>
          ) : uploadStatus === 'error' ? (
            <>
              <XCircle className="w-12 h-12 text-red-400" />
              <div>
                <p className="text-lg font-medium text-red-400">导入失败</p>
                <p className="text-sm text-slate-400 mt-1">{errorMessage}</p>
              </div>
            </>
          ) : uploadStatus === 'loading' ? (
            <>
              <div className="w-12 h-12 border-4 border-slate-600 border-t-red-500 rounded-full animate-spin" />
              <p className="text-lg font-medium text-slate-300">正在解析文件...</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-slate-400" />
              <div>
                <p className="text-lg font-medium text-slate-200">
                  拖拽文件到此处，或点击选择
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  支持 CSV、JSON 格式 · 自动识别温度、电压、时间字段
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-sm text-slate-500">或者</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      <button
        onClick={handleLoadSample}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition-colors group"
      >
        <Database className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
        <div className="text-left">
          <p className="font-medium text-slate-200">加载"电池热失控阈值"样例数据</p>
          <p className="text-sm text-slate-400">
            包含空值、重复项、边界记录、极端值等测试场景
          </p>
        </div>
        <FileText className="w-5 h-5 text-slate-500 ml-auto" />
      </button>
    </div>
  );
}
