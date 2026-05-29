import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, FileText, Calendar, User, AlertTriangle,
  Eye, Download, Filter, ChevronDown, FileSpreadsheet
} from 'lucide-react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent, CardFooter } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { RiskBadge } from '../components/RiskBadge';
import { Button } from '../components/Button';
import type { AuditReport, RiskLevel } from '../types';

export default function Reports() {
  const navigate = useNavigate();
  const { reports, loadReports, exportReport } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesSearch =
        report.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.auditor.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRisk = riskFilter === 'all' || report.overallRisk === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [reports, searchQuery, riskFilter]);

  const handleViewDetail = (id: string) => {
    navigate(`/reports/${id}`);
  };

  const handleExport = async (id: string, format: 'pdf' | 'excel') => {
    try {
      setExportingId(id);
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
      setExportingId(null);
    }
  };

  const riskOptions: { value: RiskLevel | 'all'; label: string }[] = [
    { value: 'all', label: '全部风险' },
    { value: 'high', label: '高风险' },
    { value: 'medium', label: '中风险' },
    { value: 'low', label: '低风险' },
    { value: 'pending', label: '待确认' }
  ];

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0F2B4A' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">审计报告列表</h1>
          <p className="text-slate-400">查看和管理所有字体合规审计报告</p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索项目名称、客户名称或审计员..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
                />
              </div>
              <div className="relative">
                <Button
                  variant="secondary"
                  onClick={() => setFilterOpen(!filterOpen)}
                  className="w-full md:w-auto justify-between min-w-[140px]"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>{riskOptions.find(o => o.value === riskFilter)?.label}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                </Button>
                {filterOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                    {riskOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setRiskFilter(option.value);
                          setFilterOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          riskFilter === option.value
                            ? 'bg-cyan-500/10 text-cyan-400'
                            : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredReports.map((report: AuditReport) => (
            <Card key={report.id} hover>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                      <FileText className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">
                        {report.projectName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          {report.clientName}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          {report.auditor}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {report.createDate}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RiskBadge level={report.overallRisk} />
                    <StatusBadge status={report.status} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-900/30 rounded-xl p-4">
                    <p className="text-sm text-slate-500 mb-1">整体风险等级</p>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={report.overallRisk} size="sm" />
                    </div>
                  </div>
                  <div className="bg-slate-900/30 rounded-xl p-4">
                    <p className="text-sm text-slate-500 mb-1">风险项数量</p>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      <span className="text-xl font-bold text-white">{report.risks.length}</span>
                      <span className="text-sm text-slate-400">项</span>
                    </div>
                  </div>
                  <div className="bg-slate-900/30 rounded-xl p-4">
                    <p className="text-sm text-slate-500 mb-1">样例文件</p>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                      <span className="text-sm text-slate-300 truncate" title={report.sampleFileName}>
                        {report.sampleFileName}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-400 line-clamp-2">
                  {report.conclusion}
                </p>
              </CardContent>
              <CardFooter className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleViewDetail(report.id)}
                >
                  <Eye className="w-4 h-4" />
                  查看详情
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport(report.id, 'pdf')}
                  loading={exportingId === report.id}
                  disabled={exportingId !== null}
                >
                  <Download className="w-4 h-4" />
                  导出 PDF
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleExport(report.id, 'excel')}
                  loading={exportingId === report.id}
                  disabled={exportingId !== null}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  导出 Excel
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {filteredReports.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h3 className="text-xl font-semibold text-white mb-2">暂无审计报告</h3>
              <p className="text-slate-400">
                {searchQuery || riskFilter !== 'all'
                  ? '没有找到符合搜索条件的报告，请尝试调整筛选条件'
                  : '还没有生成任何审计报告'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
