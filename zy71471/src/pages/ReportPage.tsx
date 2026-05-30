import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useBatchStore } from '@/store/useBatchStore';
import { useExponentialFit } from '@/hooks/useExponentialFit';
import { formatTime, calculateTheoreticalTau } from '@/utils/units';
import { FitChart } from '@/components/charts/FitChart';
import { ResidualChart } from '@/components/charts/ResidualChart';
import { FileText, Download, Eye, Settings, FileDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const currentBatch = useBatchStore((state) => state.currentBatch);
  const samplePoints = useBatchStore((state) => state.samplePoints);
  const fitResult = useBatchStore((state) => state.fitResult);
  const fitMode = useBatchStore((state) => state.fitMode);
  const showOutliers = useBatchStore((state) => state.showOutliers);
  const historyRecords = useBatchStore((state) => state.historyRecords);
  const setCurrentBatch = useBatchStore((state) => state.setCurrentBatch);
  const updateBatchStatus = useBatchStore((state) => state.updateBatchStatus);
  const loading = useBatchStore((state) => state.loading);

  const [reportTitle, setReportTitle] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeResidual, setIncludeResidual] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) setCurrentBatch(id);
    return () => setCurrentBatch(null);
  }, [id, setCurrentBatch]);

  useEffect(() => {
    if (currentBatch) setReportTitle(`${currentBatch.batchNo} - RC电路充放电实验报告`);
  }, [currentBatch]);

  const { theoryCurve, statistics } = useExponentialFit(
    samplePoints,
    fitResult,
    fitMode,
    currentBatch?.timeUnit || 's'
  );

  const theoreticalTau = useMemo(() => {
    if (!currentBatch) return null;
    return calculateTheoreticalTau(
      currentBatch.resistance,
      currentBatch.resistanceUnit,
      currentBatch.capacitance,
      currentBatch.capacitanceUnit
    );
  }, [currentBatch]);

  const tauComparison = useMemo(() => {
    if (!fitResult || theoreticalTau === null) return null;
    const errorPercent = Math.abs((fitResult.tau - theoreticalTau) / theoreticalTau) * 100;
    return { errorPercent, withinTolerance: errorPercent < 10 };
  }, [fitResult, theoreticalTau]);

  const canGenerateReport = fitResult !== null && samplePoints.length >= 3;
  const formula = fitMode === 'discharge' ? 'V(t) = V₀e^(-t/τ)' : 'V(t) = Vs + (V₀ - Vs)e^(-t/τ)';

  const handleExport = async () => {
    if (!canGenerateReport) return;
    setIsExporting(true);
    setExportSuccess(false);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateBatchStatus('reported');
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!currentBatch) return null;

  const StatCard = ({ label, value }: { label: string; value: string }) => (
    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-lg font-semibold text-slate-800 dark:text-white">{value}</div>
    </div>
  );

  const renderReportContent = () => {
    if (!canGenerateReport) {
      return (
        <div className="py-16 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
          <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">无法生成报告</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">请先完成数据分析</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="text-center border-b border-slate-200 dark:border-slate-700 pb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{reportTitle}</h1>
          <div className="flex items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <span>学生: {currentBatch.studentName || '未填写'}</span>
            <span>日期: {currentBatch.experimentDate}</span>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">一、实验参数</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="电阻值" value={currentBatch.resistance !== null ? `${currentBatch.resistance} ${currentBatch.resistanceUnit}` : '-'} />
            <StatCard label="电容值" value={currentBatch.capacitance !== null ? `${currentBatch.capacitance} ${currentBatch.capacitanceUnit}` : '-'} />
            <StatCard label="初始电压 V₀" value={currentBatch.initialVoltage !== null ? `${currentBatch.initialVoltage} V` : '-'} />
            <StatCard label="电源电压 Vs" value={currentBatch.supplyVoltage !== null ? `${currentBatch.supplyVoltage} V` : '-'} />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">二、拟合结果</h2>
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
            <div className="font-mono text-center text-lg text-blue-700 dark:text-blue-300 mb-4">{formula}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">时间常数 τ</div>
                <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatTime(fitResult.tau, currentBatch.timeUnit)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">R²</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">{fitResult.rSquared.toFixed(4)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">RMSE</div>
                <div className="text-xl font-bold text-slate-800 dark:text-white">{fitResult.rootMeanSquaredError.toFixed(4)}</div>
              </div>
              {tauComparison && (
                <div className="text-center">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">相对误差</div>
                  <div className={cn('text-xl font-bold', tauComparison.withinTolerance ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                    {tauComparison.errorPercent.toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">三、拟合曲线</h2>
          <div className="h-[350px]">
            <FitChart points={samplePoints} theoryCurve={theoryCurve} fitMode={fitMode} showOutliers={showOutliers} timeUnit={currentBatch.timeUnit} confidenceInterval={fitResult.confidenceInterval} />
          </div>
        </div>

        {includeResidual && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">四、残差分析</h2>
            <div className="h-[250px]">
              <ResidualChart points={samplePoints} rmse={fitResult.rootMeanSquaredError} />
            </div>
          </div>
        )}

        {statistics && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">五、数据统计</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="采样点" value={statistics.numPoints.toString()} />
              <StatCard label="异常点" value={statistics.numOutliers.toString()} />
              <StatCard label="最大电压" value={`${statistics.maxVoltage.toFixed(2)}V`} />
              <StatCard label="最小电压" value={`${statistics.minVoltage.toFixed(2)}V`} />
            </div>
          </div>
        )}

        {includeHistory && historyRecords.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">六、修改历史</h2>
            <div className="space-y-2">
              {historyRecords.slice(0, 5).map((record) => (
                <div key={record.id} className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-white">{record.description}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{record.modifiedBy} · {dayjs(record.timestamp).format('MM-DD HH:mm')}</div>
                  </div>
                  <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', record.changeType === 'manual' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400')}>
                    v{record.version}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {reportNotes && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">备注</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{reportNotes}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-8 space-y-6">
        <div ref={reportRef} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
          {renderReportContent()}
        </div>
      </div>

      <div className="xl:col-span-4 space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-slate-500" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">报告设置</h3>
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">报告标题</label>
              <input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">备注</label>
              <textarea value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} rows={3} placeholder="添加报告备注..." className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none" />
            </div>
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">导出选项</label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={includeResidual} onChange={(e) => setIncludeResidual(e.target.checked)} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">包含残差图</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={includeHistory} onChange={(e) => setIncludeHistory(e.target.checked)} className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">包含历史记录</span>
              </label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <FileDown className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-400">格式: PDF</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">导出报告</h3>
          {!canGenerateReport && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">请先完成数据分析后再导出报告</p>
            </div>
          )}
          {exportSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400">报告导出成功！</p>
            </div>
          )}
          <div className="space-y-3">
            <button onClick={() => window.print()} disabled={!canGenerateReport || loading} className={cn('w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors', canGenerateReport ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed')}>
              <Eye className="w-4 h-4" />预览报告
            </button>
            <button onClick={handleExport} disabled={!canGenerateReport || isExporting || loading} className={cn('w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors', canGenerateReport ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed')}>
              <Download className={cn('w-4 h-4', isExporting && 'animate-spin')} />
              {isExporting ? '正在导出...' : '下载 PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
