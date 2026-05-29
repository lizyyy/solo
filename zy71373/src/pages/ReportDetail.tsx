import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Calendar, User, AlertTriangle,
  ChevronDown, ChevronRight, Download, FileSpreadsheet,
  CheckCircle, Clock, FileCheck, ListTodo
} from 'lucide-react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent, CardFooter } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { RiskBadge } from '../components/RiskBadge';
import { Button } from '../components/Button';
import { AuditTraceTimeline } from '../components/AuditTraceTimeline';
import type { AuditReport, AuditRisk, TodoItem } from '../types';

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadReport, exportReport, todos, loadTodos } = useStore();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [reportData] = await Promise.all([
          loadReport(id),
          loadTodos()
        ]);
        setReport(reportData);
      } catch (error) {
        console.error('Failed to load report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, loadReport, loadTodos]);

  const relatedTodos = useMemo(() => {
    if (!id) return [];
    return todos.filter(todo => todo.relatedAuditReportId === id);
  }, [todos, id]);

  const riskStats = useMemo(() => {
    if (!report) return { high: 0, medium: 0, low: 0, pending: 0 };
    return report.risks.reduce((acc, risk) => {
      acc[risk.level]++;
      return acc;
    }, { high: 0, medium: 0, low: 0, pending: 0 });
  }, [report]);

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!id) return;
    try {
      setExporting(format);
      const blob = await exportReport(id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(null);
    }
  };

  const getRiskTypeLabel = (type: AuditRisk['type']) => {
    const labels: Record<AuditRisk['type'], string> = {
      expired: '授权过期',
      channel_out_of_scope: '渠道超范围',
      font_renamed: '字体重命名',
      missing_license: '缺少授权',
      pending_info: '待补资料'
    };
    return labels[type];
  };

  const getTodoTypeIcon = (type: TodoItem['type']) => {
    switch (type) {
      case 'missing_license': return <FileCheck className="w-4 h-4" />;
      case 'pending_confirmation': return <Clock className="w-4 h-4" />;
      case 'expiring_license': return <AlertTriangle className="w-4 h-4" />;
      default: return <ListTodo className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F2B4A' }}>
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-cyan-400" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-400">加载报告详情中...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F2B4A' }}>
        <Card className="max-w-md w-full">
          <CardContent className="py-16 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-white mb-2">报告不存在</h3>
            <p className="text-slate-400 mb-6">未找到指定的审计报告，请返回列表重试</p>
            <Button onClick={() => navigate('/reports')}>
              <ArrowLeft className="w-4 h-4" />
              返回列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0F2B4A' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回报告列表
          </button>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">{report.projectName}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  {report.clientName}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {report.createDate}
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  {report.auditor}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RiskBadge level={report.overallRisk} />
              <StatusBadge status={report.status} />
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-white">风险概览</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/30 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-500 mb-2">整体风险</p>
                <RiskBadge level={report.overallRisk} />
              </div>
              <div className="bg-slate-900/30 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-500 mb-2">高风险</p>
                <span className="text-2xl font-bold text-[#E53935]">{riskStats.high}</span>
              </div>
              <div className="bg-slate-900/30 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-500 mb-2">中风险</p>
                <span className="text-2xl font-bold text-[#FB8C00]">{riskStats.medium}</span>
              </div>
              <div className="bg-slate-900/30 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-500 mb-2">低风险</p>
                <span className="text-2xl font-bold text-[#43A047]">{riskStats.low}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-white">审计结论</h2>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 leading-relaxed">{report.conclusion}</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <FileSpreadsheet className="w-4 h-4" />
              <span>样例文件：{report.sampleFileName}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-white">风险详情</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.risks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[#43A047]" />
                <p className="text-slate-400">未发现风险项</p>
              </div>
            ) : (
              report.risks.map((risk) => {
                const isExpanded = expandedRisk === risk.id;
                return (
                  <div key={risk.id} className="border border-slate-700/50 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedRisk(isExpanded ? null : risk.id)}
                      className="w-full flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <RiskBadge level={risk.level} size="sm" />
                        <span className="text-sm font-medium text-slate-300">{getRiskTypeLabel(risk.type)}</span>
                        <span className="text-sm text-slate-500">·</span>
                        <span className="text-sm text-cyan-400">{risk.fontName}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="p-4 bg-slate-900/30 border-t border-slate-700/50 space-y-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">风险描述</p>
                          <p className="text-sm text-slate-300">{risk.description}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-cyan-400 mb-1">整改建议</p>
                          <p className="text-sm text-slate-300">{risk.suggestion}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-white">审计链路追溯</h2>
          </CardHeader>
          <CardContent>
            <AuditTraceTimeline steps={report.steps} />
          </CardContent>
        </Card>

        {relatedTodos.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-cyan-400" />
                关联待办事项
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {relatedTodos.map((todo) => (
                <div key={todo.id} className="flex items-start gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    todo.status === 'completed' ? 'bg-[rgba(67,160,71,0.15)] text-[#43A047]' : 'bg-[rgba(251,140,0,0.15)] text-[#FB8C00]'
                  }`}>
                    {getTodoTypeIcon(todo.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <h3 className="font-medium text-white truncate">{todo.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                        todo.status === 'completed'
                          ? 'bg-[rgba(67,160,71,0.15)] text-[#43A047]'
                          : 'bg-[rgba(251,140,0,0.15)] text-[#FB8C00]'
                      }`}>
                        {todo.status === 'completed' ? '已完成' : '待处理'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-2 mb-2">{todo.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {todo.assignee}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        截止：{todo.dueDate}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardFooter className="flex flex-col sm:flex-row justify-end gap-3">
            <Button variant="secondary" onClick={() => navigate('/reports')}>
              <ArrowLeft className="w-4 h-4" />
              返回列表
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleExport('pdf')}
              loading={exporting === 'pdf'}
              disabled={exporting !== null}
            >
              <Download className="w-4 h-4" />
              导出 PDF
            </Button>
            <Button
              variant="primary"
              onClick={() => handleExport('excel')}
              loading={exporting === 'excel'}
              disabled={exporting !== null}
            >
              <FileSpreadsheet className="w-4 h-4" />
              导出 Excel
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
