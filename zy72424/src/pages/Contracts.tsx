import { useState, useRef } from 'react';
import {
  Upload,
  Eye,
  Clock,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatDate, formatBytes, generateId } from '../utils/boundaryRules';
import { calculateFileHash, checkDuplicate, handleDuplicateImport } from '../utils/fileHash';
import { ContractScreenshot } from '../types';

export default function Contracts() {
  const contracts = useStore((state) => state.contracts);
  const addContract = useStore((state) => state.addContract);
  const updateContract = useStore((state) => state.updateContract);
  const currentUser = useStore((state) => state.currentUser);

  const [isDragging, setIsDragging] = useState(false);
  const [previewContract, setPreviewContract] = useState<ContractScreenshot | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        errorCount++;
        continue;
      }

      try {
        const hash = await calculateFileHash(file);
        const existing = checkDuplicate(hash, contracts);

        if (existing) {
          const { updated, message } = handleDuplicateImport(existing);
          updateContract(existing.id, updated, currentUser.name);
          duplicateCount++;
        } else {
          const newContract: ContractScreenshot = {
            id: generateId('contract'),
            fileName: file.name,
            fileHash: hash,
            fileUrl: URL.createObjectURL(file),
            fileSize: file.size,
            uploadTime: new Date(),
            lastImportTime: new Date(),
            importCount: 1,
          };
          addContract(newContract);
          successCount++;
        }
      } catch {
        errorCount++;
      }
    }

    const messages: string[] = [];
    if (successCount > 0) messages.push(`成功导入 ${successCount} 个新文件`);
    if (duplicateCount > 0) messages.push(`${duplicateCount} 个重复文件（已更新导入时间，不重复统计）`);
    if (errorCount > 0) messages.push(`${errorCount} 个文件处理失败`);

    if (messages.length > 0) {
      const type = errorCount > 0 ? 'error' : duplicateCount > 0 ? 'warning' : 'success';
      setUploadMessage({ type, text: messages.join('；') });
    }

    setTimeout(() => setUploadMessage(null), 5000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-primary-800">
          合同页截图管理
        </h1>
        <p className="text-gray-600 mt-1">
          导入合同页截图，系统自动去重，不重复统计
        </p>
      </div>

      {uploadMessage && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            uploadMessage.type === 'success'
              ? 'bg-success-50 border border-success-200 text-success-800'
              : uploadMessage.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-danger-50 border border-danger-200 text-danger-800'
          }`}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{uploadMessage.text}</span>
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-50/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-primary-600' : 'text-gray-400'}`} />
        <p className="text-lg font-medium text-primary-800 mb-1">
          拖拽合同页截图到此处
        </p>
        <p className="text-sm text-gray-500">
          或点击选择文件，支持 JPG、PNG 格式
        </p>
        <p className="text-xs text-gray-400 mt-2">
          系统基于 SHA-256 哈希自动去重，重复导入不翻倍统计
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-serif font-semibold text-primary-800">
            已导入截图 ({contracts.length})
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="group relative bg-gray-50 rounded-lg overflow-hidden border border-gray-100 hover:border-primary-200 transition-all"
            >
              <div className="aspect-video overflow-hidden bg-primary-100">
                <img
                  src={contract.fileUrl}
                  alt={contract.fileName}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-primary-800 truncate">
                  {contract.fileName}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {formatBytes(contract.fileSize)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    导入 {contract.importCount} 次
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  上次导入：{formatDate(contract.lastImportTime)}
                </div>
              </div>
              <button
                className="absolute top-2 right-2 p-2 bg-white/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewContract(contract);
                }}
              >
                <Eye className="w-4 h-4 text-primary-700" />
              </button>
              {contract.importCount > 1 && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                  重复导入
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {previewContract && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="font-medium text-primary-800">{previewContract.fileName}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  SHA-256: {previewContract.fileHash}
                </p>
              </div>
              <button
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setPreviewContract(null)}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <img
                src={previewContract.fileUrl}
                alt={previewContract.fileName}
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
