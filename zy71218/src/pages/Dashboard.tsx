import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  DollarSign,
  AlertTriangle,
  Clock,
  Bell,
  CheckSquare,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import StatsCard from '@/components/StatsCard';
import Card from '@/components/Card';
import Table from '@/components/Table';
import SearchBar from '@/components/SearchBar';
import Loading from '@/components/Loading';
import ErrorState from '@/components/ErrorState';
import { CaseStatusBadge, RiskBadge } from '@/components/StatusBadge';
import Timeline from '@/components/Timeline';
import { caseService } from '@/services/caseService';
import { riskService } from '@/services/riskService';
import { cn } from '@/lib/utils';
import type { BusinessCase, RiskDashboardStats } from '../../shared/types';
import { STATUS_LABELS, RISK_COLORS } from '../../shared/types';

const RISK_CHART_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  key: value,
  label,
  value,
}));

const RISK_OPTIONS = [
  { key: 'low', label: '低风险', value: 'low' },
  { key: 'medium', label: '中风险', value: 'medium' },
  { key: 'high', label: '高风险', value: 'high' },
  { key: 'critical', label: '极高风险', value: 'critical' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RiskDashboardStats | null>(null);
  const [cases, setCases] = useState<BusinessCase[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({ status: '', riskLevel: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, casesRes] = await Promise.all([
        riskService.getRiskDashboard(),
        caseService.getCaseList(pagination.current, pagination.pageSize, {
          status: filters.status || undefined,
          riskLevel: filters.riskLevel || undefined,
          keyword: searchKeyword || undefined,
        }),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }

      if (casesRes.success && casesRes.data) {
        setCases(casesRes.data.list);
        setPagination((prev) => ({ ...prev, total: casesRes.data!.total }));
      }
    } catch (err: any) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, filters, searchKeyword]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ current: page, pageSize, total: pagination.total });
  };

  const columns = [
    {
      key: 'businessNo',
      title: '业务编号',
      dataIndex: 'businessNo' as keyof BusinessCase,
      render: (record: BusinessCase) => (
        <span className="font-mono text-sm text-blue-600">{record.businessNo}</span>
      ),
    },
    {
      key: 'buyerName',
      title: '买方',
      dataIndex: 'buyerName' as keyof BusinessCase,
    },
    {
      key: 'sellerName',
      title: '卖方',
      dataIndex: 'sellerName' as keyof BusinessCase,
    },
    {
      key: 'totalAmount',
      title: '金额',
      dataIndex: 'totalAmount' as keyof BusinessCase,
      render: (record: BusinessCase) => (
        <span className="font-medium">¥{record.totalAmount.toLocaleString()}</span>
      ),
    },
    {
      key: 'currentStatus',
      title: '状态',
      render: (record: BusinessCase) => <CaseStatusBadge status={record.currentStatus} />,
    },
    {
      key: 'overdueDays',
      title: '逾期天数',
      render: (record: BusinessCase) => (
        <span className={cn(record.overdueDays > 0 ? 'text-red-600 font-medium' : 'text-slate-500')}>
          {record.overdueDays > 0 ? `${record.overdueDays}天` : '-'}
        </span>
      ),
    },
    {
      key: 'riskLevel',
      title: '风险等级',
      render: (record: BusinessCase) => <RiskBadge level={record.riskLevel} />,
    },
    {
      key: 'action',
      title: '操作',
      render: (record: BusinessCase) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/case/${record.id}`);
          }}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          <Eye size={14} />
          详情
        </button>
      ),
    },
  ];

  const todoItems = [
    { id: '1', title: '催收跟进 - BL2024001', time: '今天 14:00', priority: 'high' },
    { id: '2', title: '风险报告审核 - BL2024002', time: '今天 16:00', priority: 'medium' },
    { id: '3', title: '回款核销确认 - BL2024003', time: '明天 10:00', priority: 'high' },
    { id: '4', title: '合同到期提醒 - BL2024004', time: '后天', priority: 'low' },
  ];

  const alertItems = [
    { id: '1', title: '案件状态异常倒退', description: 'BL2024001 从"已确权"变为"待确权"', time: '10分钟前', type: 'error' },
    { id: '2', title: '高风险案件新增', description: 'BL2024005 风险等级升级为极高风险', time: '30分钟前', type: 'warning' },
    { id: '3', title: '逾期超过90天', description: 'BL2024006 已逾期95天', time: '1小时前', type: 'error' },
  ];

  const riskDistributionData = stats
    ? [
        { name: '低风险', value: Math.floor(stats.totalCases * 0.4), color: RISK_CHART_COLORS[0] },
        { name: '中风险', value: Math.floor(stats.totalCases * 0.3), color: RISK_CHART_COLORS[1] },
        { name: '高风险', value: Math.floor(stats.totalCases * 0.2), color: RISK_CHART_COLORS[2] },
        { name: '极高风险', value: Math.floor(stats.totalCases * 0.1), color: RISK_CHART_COLORS[3] },
      ]
    : [];

  const statusDistributionData = Object.entries(STATUS_LABELS)
    .slice(0, 6)
    .map(([key, label]) => ({
      name: label,
      value: Math.floor(Math.random() * 20) + 5,
    }));

  if (loading && !stats) {
    return <Loading size="lg" text="加载工作台数据..." className="h-[calc(100vh-180px)]" />;
  }

  if (error && !stats) {
    return <ErrorState message={error} onRetry={loadData} className="h-[calc(100vh-180px)]" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="案件总数"
          value={stats?.totalCases || 0}
          icon={FileText}
          color="blue"
          trend={{ value: 12, isUp: true }}
        />
        <StatsCard
          title="逾期金额"
          value={`¥${(stats?.overdueAmount || 0).toLocaleString()}`}
          icon={DollarSign}
          color="red"
          trend={{ value: 8, isUp: true }}
        />
        <StatsCard
          title="高风险案件"
          value={stats?.highRiskCases || 0}
          icon={AlertTriangle}
          color="amber"
          trend={{ value: 5, isUp: false }}
        />
        <StatsCard
          title="催收中案件"
          value={stats?.inCollectionCases || 0}
          icon={Clock}
          color="purple"
          trend={{ value: 15, isUp: true }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="风险分布" className="lg:col-span-1">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="状态分布" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistributionData} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          title="待办事项"
          extra={
            <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
              查看全部 <ArrowRight size={14} />
            </button>
          }
          className="lg:col-span-1"
        >
          <div className="space-y-3">
            {todoItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <CheckSquare
                  size={18}
                  className={cn(
                    'mt-0.5 flex-shrink-0',
                    item.priority === 'high' ? 'text-red-500' : item.priority === 'medium' ? 'text-amber-500' : 'text-slate-400'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="异常告警"
          extra={
            <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
              查看全部 <ArrowRight size={14} />
            </button>
          }
          className="lg:col-span-1"
        >
          <Timeline
            items={alertItems.map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              time: item.time,
              status: item.type === 'error' ? 'error' : 'warning',
            }))}
          />
        </Card>

        <Card title="快速操作" className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '数据导入', icon: FileText, path: '/import', color: 'bg-blue-50 text-blue-600' },
              { label: '回款登记', icon: DollarSign, path: '/collection', color: 'bg-green-50 text-green-600' },
              { label: '风险分析', icon: AlertTriangle, path: '/risk', color: 'bg-amber-50 text-amber-600' },
              { label: '报告导出', icon: Bell, path: '/report', color: 'bg-purple-50 text-purple-600' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', item.color)}>
                  <item.icon size={20} />
                </div>
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card title="案件列表" subtitle="最新案件动态">
        <div className="mb-4">
          <SearchBar
            placeholder="搜索业务编号、买方、卖方..."
            value={searchKeyword}
            onChange={setSearchKeyword}
            onSearch={handleSearch}
            filters={[
              {
                key: 'status',
                label: '状态',
                options: STATUS_OPTIONS,
                value: filters.status,
                onChange: handleFilterChange,
              },
              {
                key: 'riskLevel',
                label: '风险等级',
                options: RISK_OPTIONS,
                value: filters.riskLevel,
                onChange: handleFilterChange,
              },
            ]}
          />
        </div>

        <Table<BusinessCase>
          columns={columns}
          data={cases}
          loading={loading}
          rowKey={(record) => record.id}
          onRowClick={(record) => navigate(`/case/${record.id}`)}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: handlePageChange,
          }}
        />
      </Card>
    </div>
  );
}
