import { useNavigate } from 'react-router-dom';
import { useDataStore } from '@/store/useDataStore';
import { FileUploader } from '@/components/DataImport/FileUploader';
import { DataPreview } from '@/components/DataImport/DataPreview';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ArrowRight, Database, AlertTriangle } from 'lucide-react';

export function ImportPage() {
  const navigate = useNavigate();
  const { records, isAnalyzed, runAnalysis, clearAll } = useDataStore();

  const handleAnalyze = () => {
    runAnalysis();
    navigate('/analysis');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            数据导入
          </h2>
          <p className="text-slate-400 mt-1">
            导入电池热失控阈值实验数据，支持 CSV、JSON 格式
          </p>
        </div>
        <div className="flex items-center gap-3">
          {records.length > 0 && (
            <>
              <button
                onClick={clearAll}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors text-sm"
              >
                清空数据
              </button>
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
              >
                运行分析
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {records.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <Database className="w-5 h-5 text-emerald-400" />
          <div className="flex-1">
            <span className="text-emerald-400 font-medium">
              已加载 {records.length} 条记录
            </span>
            <span className="text-slate-400 ml-2">
              {records.some((r) => r.dataQuality.isNull || r.dataQuality.isDuplicate) && (
                <span className="text-amber-400 ml-2 flex items-center gap-1 inline-flex">
                  <AlertTriangle className="w-4 h-4" />
                  检测到数据质量问题，分析时会自动标记
                </span>
              )}
            </span>
          </div>
          {isAnalyzed && (
            <StatusBadge type="success">已分析</StatusBadge>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <FileUploader />

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">样例数据说明</h3>
            <div className="space-y-3 text-sm text-slate-400">
              <p className="flex items-start gap-2">
                <span className="text-red-400 font-mono">85°C, 92°C</span>
                <span>极端高温值，用于验证极端值不被平均值掩盖</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-amber-400 font-mono">60°C</span>
                <span>边界值，恰好等于警告阈值</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-slate-500 font-mono">第7、12、23行</span>
                <span>包含空值，用于测试不完整数据处理</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-purple-400 font-mono">第15、16行</span>
                <span>重复记录，用于测试数据去重</span>
              </p>
            </div>
          </div>
        </div>

        <div>
          <DataPreview />
        </div>
      </div>
    </div>
  );
}
