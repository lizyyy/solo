import { useState, useMemo } from 'react';
import {
  FileText, FileSpreadsheet, FileJson, File, Download, Check, Eye, Loader2
} from 'lucide-react';
import { useSessionStore } from '@/store/sessionStore';
import { getRiskLevel } from '@/services/riskScoring';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json';
type ExportSection = 'summary' | 'anomalies' | 'rules' | 'materials';

export default function ReportExport() {
  const { currentSession, anomalyData, rules, scoreFormula } = useSessionStore();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [selectedSections, setSelectedSections] = useState<ExportSection[]>(['summary', 'anomalies', 'rules']);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const confirmedAnomalies = anomalyData.filter(
    (a) => a.reviewStatus === 'confirmed' || a.reviewStatus === 'pending'
  );
  const needsReviewAnomalies = anomalyData.filter((a) => a.reviewStatus === 'needs_review');
  const highRiskAnomalies = anomalyData.filter((a) => a.riskScore >= 70);

  const reportData = useMemo(() => {
    const avgScore = anomalyData.length > 0
      ? anomalyData.reduce((sum, a) => sum + a.riskScore, 0) / anomalyData.length
      : 0;
    const maxScore = anomalyData.length > 0
      ? Math.max(...anomalyData.map((a) => a.riskScore))
      : 0;
    const typeDistribution = anomalyData.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      generatedAt: new Date(),
      sessionName: currentSession?.sessionName || '未选择',
      totalAnomalies: anomalyData.length,
      confirmedCount: confirmedAnomalies.length,
      needsReviewCount: needsReviewAnomalies.length,
      highRiskCount: highRiskAnomalies.length,
      avgRiskScore: avgScore,
      maxRiskScore: maxScore,
      typeDistribution,
      topAnomalies: [...anomalyData].sort((a, b) => b.riskScore - a.riskScore).slice(0, 10),
    };
  }, [anomalyData, currentSession, confirmedAnomalies, needsReviewAnomalies, highRiskAnomalies]);

  const formatOptions = [
    { format: 'pdf' as ExportFormat, icon: FileText, label: 'PDF 报告', desc: '适合打印和存档', color: 'red' },
    { format: 'excel' as ExportFormat, icon: FileSpreadsheet, label: 'Excel 表格', desc: '适合数据分析', color: 'green' },
    { format: 'csv' as ExportFormat, icon: File, label: 'CSV 数据', desc: '适合数据迁移', color: 'blue' },
    { format: 'json' as ExportFormat, icon: FileJson, label: 'JSON 原始', desc: '适合程序处理', color: 'purple' },
  ];

  const sectionOptions = [
    { id: 'summary' as ExportSection, label: '会话摘要', desc: '包含统计数据和整体评分' },
    { id: 'anomalies' as ExportSection, label: '异常详情', desc: '所有异常事件列表和统计' },
    { id: 'rules' as ExportSection, label: '规则说明', desc: '检测规则和评分公式' },
    { id: 'materials' as ExportSection, label: '来源材料', desc: '关联材料索引和说明' },
  ];

  const toggleSection = (section: ExportSection) => {
    setSelectedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    const steps = [10, 30, 50, 70, 85, 100];
    for (const step of steps) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setExportProgress(step);
    }

    setTimeout(() => {
      setIsExporting(false);
    }, 1000);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      high_accel: '高加速度',
      high_jerk: '高加加速度',
      fps_drop: '帧率下降',
      pose_jump: '姿态突跳',
      player_reported: '玩家反馈',
    };
    return labels[type] || type;
  };

  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: 'text-red-400',
      green: 'text-green-400',
      blue: 'text-blue-400',
      purple: 'text-purple-400',
    };
    return colorMap[color] || 'text-white';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">报告导出</h1>
        <p className="text-dark-400 mt-1">生成并导出VR晕动症分析报告</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
            <h3 className="font-display font-semibold text-white mb-4">选择导出格式</h3>
            <div className="grid grid-cols-2 gap-3">
              {formatOptions.map((option) => (
                <button
                  key={option.format}
                  onClick={() => setSelectedFormat(option.format)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedFormat === option.format
                      ? 'border-primary-500 bg-primary-500/20'
                      : 'border-dark-500 bg-dark-600/50 hover:border-dark-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-dark-600">
                      <option.icon className={`w-5 h-5 ${getColorClass(option.color)}`} />
                    </div>
                    <div>
                      <div className="font-medium text-white">{option.label}</div>
                      <div className="text-xs text-dark-400">{option.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
            <h3 className="font-display font-semibold text-white mb-4">选择报告内容</h3>
            <div className="space-y-3">
              {sectionOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-dark-500 bg-dark-600/30 hover:bg-dark-600/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedSections.includes(option.id)}
                    onChange={() => toggleSection(option.id)}
                    className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-primary-500 focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-white">{option.label}</div>
                    <div className="text-xs text-dark-400">{option.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-white">报告预览</h3>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-400 hover:text-primary-300"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? '隐藏预览' : '显示预览'}
              </button>
            </div>

            {showPreview && (
              <div className="bg-dark-800 rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto">
                <div className="border-b border-dark-600 pb-3">
                  <h4 className="font-medium text-white">VR晕动症分析报告</h4>
                  <p className="text-xs text-dark-400">
                    生成时间: {format(reportData.generatedAt, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </p>
                  <p className="text-xs text-dark-400">
                    会话: {reportData.sessionName}
                  </p>
                </div>

                {selectedSections.includes('summary') && (
                  <div>
                    <h5 className="text-sm font-medium text-white mb-2">会话摘要</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-dark-400">异常总数</div>
                      <div className="text-white">{reportData.totalAnomalies}</div>
                      <div className="text-dark-400">已确认</div>
                      <div className="text-success-400">{reportData.confirmedCount}</div>
                      <div className="text-dark-400">待复核</div>
                      <div className="text-warning-400">{reportData.needsReviewCount}</div>
                      <div className="text-dark-400">高风险</div>
                      <div className="text-danger-400">{reportData.highRiskCount}</div>
                      <div className="text-dark-400">平均风险</div>
                      <div className="text-white">{reportData.avgRiskScore.toFixed(1)}</div>
                    </div>
                  </div>
                )}

                {selectedSections.includes('anomalies') && (
                  <div>
                    <h5 className="text-sm font-medium text-white mb-2">Top 高风险异常</h5>
                    <div className="space-y-2">
                      {reportData.topAnomalies.slice(0, 5).map((anomaly, idx) => (
                        <div key={anomaly.id} className="bg-dark-700/50 rounded p-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-white">#{idx + 1} {getTypeLabel(anomaly.type)}</span>
                            <span className={getRiskLevel(anomaly.riskScore).color}>
                              {anomaly.riskScore.toFixed(1)}分
                            </span>
                          </div>
                          <div className="text-dark-400 mt-1">
                            {format(anomaly.startTime, 'HH:mm:ss')} - {format(anomaly.endTime, 'HH:mm:ss')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSections.includes('rules') && (
                  <div>
                    <h5 className="text-sm font-medium text-white mb-2">检测规则</h5>
                    <div className="space-y-1 text-xs text-dark-300">
                      {rules.filter((r) => r.enabled).map((rule) => (
                        <div key={rule.id}>• {rule.name}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
            <h3 className="font-display font-semibold text-white mb-4">导出摘要</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">导出格式</span>
                <span className="text-white">
                  {formatOptions.find((f) => f.format === selectedFormat)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">包含章节</span>
                <span className="text-white">{selectedSections.length} 个</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">异常数量</span>
                <span className="text-white">{anomalyData.length} 条</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">预计大小</span>
                <span className="text-white">~{Math.round(anomalyData.length * 0.5)} KB</span>
              </div>
            </div>
          </div>

          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
            <h3 className="font-display font-semibold text-white mb-4">规则说明</h3>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-dark-600/50 rounded-lg">
                <div className="text-white font-medium mb-1">评分公式 v{scoreFormula.version}</div>
                <p className="text-dark-400">{scoreFormula.description}</p>
              </div>
              <div className="text-dark-400">
                {scoreFormula.explanation}
              </div>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting || selectedSections.length === 0}
            className="w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-400 text-white disabled:opacity-50 disabled:cursor-not-allowed btn-glow"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                导出中... {exportProgress}%
              </>
            ) : exportProgress === 100 ? (
              <>
                <Check className="w-5 h-5" />
                导出完成
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                导出报告
              </>
            )}
          </button>

          {isExporting && (
            <div className="w-full bg-dark-600 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
