import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { ClipboardCheck, AlertTriangle, Clock, CheckCircle, ArrowRight, MapPin, FileText, BarChart3 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const navigate = useNavigate();
  const { complaints } = useAppStore();

  const pendingCount = complaints.filter((c) => c.status === 'pending' || c.status === 'reviewing').length;
  const trafficReviewCount = complaints.filter((c) => c.status === 'pending_traffic_review').length;
  const rectifyingCount = complaints.filter((c) => c.status === 'rectifying').length;
  const completedCount = complaints.filter((c) => c.status === 'completed').length;

  const trendData = [
    { month: '1月', 投诉数: 8, 完成数: 6 },
    { month: '2月', 投诉数: 12, 完成数: 10 },
    { month: '3月', 投诉数: 15, 完成数: 12 },
    { month: '4月', 投诉数: 10, 完成数: 9 },
    { month: '5月', 投诉数: 18, 完成数: 14 },
    { month: '6月', 投诉数: 14, 完成数: 11 },
  ];

  const scoreDistribution = [
    { name: '优秀(90+)', value: 5, color: '#10B981' },
    { name: '良好(75-89)', value: 8, color: '#3B82F6' },
    { name: '一般(60-74)', value: 4, color: '#F59E0B' },
    { name: '待改进(<60)', value: 2, color: '#EF4444' },
  ];

  const typeData = [
    { name: '宠物活动区', 数量: 12 },
    { name: '坡道问题', 数量: 9 },
    { name: '其他', 数量: 3 },
  ];

  const recentComplaints = complaints.slice(0, 4);

  const statCards = [
    { label: '待审核', value: pendingCount, icon: Clock, color: 'from-yellow-400 to-orange-500', bgColor: 'bg-yellow-50' },
    { label: '待交通协管复核', value: trafficReviewCount, icon: AlertTriangle, color: 'from-orange-400 to-red-500', bgColor: 'bg-orange-50' },
    { label: '整改中', value: rectifyingCount, icon: ClipboardCheck, color: 'from-blue-400 to-indigo-500', bgColor: 'bg-blue-50' },
    { label: '已完成', value: completedCount, icon: CheckCircle, color: 'from-green-400 to-emerald-500', bgColor: 'bg-green-50' },
  ];

  const quickActions = [
    { label: '导入红线图备注', icon: MapPin, path: '/redline', desc: '批量导入，自动去重' },
    { label: '查看投诉记录', icon: FileText, path: '/complaints', desc: '全流程台账管理' },
    { label: '3D可视化', icon: BarChart3, path: '/visualization', desc: '空间展示与复核' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="工作台" 
        subtitle="欢迎回来，周姐。今天有很多工作要处理哦。"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => (
          <div 
            key={index}
            className="card p-6 card-hover cursor-pointer"
            onClick={() => navigate('/complaints')}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {quickActions.map((action, index) => (
          <div 
            key={index}
            className="card p-6 card-hover cursor-pointer group"
            onClick={() => navigate(action.path)}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary-50 group-hover:bg-primary-100 transition-colors">
                <action.icon className="w-6 h-6 text-primary-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">{action.label}</h3>
                <p className="text-sm text-gray-500">{action.desc}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">投诉趋势</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip />
              <Line type="monotone" dataKey="投诉数" stroke="#1E40AF" strokeWidth={2} dot={{ fill: '#1E40AF' }} />
              <Line type="monotone" dataKey="完成数" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">评分分布</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={scoreDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
              >
                {scoreDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {scoreDistribution.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-gray-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">投诉类型分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip />
              <Bar dataKey="数量" fill="#1E40AF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">最近投诉</h3>
            <button 
              onClick={() => navigate('/complaints')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              查看全部 →
            </button>
          </div>
          <div className="space-y-3">
            {recentComplaints.map((complaint) => (
              <div 
                key={complaint.id}
                className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => navigate(`/complaints/${complaint.id}`)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate flex-1 mr-3">{complaint.title}</p>
                  <StatusBadge status={complaint.status} />
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{complaint.code}</span>
                  <span>评分: {complaint.currentScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
