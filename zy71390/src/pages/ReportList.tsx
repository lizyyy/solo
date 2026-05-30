import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Eye, Download } from 'lucide-react';
import { useStore } from '@/store';
import { TableSkeleton } from '@/components/Skeleton';
import type { ReportStatus } from '../../shared/types';
import { REPORT_STATUS_LABELS, REPORT_STATUS_COLORS } from '../../shared/types';

export default function ReportList() {
  const navigate = useNavigate();
  const reports = useStore((state) => state.reports);
  const fetchReports = useStore((state) => state.fetchReports);
  const exportReport = useStore((state) => state.exportReport);
  const loading = useStore((state) => state.loading.reports);
  const error = useStore((state) => state.error);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesSearch =
        report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.ruleName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [reports, searchQuery, statusFilter]);

  const handleExport = async (id: string, format: 'csv' | 'json', e: React.MouseEvent) => {
    e.stopPropagation();
    await exportReport(id, format);
  };

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索报告名称或规则..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReportStatus | 'all')}
              className="px-4 py-2.5 rounded-lg bg-dark border border-dark-200 text-white focus:outline-none focus:border-primary transition-colors"
            >
              <option value="all">全部状态</option>
              <option value="pending">{REPORT_STATUS_LABELS.pending}</option>
              <option value="running">{REPORT_STATUS_LABELS.running}</option>
              <option value="completed">{REPORT_STATUS_LABELS.completed}</option>
              <option value="failed">{REPORT_STATUS_LABELS.failed}</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={8} />
      ) : filteredReports.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">
            {searchQuery || statusFilter !== 'all'
              ? '没有找到匹配的报告'
              : '暂无报告数据'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    报告名称
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    规则
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    版本
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    时间范围
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    命中数
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-200">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-dark-100/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/reports/${report.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {report.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {report.ruleName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      v{report.ruleVersion}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {new Date(report.startTime).toLocaleDateString('zh-CN')} -{' '}
                      {new Date(report.endTime).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${REPORT_STATUS_COLORS[report.status]}20`,
                          color: REPORT_STATUS_COLORS[report.status],
                        }}
                      >
                        {REPORT_STATUS_LABELS[report.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {report.hitCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                      {new Date(report.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reports/${report.id}`);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-200 transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {report.status === 'completed' && (
                          <>
                            <button
                              onClick={(e) => handleExport(report.id, 'csv', e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-200 transition-colors"
                              title="导出 CSV"
                            >
                              <Download className="w-4 h-4" />
                              <span className="text-xs ml-1">CSV</span>
                            </button>
                            <button
                              onClick={(e) => handleExport(report.id, 'json', e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-200 transition-colors"
                              title="导出 JSON"
                            >
                              <Download className="w-4 h-4" />
                              <span className="text-xs ml-1">JSON</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
