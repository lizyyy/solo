import InputForm from '../components/InputForm';
import ResultCard from '../components/ResultCard';
import EvidenceTimeline from '../components/EvidenceTimeline';
import CalculationSteps from '../components/CalculationSteps';
import { useAppStore } from '../store/appStore';
import { downloadReport } from '../utils/export';
import { FileText, AlertCircle, Calculator as CalculatorIcon, RotateCcw, History, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function Calculator() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { currentResult, error, clearError, records, loadRecord, recalculateRecord, resetInput, currentRecordId } = useAppStore();
  const [recentRecords, setRecentRecords] = useState(records.slice(0, 5));
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    if (id) {
      loadRecord(id);
    }
  }, [id, loadRecord]);

  useEffect(() => {
    setRecentRecords(records.slice(0, 5));
  }, [records]);

  const handleDownloadReport = () => {
    if (records.length > 0) {
      const record = currentRecordId 
        ? records.find(r => r.id === currentRecordId) 
        : records[0];
      if (record) {
        downloadReport(record);
      }
    }
  };

  const handleRecalculate = async () => {
    if (currentRecordId) {
      setIsRecalculating(true);
      try {
        await recalculateRecord(currentRecordId);
      } finally {
        setIsRecalculating(false);
      }
    }
  };

  const handleLoadRecord = (recordId: string) => {
    navigate(`/calculator/${recordId}`);
  };

  const handleNewCalculation = () => {
    resetInput();
    navigate('/calculator');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 flex-1">{error}</p>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              关闭
            </button>
          </div>
        )}

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <CalculatorIcon className="w-8 h-8 text-blue-400" />
              校准计算中心
            </h1>
            <p className="text-slate-400">
              执行声速校准计算，支持历史记录复算和多维度验证
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleNewCalculation}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all"
            >
              <Zap className="w-4 h-4" />
              新建计算
            </button>
            {currentRecordId && (
              <button
                onClick={handleRecalculate}
                disabled={isRecalculating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
              >
                {isRecalculating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                {isRecalculating ? '复算中...' : '复算验证'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <InputForm />
            
            {currentResult && (
              <>
                <ResultCard />
                <EvidenceTimeline />
                <CalculationSteps />
              </>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                最近记录
              </h3>
              {recentRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无历史记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentRecords.map((record) => (
                    <button
                      key={record.id}
                      onClick={() => handleLoadRecord(record.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        currentRecordId === record.id
                          ? 'bg-blue-600/20 border border-blue-500/30'
                          : 'bg-slate-700/30 border border-transparent hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-mono text-slate-400">
                          #{record.id.slice(0, 8)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          record.result.conclusion === 'consistent'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : record.result.conclusion === 'inconsistent'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {record.result.conclusion === 'consistent' ? '一致' : 
                           record.result.conclusion === 'inconsistent' ? '不一致' : '警告'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        温度: {record.input.temperature !== null ? `${record.input.temperature}℃` : '缺失'}
                        {' | '}
                        偏差: {Number.isNaN(record.result.deviationPercent) ? '--' : `${record.result.deviationPercent.toFixed(2)}%`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentResult && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4">导出选项</h3>
                <div className="space-y-3">
                  <button
                    onClick={handleDownloadReport}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all"
                  >
                    <FileText className="w-5 h-5" />
                    导出完整证据报告
                  </button>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-6 border border-blue-500/20">
              <h3 className="text-lg font-bold text-white mb-3">可复算性保证</h3>
              <div className="space-y-2 text-sm text-slate-400">
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">✓</span>
                  <span>相同输入参数永远产生相同结果</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">✓</span>
                  <span>输入哈希校验确保数据完整性</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">✓</span>
                  <span>完整计算步骤可追溯</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">✓</span>
                  <span>复算结果与原始结果自动对比</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
