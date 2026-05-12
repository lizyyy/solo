import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Download,
  RefreshCw,
} from 'lucide-react';
import { reportApi, exportApi } from '../api';
import dayjs from 'dayjs';

const PIE_COLORS = ['#eab308', '#22c55e', '#ef4444', '#f97316'];

function Dashboard() {
  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['report'],
    queryFn: () => reportApi.getReport().then(res => res.data),
  });

  const handleExport = () => {
    exportApi.exportCSV({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">加载报告失败</p>
          <button onClick={() => refetch()} className="btn-primary">
            重试
          </button>
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      label: '总申请数',
      value: report.totalRequests,
      icon: FileText,
      color: 'bg-primary-500',
      bgColor: 'bg-primary-50',
      textColor: 'text-primary-600',
    },
    {
      label: '待审核',
      value: report.pendingCount,
      icon: Clock,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
    {
      label: '已通过',
      value: report.approvedCount,
      icon: CheckCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      label: '已拒绝',
      value: report.rejectedCount,
      icon: XCircle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
    },
    {
      label: '异常',
      value: report.abnormalCount,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
  ];

  const pieData = [
    { name: '待审核', value: report.pendingCount, color: PIE_COLORS[0] },
    { name: '已通过', value: report.approvedCount, color: PIE_COLORS[1] },
    { name: '已拒绝', value: report.rejectedCount, color: PIE_COLORS[2] },
    { name: '异常', value: report.abnormalCount, color: PIE_COLORS[3] },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">统计报表</h2>
          <p className="text-gray-500 text-sm mt-1">
            数据截止时间：{dayjs().format('YYYY-MM-DD HH:mm:ss')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => refetch()} className="btn-secondary flex items-center space-x-2">
            <RefreshCw className="w-4 h-4" />
            <span>刷新</span>
          </button>
          <button onClick={handleExport} className="btn-primary flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>导出全部数据</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statsCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <span className="font-medium">平均审核耗时</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {report.averageReviewTime.toFixed(1)} <span className="text-sm font-normal text-gray-500">天</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            月度申请趋势
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            审核状态分布
          </div>
          <div className="card-body">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                暂无数据
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            按课程统计
          </div>
          <div className="card-body">
            {report.courseStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={report.courseStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="courseCode"
                    tick={{ fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: any, _name: any, props: any) => [
                      `${value} 条`,
                      props.payload.courseName,
                    ]}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                暂无数据
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            异常原因统计
          </div>
          <div className="card-body">
            {report.abnormalReasons.length > 0 ? (
              <div className="space-y-4">
                {report.abnormalReasons.map((item, index) => {
                  const total = report.abnormalReasons.reduce((sum, r) => sum + r.count, 0);
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{item.reason}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {item.count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                暂无异常数据
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          课程统计详情
        </div>
        <div className="card-body">
          {report.courseStats.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>课程代码</th>
                  <th>课程名称</th>
                  <th>申请数量</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                {report.courseStats.map((item) => {
                  const total = report.courseStats.reduce((sum, c) => sum + c.count, 0);
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <tr key={item.courseCode}>
                      <td className="font-mono">{item.courseCode}</td>
                      <td>{item.courseName}</td>
                      <td className="font-medium">{item.count}</td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-primary-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-500">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              暂无数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
