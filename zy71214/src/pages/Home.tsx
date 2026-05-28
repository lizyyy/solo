import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  PlusCircle,
  User,
  LayoutDashboard,
  List,
  BarChart3,
  PieChart,
  Activity,
} from 'lucide-react';
import { useBusinessStore } from '@/store/businessStore';
import { StatusBadge } from '@/components/StatusBadge';
import { RiskIndicator } from '@/components/RiskIndicator';
import { IssueBadge } from '@/components/IssueBadge';
import {
  PurposeMismatchChart,
  SupplementCoverChart,
  DuplicateDistributionChart,
} from '@/components/DashboardCharts';
import {
  STATUS_LABELS,
  ISSUE_TYPE_LABELS,
} from '@/constants/purposeCodes';
import { BusinessStatus, RiskLevel } from '@/types';

type ViewMode = 'dashboard' | 'list';

export default function Home() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<BusinessStatus | ''>('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | ''>('');

  const {
    getFilteredBusiness,
    getStatistics,
    setFilters,
    currentUser,
  } = useBusinessStore();

  const statistics = getStatistics();

  const handleSearch = () => {
    setFilters({
      searchText: searchText || undefined,
      status: statusFilter || undefined,
      riskLevel: riskFilter || undefined,
    });
  };

  const handleReset = () => {
    setSearchText('');
    setStatusFilter('');
    setRiskFilter('');
    setFilters({});
  };

  const filteredBusiness = getFilteredBusiness();

  const statCards = [
    {
      label: '业务总数',
      value: statistics.total,
      icon: LayoutDashboard,
      color: 'bg-blue-500',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      label: '待处理',
      value: statistics.pending,
      icon: Clock,
      color: 'bg-amber-500',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: '待处理问题',
      value: statistics.issue,
      icon: AlertTriangle,
      color: 'bg-red-500',
      bg: 'bg-red-50',
      border: 'border-red-200',
    },
    {
      label: '已确认',
      value: statistics.confirmed,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      label: '今日新增',
      value: statistics.todayNew,
      icon: PlusCircle,
      color: 'bg-indigo-500',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <Activity className="text-blue-600" size={28} />
                跨境汇款用途核验系统
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                统一审核口径，规范补件管理，防范重复汇款
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg">
                <User size={18} className="text-slate-500" />
                <div className="text-sm">
                  <div className="font-medium text-slate-800">{currentUser.name}</div>
                  <div className="text-xs text-slate-500">
                    {currentUser.role === 'supervisor'
                      ? '复核主管'
                      : currentUser.role === 'auditor'
                      ? '合规审计'
                      : '经办柜员'}
                    · {currentUser.department}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 p-1 bg-white rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 size={16} />
              仪表盘
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <List size={16} />
              业务列表
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索业务编号、客户名称..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-72 pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BusinessStatus | '')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskLevel | '')}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部风险</option>
              <option value="normal">正常</option>
              <option value="warning">预警</option>
              <option value="danger">高风险</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Filter size={16} />
              筛选
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300 transition-colors"
            >
              重置
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`${card.bg} ${card.border} border rounded-xl p-5 transition-all hover:shadow-md`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">{card.label}</p>
                    <p className="text-3xl font-bold text-slate-800">{card.value}</p>
                  </div>
                  <div className={`${card.color} p-3 rounded-lg`}>
                    <Icon size={20} className="text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {statistics.byIssueType && Object.keys(statistics.byIssueType).length > 0 && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="text-rose-600" size={20} />
              <h3 className="font-semibold text-rose-800">重点问题预警</h3>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(statistics.byIssueType).map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-rose-100"
                >
                  <IssueBadge type={type as any} />
                  <div>
                    <div className="text-2xl font-bold text-rose-600">{count}</div>
                    <div className="text-xs text-slate-500">
                      {ISSUE_TYPE_LABELS[type] || type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <PieChart size={20} className="text-slate-500" />
              重点场景分析
            </h2>
            <div className="grid grid-cols-3 gap-6">
              <PurposeMismatchChart />
              <SupplementCoverChart />
              <DuplicateDistributionChart />
            </div>

            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mt-8">
              <TrendingUp size={20} className="text-slate-500" />
              待处理业务
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      业务编号
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      客户名称
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      金额
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      用途
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      风险
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      问题数
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      更新时间
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredBusiness
                    .filter((bo) => bo.status !== 'confirmed' && bo.status !== 'closed')
                    .slice(0, 5)
                    .map((business) => {
                      const openIssues = business.issues.filter((i) => i.status === 'open');
                      return (
                        <tr
                          key={business.id}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/detail/${business.id}`)}
                        >
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800">{business.businessNo}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {business.customerName}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-slate-800">
                              {business.amount.toLocaleString()} {business.currency}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-slate-600">
                              {business.purposeCode}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={business.status} />
                          </td>
                          <td className="px-4 py-3">
                            <RiskIndicator level={business.riskLevel} />
                          </td>
                          <td className="px-4 py-3">
                            {openIssues.length > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                <AlertTriangle size={12} />
                                {openIssues.length}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {new Date(business.updatedAt).toLocaleString('zh-CN')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                              查看
                              <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {filteredBusiness.filter((bo) => bo.status !== 'confirmed' && bo.status !== 'closed').length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  暂无待处理业务
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800">
                全部业务 ({filteredBusiness.length})
              </h3>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    业务编号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    客户名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    金额
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    用途代码
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    用途名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    风险等级
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    问题
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    版本
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    更新时间
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBusiness.map((business) => {
                  const openIssues = business.issues.filter((i) => i.status === 'open');
                  return (
                    <tr
                      key={business.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/detail/${business.id}`)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{business.businessNo}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {business.customerName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-800">
                          {business.amount.toLocaleString()} {business.currency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-600">
                        {business.purposeCode}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {business.purposeName}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={business.status} />
                      </td>
                      <td className="px-4 py-3">
                        <RiskIndicator level={business.riskLevel} />
                      </td>
                      <td className="px-4 py-3">
                        {openIssues.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            <AlertTriangle size={12} />
                            {openIssues.length}
                          </span>
                        ) : business.issues.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            <CheckCircle size={12} />
                            {business.issues.length}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        v{business.currentVersion}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(business.updatedAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
                          查看详情
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredBusiness.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Filter size={40} className="mx-auto text-slate-300 mb-2" />
                <p>没有找到匹配的业务</p>
                <p className="text-sm text-slate-400 mt-1">请尝试调整筛选条件</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
