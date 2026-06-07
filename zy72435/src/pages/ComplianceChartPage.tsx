import React, { useState } from 'react';
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
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  ArrowLeft,
  List,
  Music,
  Clock,
  ShieldCheck,
  Users,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '../store/AppStore';

export const ComplianceChartPage: React.FC = () => {
  const {
    complianceChecks,
    audioRemarks,
    authorizationPeriods,
    setCurrentPage,
    previousPage,
    setSelectedComplianceId,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'status' | 'issues' | 'timeline'>('overview');

  const handleGoBack = () => {
    if (previousPage) {
      setCurrentPage(previousPage);
    } else {
      setCurrentPage('compliance_check');
    }
  };

  const handleClickSong = (audioFileId: string) => {
    const check = complianceChecks.find(c => c.audioFileId === audioFileId);
    if (check) {
      setSelectedComplianceId(check.id);
    }
    setCurrentPage('compliance_check');
  };

  const statusData = [
    {
      name: '合规',
      value: complianceChecks.filter(c => c.status === 'compliant').length,
      color: '#22c55e',
    },
    {
      name: '待补充',
      value: complianceChecks.filter(c => c.status === 'pending').length,
      color: '#f59e0b',
    },
    {
      name: '待复核',
      value: complianceChecks.filter(c => c.status === 'needs_review').length,
      color: '#3b82f6',
    },
    {
      name: '不合规',
      value: complianceChecks.filter(c => c.status === 'non_compliant').length,
      color: '#ef4444',
    },
  ];

  const issueTypeData = [
    { name: '授权过期', count: complianceChecks.filter(c => c.issues.some(i => i.type === 'expired_auth')).length },
    { name: '缺少授权', count: complianceChecks.filter(c => c.issues.some(i => i.type === 'missing_auth')).length },
    { name: '备注不全', count: complianceChecks.filter(c => c.issues.some(i => i.type === 'incomplete_remark')).length },
    { name: '替补待确认', count: complianceChecks.filter(c => c.issues.some(i => i.type === 'substitute_unverified')).length },
    { name: '地区限制', count: complianceChecks.filter(c => c.issues.some(i => i.type === 'region_restriction')).length },
  ];

  const songComplianceData = complianceChecks.map(c => ({
    name: c.songName,
    audioFileId: c.audioFileId,
    issues: c.issues.length,
    isSubstitute: c.isSubstitute ? 1 : 0,
  }));

  const ownerData = [
    { name: '巡演统筹阿梅', count: complianceChecks.filter(c => c.nextStepOwner === 'tour_coordinator').length },
    { name: '票务同事', count: complianceChecks.filter(c => c.nextStepOwner === 'ticket_staff').length },
    { name: '法务同事', count: complianceChecks.filter(c => c.nextStepOwner === 'legal').length },
    { name: '经纪人团队', count: complianceChecks.filter(c => c.nextStepOwner === 'artist_management').length },
  ];

  const timelineData = [
    { date: '周一', compliant: 2, pending: 1, nonCompliant: 0 },
    { date: '周二', compliant: 1, pending: 2, nonCompliant: 1 },
    { date: '周三', compliant: 3, pending: 0, nonCompliant: 0 },
    { date: '周四', compliant: 1, pending: 1, nonCompliant: 1 },
    { date: '周五', compliant: 2, pending: 1, nonCompliant: 0 },
    { date: '周六', compliant: 1, pending: 0, nonCompliant: 0 },
    { date: '今天', compliant: 0, pending: 1, nonCompliant: 0 },
  ];

  const COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleGoBack}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            title="返回列表视图"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">图表展示</h2>
            <p className="text-slate-500 mt-1">可视化查看合规检查数据，点击数据可跳转回详情</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage('audio_remarks')}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
          >
            <Music size={16} />
            音频备注
          </button>
          <button
            onClick={() => setCurrentPage('authorization')}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
          >
            <Clock size={16} />
            授权期限
          </button>
          <button
            onClick={() => setCurrentPage('compliance_check')}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
          >
            <List size={16} />
            返回列表
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <BarChart3 className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-1">服务复核优先</h3>
            <p className="text-sm text-blue-700">
              图表不是终点，只是漂亮画面。点击图表中的数据点可以<strong>快速跳转回音频文件备注或授权期限页</strong>，
              确保复核工作不会被漂亮画面打断。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-500">总音频数</p>
            <Music size={18} className="text-primary-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{audioRemarks.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-500">已检查</p>
            <ShieldCheck size={18} className="text-success-500" />
          </div>
          <p className="text-2xl font-bold text-success-600">{complianceChecks.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-500">有效授权</p>
            <Clock size={18} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {authorizationPeriods.filter(a => a.status === 'valid').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-500">待处理项</p>
            <Users size={18} className="text-warning-500" />
          </div>
          <p className="text-2xl font-bold text-warning-600">
            {complianceChecks.filter(c => c.status === 'pending' || c.status === 'needs_review').length}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {[
          { id: 'overview', label: '概览', icon: <BarChart3 size={16} /> },
          { id: 'status', label: '状态分布', icon: <PieChartIcon size={16} /> },
          { id: 'issues', label: '问题类型', icon: <ShieldCheck size={16} /> },
          { id: 'timeline', label: '时间趋势', icon: <TrendingUp size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">各歌曲问题数量</h3>
            <p className="text-xs text-slate-500 mb-4">点击柱状图可跳转到对应歌曲的合规详情</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={songComplianceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="issues"
                  fill="#0ea5e9"
                  cursor="pointer"
                  onClick={(data) => handleClickSong((data as any).audioFileId)}
                >
                  {songComplianceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.issues === 0 ? '#22c55e' : entry.issues >= 2 ? '#ef4444' : '#f59e0b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">下一步负责人分布</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ownerData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {ownerData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">快速导航</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => setCurrentPage('audio_remarks')}
                className="p-4 border-2 border-slate-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all text-center group"
              >
                <Music size={32} className="mx-auto mb-2 text-slate-400 group-hover:text-primary-600" />
                <p className="text-sm font-medium text-slate-700 group-hover:text-primary-700">音频文件备注</p>
                <p className="text-xs text-slate-500 mt-1">{audioRemarks.length} 个文件</p>
              </button>
              <button
                onClick={() => setCurrentPage('authorization')}
                className="p-4 border-2 border-slate-200 rounded-xl hover:border-warning-500 hover:bg-warning-50 transition-all text-center group"
              >
                <Clock size={32} className="mx-auto mb-2 text-slate-400 group-hover:text-warning-600" />
                <p className="text-sm font-medium text-slate-700 group-hover:text-warning-700">授权期限页</p>
                <p className="text-xs text-slate-500 mt-1">{authorizationPeriods.length} 条授权</p>
              </button>
              <button
                onClick={() => setCurrentPage('compliance_check')}
                className="p-4 border-2 border-slate-200 rounded-xl hover:border-success-500 hover:bg-success-50 transition-all text-center group"
              >
                <ShieldCheck size={32} className="mx-auto mb-2 text-slate-400 group-hover:text-success-600" />
                <p className="text-sm font-medium text-slate-700 group-hover:text-success-700">合规检查</p>
                <p className="text-xs text-slate-500 mt-1">{complianceChecks.length} 条记录</p>
              </button>
              <button
                onClick={() => setCurrentPage('settlement')}
                className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-center group"
              >
                <Users size={32} className="mx-auto mb-2 text-slate-400 group-hover:text-blue-600" />
                <p className="text-sm font-medium text-slate-700 group-hover:text-blue-700">分账明细</p>
                <p className="text-xs text-slate-500 mt-1">查看详细报告</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">合规状态分布</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">状态明细</h3>
            <div className="space-y-4">
              {statusData.map(item => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-800">{item.value}</span>
                    <button
                      onClick={() => setCurrentPage('compliance_check')}
                      className="text-xs text-primary-600 hover:text-primary-700"
                    >
                      查看 →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">问题类型分布</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={issueTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
                {issueTypeData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.count > 0 ? COLORS[index % COLORS.length] : '#e2e8f0'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">本周检查趋势</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="compliant" name="合规" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="pending" name="待处理" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="nonCompliant" name="不合规" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
