import React, { useCallback, useState } from 'react';
import { Upload, Check, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  label: string;
  accept?: string;
  onFileSelect: (file: File) => void;
  selectedFileName?: string;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  accept = '.csv',
  onFileSelect,
  selectedFileName,
  className,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer',
          isDragOver
            ? 'border-amber-500 bg-amber-50'
            : selectedFileName
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-slate-300 hover:border-slate-400 bg-white'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById(`file-${label}`)?.click()}
      >
        <input
          id={`file-${label}`}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
        />
        {selectedFileName ? (
          <div className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            <div className="text-left">
              <p className="text-sm font-medium text-emerald-700">{selectedFileName}</p>
              <p className="text-xs text-emerald-600">文件已上传</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileSelect({} as File);
              }}
              className="ml-2 p-1 hover:bg-emerald-100 rounded"
            >
              <X className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
        ) : (
          <div>
            <Upload
              className={cn(
                'w-8 h-8 mx-auto mb-2',
                isDragOver ? 'text-amber-500' : 'text-slate-400'
              )}
            />
            <p className="text-sm text-slate-600">
              拖拽文件到此处，或<span className="text-amber-600 font-medium">点击选择</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">支持 CSV 格式</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const CSVTemplateDownload: React.FC<{
  type: 'items' | 'bids' | 'transactions' | 'unsolds';
  label: string;
}> = ({ type, label }) => {
  const headers: Record<string, string[]> = {
    items: ['id', 'name', 'category', 'appraisedValue', 'appraiser', 'appraisalDate', 'condition', 'provenance', 'notes'],
    bids: ['id', 'itemId', 'buyerId', 'buyerName', 'bidAmount', 'bidDate', 'bidType', 'isWinning', 'buyerActivity', 'buyerHistory'],
    transactions: ['id', 'itemId', 'itemName', 'salePrice', 'reservePrice', 'saleDate', 'buyerId', 'commissionRate', 'commissionAmount', 'auctionHouse', 'notes'],
    unsolds: ['id', 'itemId', 'itemName', 'appraisedValue', 'reservePrice', 'highestBid', 'unsoldDate', 'reason', 'reAuctionCount', 'storageCost', 'marketingCost', 'opportunityCost'],
  };

  const downloadTemplate = () => {
    const csvContent = headers[type].join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_${type}.csv`;
    link.click();
  };

  return (
    <button
      onClick={downloadTemplate}
      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-amber-600 transition-colors"
    >
      <FileText className="w-3.5 h-3.5" />
      下载{label}模板
    </button>
  );
};
