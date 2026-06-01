import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/store/useDataStore';
import { ReportSummary } from '@/components/Report/ReportSummary';
import { RecommendationsCard } from '@/components/Report/RecommendationsCard';
import { TemperatureChart } from '@/components/Dashboard/TemperatureChart';
import { BoxPlotChartComponent } from '@/components/Dashboard/BoxPlotChart';
import { DataTable } from '@/components/Dashboard/DataTable';
import { SupplementNoteModal } from '@/components/Dashboard/SupplementNoteModal';
import { exportToPdf } from '@/utils/exportPdf';
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react';

export function ReportPage() {
  const navigate = useNavigate();
  const { records, isAnalyzed } = useDataStore();
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportToPdf('report-content', '电池热失控阈值分析报告.pdf');
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (records.length === 0 || !isAnalyzed) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
          <FileText className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-300 mb-2">暂无分析结果</h3>
        <p className="text-slate-500 mb-6">请先导入数据并运行分析</p>
        <button
          onClick={() => navigate('/analysis')}
          className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          前往分析仪表盘
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            报告预览
          </h2>
          <p className="text-slate-400 mt-1">
            查看完整的分析报告、处理建议和数据明细
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/analysis')}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors text-sm flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            返回分析
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                导出 PDF
              </>
            )}
          </button>
        </div>
      </div>

      <div id="report-content" className="space-y-6 bg-white text-slate-900 rounded-xl p-8">
        <div className="text-center border-b border-slate-200 pb-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            电池热失控阈值分析报告
          </h1>
          <p className="text-slate-500">Battery Thermal Runaway Threshold Analysis Report</p>
        </div>

        <div className="text-slate-900">
          <ReportSummary />
        </div>

        <div className="text-slate-900">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-500" />
            可视化分析
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-slate-900">
              <TemperatureChart />
            </div>
            <div className="text-slate-900">
              <BoxPlotChartComponent />
            </div>
          </div>
        </div>

        <div className="text-slate-900">
          <RecommendationsCard />
        </div>

        <div className="text-slate-900">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            数据明细
          </h3>
          <div className="text-slate-900">
            <DataTable onAddNote={() => setShowNoteModal(true)} />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6 mt-6 text-center text-sm text-slate-500">
          <p>本报告由电池热失控阈值分析系统自动生成</p>
          <p className="mt-1">判断过程可追溯，极端值不被平均值掩盖</p>
        </div>
      </div>

      <SupplementNoteModal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
      />
    </div>
  );
}
