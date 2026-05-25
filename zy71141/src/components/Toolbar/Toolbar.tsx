import React, { useState, useRef } from 'react';
import {
  Upload,
  RotateCcw,
  Download,
  Eye,
  Layers,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import * as THREE from 'three';
import { useInspectionStore } from '../../store/inspectionStore';
import { generateReportPDF } from '../../utils/pdfExport';
import { ReportData, CrackStatus } from '../../types';

interface ToolbarProps {
  glRenderer?: THREE.WebGLRenderer | null;
}

const presetViews = [
  { name: '俯视图', position: { x: 0, y: 15, z: 0.01 }, target: { x: 0, y: 0, z: 0 } },
  { name: '主视图', position: { x: 12, y: 5, z: 0 }, target: { x: 0, y: 1, z: 0 } },
  { name: '侧视图', position: { x: 0, y: 5, z: 12 }, target: { x: 0, y: 1, z: 0 } },
  { name: '斜视图', position: { x: 10, y: 8, z: 10 }, target: { x: 0, y: 1, z: 0 } },
];

const captureScreenshot = (glRenderer: THREE.WebGLRenderer | null | undefined): string | undefined => {
  if (!glRenderer) return undefined;
  
  try {
    const canvas = glRenderer.domElement;
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('截图失败:', error);
    return undefined;
  }
};

export const Toolbar: React.FC<ToolbarProps> = ({ glRenderer }) => {
  const {
    loadSampleData,
    resetState,
    setCameraView,
    getCracksWithBatchStatus,
    getCurrentBatch,
    filters,
    cameraView,
    sampleDataLoaded,
  } = useInspectionStore();

  const [showViewMenu, setShowViewMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  const filteredCracks = getCracksWithBatchStatus().filter((crack) => {
    if (filters.status.length > 0 && !filters.status.includes(crack.status)) {
      return false;
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      if (!crack.description.toLowerCase().includes(query) && 
          !crack.id.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });
  const currentBatch = getCurrentBatch();

  const statusCounts = filteredCracks.reduce((acc, crack) => {
    acc[crack.status] = (acc[crack.status] || 0) + 1;
    return acc;
  }, {} as Record<CrackStatus, number>);

  const handleViewChange = (view: typeof presetViews[0]) => {
    setCameraView({ position: view.position, target: view.target });
    setShowViewMenu(false);
  };

  const handleExportReport = async () => {
    if (!currentBatch) return;

    setIsExporting(true);
    try {
      const { batches, getPhotosForCurrentBatch, getCracksWithBatchStatus } = useInspectionStore.getState();
      const currentPhotos = getPhotosForCurrentBatch();
      const cracksWithBatchStatus = getCracksWithBatchStatus().filter((crack) => {
        if (filters.status.length > 0 && !filters.status.includes(crack.status)) {
          return false;
        }
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          if (!crack.description.toLowerCase().includes(query) && 
              !crack.id.toLowerCase().includes(query)) {
            return false;
          }
        }
        return true;
      });

      const batchIndex = batches.findIndex((b) => b.id === currentBatch.id);
      const statusCountsWithBatch = cracksWithBatchStatus.reduce((acc, crack) => {
        acc[crack.status] = (acc[crack.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const screenshot = captureScreenshot(glRenderer);

      const reportData: ReportData = {
        batchName: currentBatch.name,
        batchDate: currentBatch.date,
        inspector: currentBatch.inspector,
        batchId: currentBatch.id,
        batchIndex: batchIndex,
        totalBatches: batches.length,
        filters,
        cameraView,
        cracks: cracksWithBatchStatus,
        photos: currentPhotos,
        totalCracks: cracksWithBatchStatus.length,
        totalPhotos: currentPhotos.length,
        statusCounts: statusCountsWithBatch,
        screenshot,
        exportTime: new Date().toLocaleString('zh-CN'),
      };

      await generateReportPDF(reportData);
    } catch (error) {
      console.error('导出报告失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-400" />
          <h1 className="text-lg font-bold text-white">桥梁裂缝巡检对齐系统</h1>
        </div>

        {sampleDataLoaded && currentBatch && (
          <div className="flex items-center gap-4 ml-6">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500 bg-opacity-20 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-400">
                新增: {statusCounts['new'] || 0}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-500 bg-opacity-20 rounded-full">
              <Clock className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs text-orange-400">
                发展中: {statusCounts['developing'] || 0}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500 bg-opacity-20 rounded-full">
              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-400">
                已维修: {statusCounts['repaired'] || 0}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              共 {filteredCracks.length} 条裂缝
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!sampleDataLoaded ? (
          <button
            onClick={loadSampleData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            导入样例数据
          </button>
        ) : (
          <>
            <button
              onClick={loadSampleData}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
            >
              <Upload className="w-4 h-4" />
              重新导入
            </button>

            <button
              onClick={resetState}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>

            <div className="relative" ref={viewMenuRef}>
              <button
                onClick={() => setShowViewMenu(!showViewMenu)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
              >
                <Eye className="w-4 h-4" />
                视角
              </button>
              {showViewMenu && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 min-w-[120px]">
                  {presetViews.map((view) => (
                    <button
                      key={view.name}
                      onClick={() => handleViewChange(view)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      {view.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleExportReport}
              disabled={isExporting || !currentBatch}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              {isExporting ? '导出中...' : '导出报告'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
