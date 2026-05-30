import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import type { MaterialType, Material, UpdateDetectionResult } from '@/types';

interface MaterialUploadProps {
  batchId: string;
  onUpload: (file: File, batchId: string, forcedType?: MaterialType) => Promise<{
    material: Material;
    detectionResult: UpdateDetectionResult;
  }>;
  onSuccess?: (result: { material: Material; detectionResult: UpdateDetectionResult }) => void;
}

const materialTypeOptions = [
  { value: 'product_terms', label: '产品条款' },
  { value: 'customer_position', label: '客户持仓' },
  { value: 'underlying_price', label: '标的价格' },
];

const statusLabels: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'neutral' }> = {
  new: { label: '新导入', variant: 'success' },
  duplicate: { label: '重复提交', variant: 'neutral' },
  updated: { label: '已更新', variant: 'warning' },
  supplementary: { label: '补充材料', variant: 'info' },
};

export const MaterialUpload: React.FC<MaterialUploadProps> = ({ batchId, onUpload, onSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedType, setSelectedType] = useState<MaterialType | ''>('');
  const [lastResult, setLastResult] = useState<{
    material: Material;
    detectionResult: UpdateDetectionResult;
  } | null>(null);

  const detectTypeByFilename = (filename: string): MaterialType | null => {
    const lower = filename.toLowerCase();
    if (lower.includes('条款') || lower.includes('term') || lower.includes('product')) {
      return 'product_terms';
    }
    if (lower.includes('持仓') || lower.includes('position') || lower.includes('客户')) {
      return 'customer_position';
    }
    if (lower.includes('价格') || lower.includes('price') || lower.includes('行情') || lower.includes('标的')) {
      return 'underlying_price';
    }
    return null;
  };

  const handleFile = useCallback(async (file: File, forcedType?: MaterialType) => {
    setIsUploading(true);
    setLastResult(null);

    try {
      const result = await onUpload(file, batchId, forcedType);
      setLastResult(result);
      onSuccess?.(result);
    } catch (error) {
      console.error('上传失败:', error);
    } finally {
      setIsUploading(false);
    }
  }, [batchId, onUpload, onSuccess]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    const detectedType = detectTypeByFilename(file.name);

    if (detectedType) {
      handleFile(file, detectedType);
    } else {
      setPendingFile(file);
      setShowTypeModal(true);
    }
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const detectedType = detectTypeByFilename(file.name);

    if (detectedType) {
      handleFile(file, detectedType);
    } else {
      setPendingFile(file);
      setShowTypeModal(true);
    }

    e.target.value = '';
  };

  const handleConfirmType = () => {
    if (pendingFile && selectedType) {
      handleFile(pendingFile, selectedType as MaterialType);
      setShowTypeModal(false);
      setPendingFile(null);
      setSelectedType('');
    }
  };

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileInput}
        />

        {isUploading ? (
          <div className="flex flex-col items-center">
            <RefreshCw className="w-12 h-12 text-primary-500 animate-spin mb-3" />
            <p className="text-sm text-gray-600">正在解析文件...</p>
          </div>
        ) : lastResult ? (
          <div className="flex flex-col items-center">
            {lastResult.detectionResult.status === 'duplicate' ? (
              <AlertCircle className="w-12 h-12 text-gray-400 mb-3" />
            ) : lastResult.detectionResult.status === 'updated' ? (
              <RefreshCw className="w-12 h-12 text-yellow-500 mb-3" />
            ) : (
              <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
            )}
            <p className="text-sm font-medium text-gray-900 mb-1">
              {lastResult.material.filename}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={statusLabels[lastResult.detectionResult.status].variant}>
                {statusLabels[lastResult.detectionResult.status].label}
              </Badge>
              <Badge variant="default">
                {materialTypeOptions.find(o => o.value === lastResult.material.type)?.label}
              </Badge>
            </div>
            {lastResult.detectionResult.status === 'updated' && lastResult.detectionResult.changes.length > 0 && (
              <div className="mt-3 text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded text-left max-w-md">
                <p className="font-medium mb-1">更新内容：</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {lastResult.detectionResult.changes.map((change, idx) => (
                    <li key={idx}>{change}</li>
                  ))}
                </ul>
              </div>
            )}
            {lastResult.detectionResult.status === 'duplicate' && (
              <p className="mt-2 text-xs text-gray-500">
                该材料已存在于批次中，系统自动跳过
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setLastResult(null)}
            >
              <Plus className="w-4 h-4 mr-1" />
              继续上传
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="w-12 h-12 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-900 mb-1">
              拖拽文件到此处，或
              <label htmlFor="file-upload" className="text-primary-600 hover:text-primary-700 cursor-pointer ml-1">
                点击选择文件
              </label>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              支持 .xlsx, .xls, .csv 格式，系统会自动识别材料类型
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <FileText className="w-3 h-3" />
                <span>产品条款</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <FileText className="w-3 h-3" />
                <span>客户持仓</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <FileText className="w-3 h-3" />
                <span>标的价格</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={showTypeModal}
        onClose={() => { setShowTypeModal(false); setPendingFile(null); setSelectedType(''); }}
        title="请选择材料类型"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => { setShowTypeModal(false); setPendingFile(null); setSelectedType(''); }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmType}
              disabled={!selectedType}
            >
              确认上传
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p>文件：<span className="font-medium text-gray-900">{pendingFile?.name}</span></p>
            <p className="mt-1 text-xs text-gray-500">
              系统未能自动识别材料类型，请手动选择：
            </p>
          </div>
          <Select
            options={materialTypeOptions}
            placeholder="请选择材料类型"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as MaterialType)}
          />
        </div>
      </Modal>
    </div>
  );
};
MaterialUpload.displayName = 'MaterialUpload';
