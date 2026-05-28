import React, { useState } from 'react';
import { FileText, Download, FileJson, Loader2 } from 'lucide-react';
import { useSolarStore } from '../../store/useSolarStore';
import { exportPDFReport, exportParamsSnapshot } from '../../utils/exportReport';

export const ReportExport: React.FC = () => {
  const { params, results } = useSolarStore();
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingJSON, setExportingJSON] = useState(false);

  const handlePDFExport = async () => {
    setExportingPDF(true);
    try {
      await exportPDFReport(params, results);
    } catch (error) {
      console.error('PDF导出失败:', error);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleJSONExport = () => {
    setExportingJSON(true);
    try {
      exportParamsSnapshot(params, results);
    } catch (error) {
      console.error('JSON导出失败:', error);
    } finally {
      setExportingJSON(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">报告导出</h3>
      </div>

      <div className="space-y-3">
        <button
          onClick={handlePDFExport}
          disabled={exportingPDF}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all"
        >
          {exportingPDF ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          导出PDF分析报告
        </button>

        <button
          onClick={handleJSONExport}
          disabled={exportingJSON}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-all"
        >
          {exportingJSON ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FileJson className="w-5 h-5" />
          )}
          导出参数快照 (JSON)
        </button>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-xs text-gray-500">
          <div className="font-medium text-gray-700 mb-2">报告包含内容</div>
          <ul className="list-disc list-inside space-y-1">
            <li>项目基本信息（城市、纬度、系统参数）</li>
            <li>倾角优化结果及计算说明</li>
            <li>收益分析（年发电量、投资回收期）</li>
            <li>月度发电量预测数据</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
