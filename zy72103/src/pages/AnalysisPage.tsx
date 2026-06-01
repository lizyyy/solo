import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/store/useDataStore';
import { DataQualityCard } from '@/components/Dashboard/DataQualityCard';
import { ExtremeValuesCard } from '@/components/Dashboard/ExtremeValuesCard';
import { DetectionTimeline } from '@/components/Dashboard/DetectionTimeline';
import { TemperatureChart } from '@/components/Dashboard/TemperatureChart';
import { BoxPlotChartComponent } from '@/components/Dashboard/BoxPlotChart';
import { DataTable } from '@/components/Dashboard/DataTable';
import { SupplementNoteModal } from '@/components/Dashboard/SupplementNoteModal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { compareAnalysisResults } from '@/algorithms/thresholdJudgment';
import { ArrowRight, ArrowLeft, Play, RefreshCw, GitCompare } from 'lucide-react';

export function AnalysisPage() {
  const navigate = useNavigate();
  const { records, isAnalyzed, runAnalysis, previousAnalysis, currentAnalysis } = useDataStore();
  const [showNoteModal, setShowNoteModal] = useState(false);

  const comparison = previousAnalysis && currentAnalysis
    ? compareAnalysisResults(previousAnalysis, currentAnalysis)
    : null;

  if (records.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
          <Play className="w-8 h-8 text-slate-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-300 mb-2">暂无数据</h3>
        <p className="text-slate-500 mb-6">请先导入数据再进行分析</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          前往数据导入
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            分析仪表盘
          </h2>
          <p className="text-slate-400 mt-1">
            查看极端值检测结果、阈值判断过程和数据质量
          </p>
        </div>
        <div className="flex items-center gap-3">
          {comparison && previousAnalysis !== currentAnalysis && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <GitCompare className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400">{comparison.summary}</span>
            </div>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors text-sm flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            返回导入
          </button>
          <button
            onClick={runAnalysis}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新分析
          </button>
          <button
            onClick={() => navigate('/report')}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
          >
            生成报告
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isAnalyzed ? (
        <div className="text-center py-20 bg-slate-800/30 rounded-xl border border-slate-700">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-700 rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-300 mb-2">数据已就绪</h3>
          <p className="text-slate-500 mb-6">点击下方按钮开始分析</p>
          <button
            onClick={runAnalysis}
            className="flex items-center gap-2 px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors mx-auto"
          >
            <Play className="w-5 h-5" />
            运行电池热失控阈值分析
          </button>
        </div>
      ) : (
        <>
          <DataQualityCard />
          <ExtremeValuesCard />

          <div className="grid grid-cols-2 gap-6">
            <TemperatureChart />
            <div className="space-y-6">
              <BoxPlotChartComponent />
              <DetectionTimeline />
            </div>
          </div>

          <DataTable onAddNote={() => setShowNoteModal(true)} />
        </>
      )}

      <SupplementNoteModal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
      />
    </div>
  );
}
