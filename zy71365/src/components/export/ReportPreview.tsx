import { useMemo, useState } from 'react';
import { usePortfolioStore, useSelectedWorks } from '../../store/usePortfolioStore';
import { generateScreeningReport, generateHumanReadableSummary, generateStructuredData, generateCSV, exportReportAsText, exportReportAsJSON, exportReportAsCSV } from '../../utils/export';
import { FileText, FileJson, FileSpreadsheet, Download, Copy, Check, AlertCircle } from 'lucide-react';
import { getScoreColor, formatDateTime } from '../../lib/utils';

export default function ReportPreview() {
  const allWorks = usePortfolioStore(s => s.works);
  const selectedWorks = useSelectedWorks();
  const criteria = usePortfolioStore(s => s.filterCriteria);
  const score = usePortfolioStore(s => s.currentScore);
  const anomalies = usePortfolioStore(s => s.anomalies);
  const saveSession = usePortfolioStore(s => s.saveSession);
  const [sessionName, setSessionName] = useState('');
  const [sessionNote, setSessionNote] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const report = useMemo(() => {
    if (!score || selectedWorks.length === 0) return null;
    return generateScreeningReport(allWorks, selectedWorks, criteria, score, anomalies);
  }, [allWorks, selectedWorks, criteria, score, anomalies]);

  const humanSummary = useMemo(() => {
    if (!report) return '';
    return generateHumanReadableSummary(report, criteria);
  }, [report, criteria]);

  const structuredData = useMemo(() => {
    if (!report) return '';
    return generateStructuredData(report);
  }, [report]);

  const csvData = useMemo(() => {
    return generateCSV(selectedWorks);
  }, [selectedWorks]);

  const copyToClipboard = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleSaveSession = () => {
    if (!sessionName.trim() || !score) return;
    saveSession(sessionName.trim(), sessionNote.trim());
    setSaveSuccess(true);
    setSessionName('');
    setSessionNote('');
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  if (!score || selectedWorks.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-charcoal-700/50 flex items-center justify-center">
          <FileText className="w-8 h-8 text-cream-400/40" />
        </div>
        <h4 className="font-display text-lg font-semibold text-cream-200 mb-2">无法生成报告</h4>
        <p className="text-sm text-cream-400/60 max-w-xs mx-auto">
          请先在分析看板中选择作品，系统将自动为您生成筛选报告
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl font-semibold text-cream-200">筛选报告</h2>
            <p className="text-sm text-cream-400/60 mt-1">
              生成于 {formatDateTime(new Date().toISOString())}
            </p>
          </div>
          <div className={`text-right p-4 rounded-xl ${getScoreColor(score.overall).replace('text-', 'bg-')}/10 border ${getScoreColor(score.overall).replace('text-', 'border-')}/20`}>
            <div className={`text-3xl font-display font-bold ${getScoreColor(score.overall)}`}>
              {score.overall}
            </div>
            <div className="text-xs text-cream-400/60 mt-1">综合评分</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-charcoal-700/30 border border-white/5">
            <div className="text-2xl font-display font-semibold text-cream-200">{allWorks.length}</div>
            <div className="text-xs text-cream-400/60">作品总数</div>
          </div>
          <div className="p-4 rounded-lg bg-charcoal-700/30 border border-white/5">
            <div className="text-2xl font-display font-semibold text-ochre-400">{selectedWorks.length}</div>
            <div className="text-xs text-cream-400/60">入选作品</div>
          </div>
          <div className="p-4 rounded-lg bg-charcoal-700/30 border border-white/5">
            <div className="text-2xl font-display font-semibold text-moss-500">
              {selectedWorks.filter(w => w.copyright.hasClearance).length}
            </div>
            <div className="text-xs text-cream-400/60">版权合规</div>
          </div>
          <div className={`p-4 rounded-lg border ${anomalies.length > 0 ? 'bg-terracotta-500/10 border-terracotta-500/20' : 'bg-moss-500/10 border-moss-500/20'}`}>
            <div className={`text-2xl font-display font-semibold ${anomalies.length > 0 ? 'text-terracotta-500' : 'text-moss-500'}`}>
              {anomalies.length}
            </div>
            <div className="text-xs text-cream-400/60">异常项</div>
          </div>
        </div>

        {anomalies.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-terracotta-500/10 border border-terracotta-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-terracotta-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-terracotta-400">存在 {anomalies.length} 项异常需处理</p>
              <p className="text-xs text-cream-400/70 mt-0.5">
                {anomalies.map(a => a.description).join('；')}
              </p>
            </div>
          </div>
        )}

        <div className="p-4 rounded-lg bg-ochre-500/5 border border-ochre-500/10">
          <p className="text-sm font-medium text-ochre-400 mb-1">评估建议</p>
          <p className="text-sm text-cream-300/90 leading-relaxed">{report?.summary.recommendation}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-ochre-400" />
              <h3 className="font-display text-base font-semibold text-cream-200">人类可读摘要</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(humanSummary, 'text')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-charcoal-700/50 hover:bg-charcoal-600/50 text-cream-300 transition-colors"
              >
                {copiedType === 'text' ? <Check className="w-3.5 h-3.5 text-moss-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'text' ? '已复制' : '复制'}
              </button>
              <button
                onClick={() => report && exportReportAsText(report, criteria)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-ochre-500/20 hover:bg-ochre-500/30 text-ochre-400 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                导出TXT
              </button>
            </div>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            <pre className="text-xs text-cream-300/90 whitespace-pre-wrap font-mono leading-relaxed">
              {humanSummary}
            </pre>
          </div>
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-moss-500" />
              <h3 className="font-display text-base font-semibold text-cream-200">结构化明细 (JSON)</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(structuredData, 'json')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-charcoal-700/50 hover:bg-charcoal-600/50 text-cream-300 transition-colors"
              >
                {copiedType === 'json' ? <Check className="w-3.5 h-3.5 text-moss-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedType === 'json' ? '已复制' : '复制'}
              </button>
              <button
                onClick={() => report && exportReportAsJSON(report)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-moss-500/20 hover:bg-moss-500/30 text-moss-400 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                导出JSON
              </button>
            </div>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            <pre className="text-xs text-cream-300/90 whitespace-pre-wrap font-mono leading-relaxed">
              {structuredData}
            </pre>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-slateblue-400" />
            <h3 className="font-display text-base font-semibold text-cream-200">作品明细表 (CSV)</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(csvData, 'csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-charcoal-700/50 hover:bg-charcoal-600/50 text-cream-300 transition-colors"
            >
              {copiedType === 'csv' ? <Check className="w-3.5 h-3.5 text-moss-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedType === 'csv' ? '已复制' : '复制'}
            </button>
            <button
              onClick={() => exportReportAsCSV(selectedWorks)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slateblue-500/20 hover:bg-slateblue-500/30 text-slateblue-400 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              导出CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-charcoal-700/80 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-cream-400/80">ID</th>
                <th className="px-4 py-3 text-left font-medium text-cream-400/80">标题</th>
                <th className="px-4 py-3 text-left font-medium text-cream-400/80">学生</th>
                <th className="px-4 py-3 text-left font-medium text-cream-400/80">主题</th>
                <th className="px-4 py-3 text-left font-medium text-cream-400/80">媒介</th>
                <th className="px-4 py-3 text-center font-medium text-cream-400/80">完成度</th>
                <th className="px-4 py-3 text-center font-medium text-cream-400/80">版权</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {selectedWorks.map((work, i) => (
                <tr key={work.id} className="hover:bg-charcoal-700/30">
                  <td className="px-4 py-3 text-cream-400/60 font-mono">{work.id}</td>
                  <td className="px-4 py-3 text-cream-200 font-medium">{work.title}</td>
                  <td className="px-4 py-3 text-cream-300">{work.studentName}</td>
                  <td className="px-4 py-3 text-cream-300/80">{work.tags.join('、')}</td>
                  <td className="px-4 py-3 text-cream-300/80">{work.mediums.join('、')}</td>
                  <td className="px-4 py-3 text-center text-cream-300">{work.completion} ★</td>
                  <td className="px-4 py-3 text-center">
                    <span className={work.copyright.hasClearance ? 'text-moss-500' : 'text-terracotta-500'}>
                      {work.copyright.hasClearance ? '✓' : '✗'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold text-cream-200 mb-4">保存到历史记录</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-cream-400/80 uppercase tracking-wider mb-1.5 block">
              会话名称
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="例如：视觉传达方向-初选方案"
              className="w-full px-4 py-2.5 rounded-lg bg-charcoal-700/50 border border-white/10 text-cream-200 placeholder-cream-400/40 focus:outline-none focus:border-ochre-500/50 transition-colors text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-cream-400/80 uppercase tracking-wider mb-1.5 block">
              备注（可选）
            </label>
            <input
              type="text"
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="用于同事交接的说明..."
              className="w-full px-4 py-2.5 rounded-lg bg-charcoal-700/50 border border-white/10 text-cream-200 placeholder-cream-400/40 focus:outline-none focus:border-ochre-500/50 transition-colors text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleSaveSession}
          disabled={!sessionName.trim()}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saveSuccess ? (
            <>
              <Check className="w-4 h-4" />
              已保存到历史记录
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              保存本次筛选
            </>
          )}
        </button>
      </div>
    </div>
  );
}
