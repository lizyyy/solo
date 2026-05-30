import { useState, useRef, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { Download, Camera, FileJson, FileText, CheckCircle, Loader2, AlertTriangle, Image, FileArchive } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';

export default function ExportPage() {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const filters = useAppStore((state) => state.filters);
  const loans = useAppStore((state) => state.loans);
  const anomalies = useAppStore((state) => state.anomalies);
  const reports = useAppStore((state) => state.reports);
  const auditLogs = useAppStore((state) => state.auditLogs);
  const snapshots = useAppStore((state) => state.snapshots);
  const industryTags = useAppStore((state) => state.industryTags);
  const maturityBuckets = useAppStore((state) => state.maturityBuckets);
  const riskRatings = useAppStore((state) => state.riskRatings);
  const getFilteredLoans = useAppStore((state) => state.getFilteredLoans);

  const [exportOptions, setExportOptions] = useState({
    screenshot: true,
    filters: true,
    anomalies: true,
    data: false,
    auditLog: false,
    format: 'zip' as 'zip' | 'pdf',
  });

  const filteredLoans = useMemo(() => {
    return getFilteredLoans();
  }, [loans, filters, getFilteredLoans]);

  const unresolvedAnomalies = useMemo(() => {
    return anomalies.filter((a) => !a.resolved);
  }, [anomalies]);

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    setExportResult(null);

    try {
      const exportData: Record<string, any> = {
        exportTime: new Date().toISOString(),
        exportedBy: '风控分析师',
      };

      setExportProgress(10);

      if (exportOptions.screenshot && previewRef.current) {
        const canvas = await html2canvas(previewRef.current, {
          backgroundColor: '#0F172A',
          scale: 2,
          logging: false,
        });
        exportData.screenshot = canvas.toDataURL('image/png');
        setExportProgress(40);
      }

      if (exportOptions.filters) {
        exportData.filters = {
          ...filters,
          industryNames: filters.industries.map(
            (c) => industryTags.find((i) => i.code === c)?.name || c
          ),
          maturityNames: filters.maturityBuckets.map(
            (c) => maturityBuckets.find((m) => m.code === c)?.name || c
          ),
          riskNames: filters.riskRatings.map(
            (c) => riskRatings.find((r) => r.code === c)?.name || c
          ),
        };
        setExportProgress(60);
      }

      if (exportOptions.anomalies) {
        exportData.anomalies = unresolvedAnomalies.map((a) => {
          const loan = loans.find((l) => l.id === a.loanId);
          return {
            ...a,
            customerName: loan?.customerName,
            loanNo: loan?.loanNo,
            industryName: industryTags.find((i) => i.code === loan?.industryCode)?.name,
          };
        });
        setExportProgress(80);
      }

      if (exportOptions.data) {
        exportData.loans = filteredLoans.map((loan) => {
          const report = reports.find((r) => r.loanId === loan.id);
          const loanAnomalies = anomalies.filter((a) => a.loanId === loan.id);
          return {
            ...loan,
            industryName: industryTags.find((i) => i.code === loan.industryCode)?.name,
            maturityName: maturityBuckets.find((m) => m.code === loan.maturityBucketCode)?.name,
            riskReport: report,
            anomalies: loanAnomalies,
          };
        });
      }

      if (exportOptions.auditLog) {
        exportData.auditLogs = auditLogs.slice(-100);
      }

      exportData.summary = {
        totalLoans: filteredLoans.length,
        totalPrincipal: filteredLoans.reduce((sum, l) => sum + l.principal, 0),
        anomalyCount: unresolvedAnomalies.length,
        reportCount: reports.filter((r) => filteredLoans.some((l) => l.id === r.loanId)).length,
      };

      setExportProgress(90);

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `风险报告_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      if (exportOptions.screenshot && previewRef.current) {
        const canvas = await html2canvas(previewRef.current, {
          backgroundColor: '#0F172A',
          scale: 2,
        });
        const imgUrl = canvas.toDataURL('image/png');
        const imgA = document.createElement('a');
        imgA.href = imgUrl;
        imgA.download = `风险地形截图_${new Date().toISOString().slice(0, 10)}.png`;
        imgA.click();
      }

      setExportProgress(100);
      setExportResult('success');
    } catch (error) {
      console.error('Export failed:', error);
      setExportResult('error');
    } finally {
      setTimeout(() => {
        setExporting(false);
        setExportProgress(0);
      }, 1500);
    }
  };

  const toggleOption = (key: keyof typeof exportOptions) => {
    setExportOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 border-r border-slate-700/50 bg-slate-800/30 p-6 overflow-y-auto">
          <h1 className="text-xl font-bold text-white mb-2">报告导出中心</h1>
          <p className="text-sm text-slate-400 mb-6">
            一键打包导出3D截图、筛选条件、异常说明、审计日志
          </p>

          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-sm font-medium text-slate-200 mb-3">导出内容</h3>
              <div className="space-y-2">
                <ExportOption
                  icon={<Camera className="w-4 h-4" />}
                  label="3D地形截图"
                  description="当前视角的高清截图"
                  checked={exportOptions.screenshot}
                  onChange={() => toggleOption('screenshot')}
                />
                <ExportOption
                  icon={<FileJson className="w-4 h-4" />}
                  label="筛选条件"
                  description="当前应用的所有筛选条件"
                  checked={exportOptions.filters}
                  onChange={() => toggleOption('filters')}
                />
                <ExportOption
                  icon={<AlertTriangle className="w-4 h-4" />}
                  label="异常说明"
                  description="未解决的异常标记列表"
                  checked={exportOptions.anomalies}
                  onChange={() => toggleOption('anomalies')}
                />
                <ExportOption
                  icon={<FileText className="w-4 h-4" />}
                  label="贷款明细数据"
                  description="筛选后的贷款详细数据"
                  checked={exportOptions.data}
                  onChange={() => toggleOption('data')}
                />
                <ExportOption
                  icon={<FileText className="w-4 h-4" />}
                  label="审计日志"
                  description="最近100条数据变更记录"
                  checked={exportOptions.auditLog}
                  onChange={() => toggleOption('auditLog')}
                />
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-sm font-medium text-slate-200 mb-3">导出格式</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportOptions((prev) => ({ ...prev, format: 'zip' }))}
                  className={cn(
                    'flex-1 p-3 rounded-lg border text-sm transition-all flex flex-col items-center gap-1',
                    exportOptions.format === 'zip'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-700/30 border-slate-600/50 text-slate-400 hover:border-slate-500'
                  )}
                >
                  <FileArchive className="w-5 h-5" />
                  ZIP压缩包
                </button>
                <button
                  onClick={() => setExportOptions((prev) => ({ ...prev, format: 'pdf' }))}
                  className={cn(
                    'flex-1 p-3 rounded-lg border text-sm transition-all flex flex-col items-center gap-1',
                    exportOptions.format === 'pdf'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-700/30 border-slate-600/50 text-slate-400 hover:border-slate-500'
                  )}
                >
                  <FileText className="w-5 h-5" />
                  PDF报告
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-sm font-medium text-slate-200 mb-3">导出摘要</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">贷款笔数</span>
                  <span className="text-white font-mono">{filteredLoans.length}笔</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">敞口总额</span>
                  <span className="text-cyan-400 font-mono">
                    {(filteredLoans.reduce((sum, l) => sum + l.principal, 0) / 100000000).toFixed(2)}亿
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">待处理异常</span>
                  <span className="text-amber-400 font-mono">{unresolvedAnomalies.length}个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">历史快照</span>
                  <span className="text-slate-300 font-mono">{snapshots.length}个</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className={cn(
                'w-full py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                exportResult === 'success'
                  ? 'bg-green-600 text-white'
                  : exportResult === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20'
              )}
            >
              {exporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  导出中 {exportProgress}%
                </>
              ) : exportResult === 'success' ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  导出成功
                </>
              ) : exportResult === 'error' ? (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  导出失败，请重试
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  一键导出报告包
                </>
              )}
            </button>

            {exporting && (
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Image className="w-5 h-5 text-cyan-400" />
              导出预览
            </h2>

            <div
              ref={previewRef}
              className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-800 to-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">贷款组合风险分析报告</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      生成时间: {new Date().toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-cyan-400 font-mono">
                      {(filteredLoans.reduce((sum, l) => sum + l.principal, 0) / 100000000).toFixed(2)}亿
                    </div>
                    <div className="text-xs text-slate-400">监控敞口</div>
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-3 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-1">贷款笔数</div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {filteredLoans.length}
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-1">风险等级</div>
                  <div className="text-2xl font-bold text-amber-400 font-mono">
                    {(() => {
                      const avgRisk = filteredLoans.reduce((sum, l) => sum + (riskRatings.find(rr => rr.code === l.riskRatingCode)?.riskLevel || 5), 0) / Math.max(1, filteredLoans.length);
                      const roundedLevel = Math.round(avgRisk);
                      const riskRating = riskRatings.find((r) => r.riskLevel === roundedLevel);
                      return riskRating?.name || (avgRisk > 7 ? '高风险' : '中风险');
                    })()}
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-1">待处理异常</div>
                  <div className={`text-2xl font-bold font-mono ${unresolvedAnomalies.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {unresolvedAnomalies.length}
                  </div>
                </div>
              </div>

              {exportOptions.filters && (
                <div className="p-6 border-t border-slate-700/50">
                  <h4 className="text-sm font-medium text-slate-200 mb-3">当前筛选条件</h4>
                  <div className="flex flex-wrap gap-2">
                    {filters.industries.length > 0 && (
                      <FilterBadge
                        label="行业"
                        values={filters.industries.map(
                          (c) => industryTags.find((i) => i.code === c)?.name || c
                        )}
                      />
                    )}
                    {filters.maturityBuckets.length > 0 && (
                      <FilterBadge
                        label="期限"
                        values={filters.maturityBuckets.map(
                          (c) => maturityBuckets.find((m) => m.code === c)?.name || c
                        )}
                      />
                    )}
                    {filters.riskRatings.length > 0 && (
                      <FilterBadge
                        label="风险等级"
                        values={filters.riskRatings}
                      />
                    )}
                    {filters.hasAnomaly !== null && (
                      <div className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs rounded-lg">
                        异常: {filters.hasAnomaly ? '有' : '无'}
                      </div>
                    )}
                    {filters.industries.length === 0 &&
                      filters.maturityBuckets.length === 0 &&
                      filters.riskRatings.length === 0 &&
                      filters.hasAnomaly === null && (
                        <span className="text-sm text-slate-500">未应用筛选条件</span>
                      )}
                  </div>
                </div>
              )}

              {exportOptions.anomalies && unresolvedAnomalies.length > 0 && (
                <div className="p-6 border-t border-slate-700/50">
                  <h4 className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    异常说明列表
                  </h4>
                  <div className="space-y-2">
                    {unresolvedAnomalies.slice(0, 5).map((anomaly) => {
                      const loan = loans.find((l) => l.id === anomaly.loanId);
                      return (
                        <div
                          key={anomaly.id}
                          className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-amber-400">
                              {loan?.customerName} ({loan?.loanNo})
                            </span>
                            <span className="text-xs text-slate-400">
                              严重程度: {anomaly.severity === 3 ? '高' : anomaly.severity === 2 ? '中' : '低'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{anomaly.description}</p>
                        </div>
                      );
                    })}
                    {unresolvedAnomalies.length > 5 && (
                      <div className="text-xs text-slate-400 text-center py-2">
                        ... 还有 {unresolvedAnomalies.length - 5} 条异常记录
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 border-t border-slate-700/50 bg-slate-900/30 text-center text-xs text-slate-500">
                本报告由贷款组合风险地形系统自动生成 · 风险地形分析工具
              </div>
            </div>

            <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <div className="text-xs text-slate-400 leading-relaxed">
                <strong className="text-slate-300">导出说明：</strong>
                导出的报告包包含当前3D地形视角截图（分辨率2x）、筛选条件JSON、异常标记列表、贷款明细数据（可选）和审计日志（可选）。
                所有数据均保留异常标记，便于后续复核。建议每周定期导出备份，或在重大风险结论确定后导出归档。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportOption({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-700/30 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-700"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          {icon}
          {label}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
    </label>
  );
}

function FilterBadge({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-lg">
      <span className="text-cyan-300 font-medium">{label}:</span>{' '}
      {values.length <= 2 ? values.join(', ') : `${values[0]} +${values.length - 1}`}
    </div>
  );
}
