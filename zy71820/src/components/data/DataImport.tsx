import { useState, useRef } from 'react';
import { Upload, FileJson, CheckCircle, XCircle } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { importFromFile, type ImportResult } from '@/services/DataService';
import { FriendlyError } from '@/utils/errorMessages';
import { formatDate } from '@/utils/helpers';

interface DataImportProps {
  onImportComplete?: () => void;
}

export function DataImport({ onImportComplete }: DataImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showError, showSuccess, showWarning } = useUIStore();

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      showWarning('请选择JSON格式的文件');
      return;
    }

    try {
      const result = await importFromFile(file);
      setLastResult(result);

      if (result.success) {
        showSuccess(`成功导入 ${result.imported} 条数据`);
        onImportComplete?.();
      } else {
        showWarning(`导入完成：成功 ${result.imported} 条，失败 ${result.failed} 条`);
      }
    } catch (error) {
      if (error instanceof FriendlyError) {
        showError(error.userMessage);
      } else {
        showError({
          code: 'UNKNOWN_ERROR',
          message: '导入失败了',
          suggestion: '请检查文件格式是否正确，或者联系技术支持',
          contact: '联系技术组 @技术支持',
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          isDragging
            ? 'border-neon-orange bg-neon-orange/10'
            : 'border-night-card hover:border-neon-orange/50 hover:bg-night-card/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileInput}
          className="hidden"
        />
        <Upload
          size={48}
          className={`mx-auto mb-4 ${
            isDragging ? 'text-neon-orange' : 'text-gray-500'
          }`}
        />
        <p className="font-display text-xl text-white mb-2">
          拖拽文件到这里，或点击选择
        </p>
        <p className="font-body text-gray-400 text-sm">
          支持导入关卡配置 JSON 或玩家分数数组 JSON
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
          <FileJson size={16} />
          <span>.json 格式</span>
        </div>
      </div>

      {lastResult && (
        <div
          className={`rounded-xl p-4 border ${
            lastResult.success
              ? 'bg-neon-green/10 border-neon-green/30'
              : 'bg-neon-yellow/10 border-neon-yellow/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {lastResult.success ? (
              <CheckCircle size={20} className="text-neon-green" />
            ) : (
              <XCircle size={20} className="text-neon-yellow" />
            )}
            <span className="font-body text-white font-medium">
              上次导入结果
            </span>
            <span className="text-sm text-gray-400 ml-auto">
              {formatDate(Date.now())}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">成功导入：</span>
              <span className="text-neon-green font-medium ml-1">
                {lastResult.imported} 条
              </span>
            </div>
            <div>
              <span className="text-gray-400">导入失败：</span>
              <span className="text-neon-pink font-medium ml-1">
                {lastResult.failed} 条
              </span>
            </div>
          </div>
          {lastResult.errors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-night-card">
              <p className="text-xs text-gray-400 mb-2">错误详情：</p>
              <ul className="text-xs text-neon-pink space-y-1">
                {lastResult.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
                {lastResult.errors.length > 5 && (
                  <li>• 还有 {lastResult.errors.length - 5} 条错误未显示</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="bg-night-card rounded-xl p-4">
        <h4 className="font-display text-neon-orange mb-2">📋 导入格式说明</h4>
        <div className="space-y-2 text-sm text-gray-400 font-body">
          <p><strong>关卡配置格式：</strong>包含 id, name, products, customers 等字段</p>
          <p><strong>分数数据格式：</strong>数组形式，每条包含 playerName, levelId, score 等字段</p>
          <p><strong>复盘报告格式：</strong>可以直接导入之前导出的活动复盘报告</p>
        </div>
      </div>
    </div>
  );
}
