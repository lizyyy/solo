import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { useDepositStore } from '../store/useDepositStore';
import StatusBadge from '../components/StatusBadge';
import { DepositStatus } from '../types';

export default function RecordList() {
  const navigate = useNavigate();
  const { records } = useDepositStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DepositStatus | 'all'>('all');

  const stats = useMemo(() => {
    const pending = records.filter(
      (r) =>
        r.status === 'waiting_settlement' ||
        r.status === 'settlement_attached' ||
        r.status === 'pending_review' ||
        r.status === 'pending_recheck'
    ).length;
    const completed = records.filter((r) => r.status === 'completed').length;
    const abnormal = records.filter(
      (r) => r.status === 'pending_recheck' || r.status === 'rejected'
    ).length;
    return { pending, completed, abnormal, total: records.length };
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.franchiseeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.source.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [records, searchTerm, statusFilter]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const formatMoney = (amount: number) => {
    return `¥${amount.toLocaleString('zh-CN')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                加盟商保证金管理
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                退款记录追踪 · 状态全程可查 · 改动留痕可追溯
              </p>
            </div>
            <button
              onClick={() => navigate('/record/new')}
              className="inline-flex items-center px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              新建记录
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">待处理</p>
                <p className="mt-1 text-3xl font-bold text-amber-600">
                  {stats.pending}
                </p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">已完成</p>
                <p className="mt-1 text-3xl font-bold text-emerald-600">
                  {stats.completed}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">异常待复核</p>
                <p className="mt-1 text-3xl font-bold text-orange-600">
                  {stats.abnormal}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">总记录数</p>
                <p className="mt-1 text-3xl font-bold text-slate-700">
                  {stats.total}
                </p>
              </div>
              <div className="p-3 bg-slate-100 rounded-lg">
                <FileText className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索加盟商名称或来源..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as DepositStatus | 'all')
                  }
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="all">全部状态</option>
                  <option value="waiting_settlement">待结算附件</option>
                  <option value="pending_review">待审核</option>
                  <option value="pending_recheck">待复核</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    加盟商
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    金额
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    来源
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    更新时间
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/record/${record.id}`)}
                  >
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-slate-900">
                        {record.franchiseeName}
                      </div>
                      {record.pendingReason && (
                        <div className="text-xs text-amber-600 mt-1 flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {record.pendingReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatMoney(record.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-600">
                        {record.source}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-500">
                        {formatDate(record.updatedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
                        查看
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRecords.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">暂无匹配的记录</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
