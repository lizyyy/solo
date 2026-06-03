import React, { useState } from 'react';
import {
  Upload,
  Layers,
  Download,
  Play,
  RotateCcw,
  User,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { CadUpdateModal } from './CadUpdateModal';
import { DEMO_CAD_LAYERS } from '../core/mockData';

export const ActionBar: React.FC = () => {
  const {
    processState,
    isLoading,
    runImportDemo,
    runCadDemo,
    runExportDemo,
    runFullDemo,
    reset,
    records,
  } = useAppStore();

  const [showCadModal, setShowCadModal] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const handleImport = async () => {
    await runImportDemo();
  };

  const handleCad = async () => {
    if (records.length === 0 || !records[0].photoNo) {
      setShowCadModal(true);
      return;
    }
    await runCadDemo();
  };

  const handleSingleCadUpdate = (recordId: string) => {
    setSelectedRecordId(recordId);
    setShowCadModal(true);
  };

  const handleExport = async () => {
    const fileName = await runExportDemo();
    if (fileName) {
      console.log('导出成功:', fileName);
    }
  };

  const handleFullDemo = async () => {
    await runFullDemo();
  };

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？')) {
      reset();
    }
  };

  return (
    <>
      <div className="bg-industrial-card rounded-xl p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary-400" />
            <span className="font-medium text-industrial-text">
              操作人：<span className="text-primary-400">培训教官 老梁</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-industrial-muted">
            <span>演示模式</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleImport}
            disabled={isLoading || processState.importCompleted}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading && processState.currentStep === 'import' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            第一步：导入巡检照片编号
          </button>

          <button
            onClick={handleCad}
            disabled={isLoading || !processState.importCompleted || processState.cadCompleted}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading && processState.currentStep === 'cad' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Layers className="w-4 h-4" />
            )}
            第二步：补录CAD图层名
          </button>

          <button
            onClick={handleExport}
            disabled={isLoading || !processState.cadCompleted || processState.exportCompleted}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading && processState.currentStep === 'export' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            第三步：导出截图
          </button>

          <div className="flex-1" />

          <button
            onClick={handleFullDemo}
            disabled={isLoading || processState.importCompleted}
            className="btn-warning flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            一键演示完整流程
          </button>

          <button
            onClick={handleReset}
            disabled={isLoading}
            className="btn-secondary flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
        </div>

        {processState.importCompleted && !processState.cadCompleted && (
          <div className="mt-4 p-3 bg-primary-600/10 border border-primary-600/30 rounded-lg">
            <p className="text-sm text-primary-300">
              💡 提示：您也可以点击单条记录上的"补录CAD"按钮，单独为每条记录补录CAD图层名
            </p>
            <div className="flex gap-2 mt-2">
              {records.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSingleCadUpdate(r.id)}
                  className="text-xs px-3 py-1 bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 rounded transition-colors"
                  disabled={!!r.cadLayerName}
                >
                  {r.id}: {r.cadLayerName || `补录 → ${DEMO_CAD_LAYERS[r.id]}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCadModal && (
        <CadUpdateModal
          recordId={selectedRecordId}
          onClose={() => {
            setShowCadModal(false);
            setSelectedRecordId(null);
          }}
        />
      )}
    </>
  );
};
