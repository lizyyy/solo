import { useState, useRef } from 'react';
import { Upload, FileJson, AlertCircle, CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { useAppStore } from '@/store/useAppStore';
import { parseImportFile, validateImportData } from '@/services/importService';
import type { ImportData } from '@/types';

export function ImportModal() {
  const isOpen = useAppStore(state => state.isImportModalOpen);
  const closeModal = useAppStore(state => state.closeImportModal);
  const importData = useAppStore(state => state.importData);
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ImportData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsLoading(true);
    setErrors([]);
    setWarnings([]);
    setParsedData(null);

    try {
      const data = await parseImportFile(selectedFile);
      const { valid, errors: validationErrors } = validateImportData(data);
      
      if (valid) {
        setParsedData(data);
      } else {
        setErrors(validationErrors);
      }
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = () => {
    if (!parsedData) return;
    
    const result = importData(parsedData);
    setWarnings(result.warnings);
    setIsSuccess(true);
    
    setTimeout(() => {
      closeModal();
      setFile(null);
      setParsedData(null);
      setErrors([]);
      setWarnings([]);
      setIsSuccess(false);
    }, 1500);
  };

  const handleClose = () => {
    closeModal();
    setFile(null);
    setParsedData(null);
    setErrors([]);
    setWarnings([]);
    setIsSuccess(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="导入数据">
      <div className="space-y-6">
        <div className="border-2 border-dashed border-tech-cyan/30 rounded-lg p-8 text-center hover:border-tech-cyan/50 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-3 w-full"
          >
            <Upload size={48} className="text-tech-cyan" />
            <span className="text-gray-300">点击或拖拽文件到此处上传</span>
            <span className="text-sm text-gray-500">支持 JSON 格式</span>
          </button>
        </div>

        {file && (
          <div className="flex items-center gap-3 p-3 bg-space-800 rounded border border-tech-cyan/20">
            <FileJson size={24} className="text-tech-cyan" />
            <div className="flex-1">
              <p className="text-sm text-white">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-4">
            <div className="inline-block w-6 h-6 border-2 border-tech-cyan border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400 mt-2">正在解析数据...</p>
          </div>
        )}

        {errors.length > 0 && (
          <div className="p-4 bg-tech-red/10 border border-tech-red/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-tech-red" />
              <span className="text-sm font-medium text-tech-red">数据校验失败</span>
            </div>
            <ul className="text-sm text-gray-300 space-y-1">
              {errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="p-4 bg-tech-orange/10 border border-tech-orange/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-tech-orange" />
              <span className="text-sm font-medium text-tech-orange">警告</span>
            </div>
            <ul className="text-sm text-gray-300 space-y-1">
              {warnings.map((warn, i) => (
                <li key={i}>• {warn}</li>
              ))}
            </ul>
          </div>
        )}

        {parsedData && !isSuccess && (
          <div className="p-4 bg-space-800 rounded border border-tech-green/30">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-tech-green" />
              <span className="text-sm font-medium text-tech-green">数据校验通过</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">数据类型</span>
                <span className="text-white">{parsedData.type === 'ORBIT_ELEMENTS' ? '轨道根数' : '遥测数据'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">数据名称</span>
                <span className="text-white">{parsedData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">时间制式</span>
                <span className="text-white">{parsedData.timeSystem}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">窗口数量</span>
                <span className="text-white">{parsedData.windows.length} 个</span>
              </div>
            </div>
          </div>
        )}

        {isSuccess && (
          <div className="text-center py-4">
            <CheckCircle size={48} className="mx-auto text-tech-green mb-2" />
            <p className="text-tech-green font-medium">导入成功！</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 btn-tech"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!parsedData || isLoading || isSuccess}
            className="flex-1 btn-tech btn-success disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认导入
          </button>
        </div>
      </div>
    </Modal>
  );
}
