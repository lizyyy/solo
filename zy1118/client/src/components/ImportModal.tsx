import { useState, useRef, useCallback } from 'react';
import type { Hall, Booth, FlowZone, PowerZone } from '../types';
import { importApi } from '../services/api';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (data: {
    hall?: Hall;
    booths?: Booth[];
    flowZones?: FlowZone[];
    powerZones?: PowerZone[];
  }) => void;
}

type ImportType = 'hall' | 'booths' | 'flow' | 'power';

export function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<ImportType>('hall');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    hall?: Hall;
    booths?: Booth[];
    flowZones?: FlowZone[];
    powerZones?: PowerZone[];
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: ImportType; label: string; description: string; accept: string }[] = [
    { id: 'hall', label: '展厅配置', description: '导入 hall.json 配置展厅尺寸、出入口、柱子等', accept: '.json' },
    { id: 'booths', label: '展位列表', description: '导入 booths.csv 配置展位信息', accept: '.csv' },
    { id: 'flow', label: '人流区域', description: '导入 flow.csv 配置人流热区', accept: '.csv' },
    { id: 'power', label: '用电区域', description: '导入 power-zones.json 配置供电分区', accept: '.json' },
  ];

  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      let result: {
        hall?: Hall;
        booths?: Booth[];
        flowZones?: FlowZone[];
        powerZones?: PowerZone[];
      } = {};

      switch (activeTab) {
        case 'hall':
          result.hall = await importApi.importHall(file);
          break;
        case 'booths':
          result.booths = await importApi.importBooths(file);
          break;
        case 'flow':
          result.flowZones = await importApi.importFlow(file);
          break;
        case 'power':
          result.powerZones = await importApi.importPowerZones(file);
          break;
      }

      setPreview(result);
    } catch (err) {
      setError('文件解析失败，请检查文件格式是否正确');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleConfirm = useCallback(() => {
    onImportComplete(preview);
    setPreview({});
    onClose();
  }, [preview, onImportComplete, onClose]);

  const getPreviewText = () => {
    if (preview.hall) {
      return `展厅: ${preview.hall.name} (${preview.hall.dimensions.width}m × ${preview.hall.dimensions.depth}m)`;
    }
    if (preview.booths) {
      return `共 ${preview.booths.length} 个展位`;
    }
    if (preview.flowZones) {
      return `共 ${preview.flowZones.length} 个人流区域`;
    }
    if (preview.powerZones) {
      return `共 ${preview.powerZones.length} 个供电区域`;
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">导入数据</h2>
          <p className="text-sm text-gray-500 mt-1">选择要导入的文件类型</p>
        </div>

        <div className="flex border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPreview({});
                setError(null);
              }}
              className={`flex-1 py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">
            {tabs.find(t => t.id === activeTab)?.description}
          </p>

          <div
            className={`drop-zone p-8 text-center cursor-pointer ${
              isDragOver ? 'drag-over' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={tabs.find(t => t.id === activeTab)?.accept}
              className="hidden"
              onChange={handleInputChange}
            />
            
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-2">解析中...</p>
              </div>
            ) : getPreviewText() ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl">✓</span>
                </div>
                <p className="text-sm font-medium text-gray-700">{getPreviewText()}</p>
                <p className="text-xs text-gray-400 mt-1">点击可重新选择文件</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                  <span className="text-2xl">📁</span>
                </div>
                <p className="text-sm text-gray-600">拖拽文件到此处或点击选择</p>
                <p className="text-xs text-gray-400 mt-1">
                  支持 {tabs.find(t => t.id === activeTab)?.accept} 格式
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-danger-50 text-danger-700 text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={() => {
              onClose();
              setPreview({});
              setError(null);
            }}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!Object.keys(preview).length || isLoading}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
}
