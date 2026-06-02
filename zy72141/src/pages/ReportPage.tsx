import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Music, Clock, CheckCircle2, AlertTriangle, 
  XCircle, Download, Copy, Check, RefreshCw, FileJson,
  MessageSquare, StickyNote, AlertCircle
} from 'lucide-react';
import { WeekSelector } from '@/components/common/WeekSelector';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { useWeeklyReport } from '@/hooks/useWeeklyReport';
import { formatDateTimeShort } from '@/utils/dateUtils';

export default function ReportPage() {
  const navigate = useNavigate();
  const { currentRecordId, getCurrentWeekData } = useAppStore();
  const data = getCurrentWeekData();
  const { summary, anomalies, currentReport, generateReport, exportReport, exportReportAsJSON } = useWeeklyReport();
  
  const [reportContent, setReportContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (currentReport?.content) {
      setReportContent(currentReport.content);
      setGenerated(true);
    }
  }, [currentReport]);

  const handleGenerate = () => {
    const report = generateReport();
    if (report) {
      setReportContent(report.content);
      setGenerated(true);
    }
  };

  const handleCopy = async () => {
    if (!reportContent) return;
    
    try {
      await navigator.clipboard.writeText(reportContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败', err);
    }
  };

  const { record, conflicts, notes } = data;

  if (!currentRecordId || !record) {
    return (
      <div>
        <WeekSelector />
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-serif text-lg font-bold text-studio-text mb-2">
            先选一个周次吧
          </h3>
          <p className="text-sm text-studio-textMuted">
            或者先去导入页上传材料
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary mt-4"
          >
            去导入材料
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <WeekSelector />

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="曲目总数"
            value={summary.totalTracks}
            icon={Music}
            color="default"
            subtitle={`总时长 ${summary.totalDurationFormatted}`}
            className="stagger-1"
          />
          <StatCard
            title="已关联"
            value={summary.matchedTracks}
            icon={CheckCircle2}
            color="success"
            subtitle={`待关联 ${summary.unmatchedTracks}`}
            className="stagger-2"
          />
          <StatCard
            title="冲突"
            value={summary.conflicts}
            icon={AlertTriangle}
            color={summary.unresolvedConflicts > 0 ? 'warning' : 'success'}
            subtitle={`已处理 ${summary.resolvedConflicts}`}
            className="stagger-3"
          />
          <StatCard
            title="批注&备注"
            value={summary.annotations + summary.notes}
            icon={MessageSquare}
            color="amber"
            subtitle={`补录 ${summary.supplements} 条`}
            className="stagger-4"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-bold text-studio-text flex items-center gap-2">
                <FileText className="w-5 h-5 text-studio-amber" />
                周报内容
              </h2>
              <div className="flex gap-2">
                {!generated ? (
                  <button
                    onClick={handleGenerate}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    生成周报
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleGenerate}
                      className="btn-ghost flex items-center gap-1 text-sm"
                      title="重新生成"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCopy}
                      className="btn-secondary flex items-center gap-1 text-sm"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? '已复制' : '复制'}
                    </button>
                    <button
                      onClick={exportReport}
                      className="btn-primary flex items-center gap-1 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      导出TXT
                    </button>
                    <button
                      onClick={exportReportAsJSON}
                      className="btn-ghost flex items-center gap-1 text-sm"
                      title="导出完整数据"
                    >
                      <FileJson className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {generated && reportContent ? (
              <div className="relative">
                <div className="absolute -top-2 -left-2 w-8 h-8 bg-studio-amber rotate-3 opacity-20 rounded-sm" />
                <div className="absolute -top-1 -right-2 w-6 h-6 bg-studio-danger rotate-6 opacity-20 rounded-sm" />
                
                <div className="bg-studio-card border border-gray-200 rounded-lg p-6 font-sans whitespace-pre-wrap text-sm leading-relaxed text-studio-text min-h-[400px] max-h-[600px] overflow-y-auto scrollbar-thin">
                  {reportContent}
                </div>

                <div className="mt-3 p-3 bg-studio-amber/5 rounded-lg border border-studio-amber/20">
                  <p className="text-xs text-studio-amber flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    这是自动生成的初稿，你可以直接修改内容后导出
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-studio-textMuted">
                <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <p className="mb-2">点击「生成周报」按钮</p>
                <p className="text-sm">系统会自动汇总本周的材料、批注、异常和处理情况</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 className="font-serif font-bold text-studio-text mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-studio-warning" />
              异常明细
            </h3>
            
            {anomalies.length === 0 ? (
              <div className="text-center py-6 text-studio-textMuted text-sm">
                没有异常，一切正常 🎉
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
                {anomalies.map((anomaly, index) => (
                  <div 
                    key={index}
                    className={`
                      p-3 rounded-lg border text-sm animate-fade-in-up
                      stagger-${Math.min(index % 6 + 1, 6)}
                      ${anomaly.status === '待处理' ? 'bg-red-50 border-red-100' : ''}
                      ${anomaly.status === '有异常' ? 'bg-orange-50 border-orange-100' : ''}
                      ${anomaly.status === '导入失败' ? 'bg-red-50 border-red-100' : ''}
                      ${anomaly.status === '已处理' ? 'bg-green-50 border-green-100' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-medium text-studio-text text-xs">
                        {anomaly.trackName}
                      </span>
                      <StatusBadge 
                        status={
                          anomaly.status === '待处理' ? 'error' :
                          anomaly.status === '有异常' ? 'warning' :
                          anomaly.status === '导入失败' ? 'error' : 'success'
                        } 
                        text={anomaly.status}
                        size="sm"
                      />
                    </div>
                    <p className="text-xs text-studio-textMuted">
                      {anomaly.issue}
                    </p>
                    {anomaly.handler && (
                      <p className="text-xs text-studio-textMuted mt-1">
                        {anomaly.handler} 处理于 {anomaly.handledAt && formatDateTimeShort(anomaly.handledAt)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-xs text-studio-textMuted mt-3 pt-3 border-t border-gray-100">
              💡 汇总数字不会掩盖这些异常，每条都列出来了
            </p>
          </div>

          <div className="card">
            <h3 className="font-serif font-bold text-studio-text mb-3 flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-studio-amber" />
              补录备注
            </h3>
            
            {notes.filter(n => n.isSupplement).length === 0 ? (
              <div className="text-center py-4 text-studio-textMuted text-xs">
                暂无补录
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                {notes
                  .filter(n => n.isSupplement)
                  .map((note, index) => (
                    <div 
                      key={note.id}
                      className={`
                        p-2 bg-studio-amber/5 rounded border border-studio-amber/20 text-xs
                        animate-fade-in-up stagger-${Math.min(index % 6 + 1, 6)}
                      `}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-studio-amber">补录</span>
                        <span className="text-studio-textMuted">
                          {formatDateTimeShort(note.createdAt)}
                        </span>
                      </div>
                      <p className="text-studio-text">{note.content}</p>
                      <p className="text-studio-textMuted mt-1">—— {note.author}</p>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {currentReport && (
            <div className="card bg-studio-surface text-white">
              <h3 className="font-serif font-bold mb-2">生成时间</h3>
              <p className="text-sm text-white/70">
                {formatDateTimeShort(currentReport.generatedAt)}
              </p>
              <p className="text-xs text-white/50 mt-2">
                操作人：{record.operator}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/review')}
          className="btn-ghost"
        >
          ← 返回核对
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/history')}
            className="btn-secondary"
          >
            查看历史
          </button>
          <button
            onClick={handleGenerate}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            重新生成
          </button>
        </div>
      </div>
    </div>
  );
}
