import React, { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { downloadJSON, downloadCSV, generateFileName } from '../../utils/export';

export const ReportExport: React.FC = () => {
  const { result } = useSimulationStore();
  const [exportingFormat, setExportingFormat] = useState<'json' | 'csv' | null>(null);

  const handleExport = async (format: 'json' | 'csv') => {
    if (!result) return;
    
    setExportingFormat(format);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (format === 'json') {
      downloadJSON(result);
    } else {
      downloadCSV(result);
    }
    
    setTimeout(() => setExportingFormat(null), 1000);
  };

  if (!result) {
    return null;
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Download className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-semibold text-gray-200">导出报告</h3>
      </div>

      <div className="space-y-3">
        <div className="text-xs text-gray-400 mb-2">
          <div>批次号: <span className="text-cyan-400 font-mono">{result.params.batchId}</span></div>
          <div>文件名示例: <span className="text-gray-300 font-mono text-xs">{generateFileName(result.params.batchId, 'json')}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleExport('json')}
            disabled={exportingFormat !== null}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm transition-colors disabled:opacity-50"
          >
            {exportingFormat === 'json' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <FileJson className="w-4 h-4" />
            )}
            <span>{exportingFormat === 'json' ? '已导出' : 'JSON'}</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={exportingFormat !== null}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-400 text-sm transition-colors disabled:opacity-50"
          >
            {exportingFormat === 'csv' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>{exportingFormat === 'csv' ? '已导出' : 'CSV'}</span>
          </button>
        </div>

        <div className="text-xs text-gray-500 mt-2">
          报告包含: 完整参数配置、来源材料信息、风险点汇总、轨迹数据点
        </div>
      </div>
    </div>
  );
};
