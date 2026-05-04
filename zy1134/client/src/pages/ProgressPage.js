import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  TrendingUp,
  BookOpen,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { progressApi } from '../services/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const categoryNames = {
  scale: '音阶',
  chord: '和弦',
  inversion: '转位',
  roman: '罗马数字',
  cadence: '终止式',
};

function StatCard({ icon: Icon, title, value, subtitle, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function ProgressOverview({ overview, loading }) {
  if (loading || !overview) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={Clock}
        title="总练习次数"
        value={overview.totalSessions}
        subtitle="练习会话"
        color="blue"
      />
      <StatCard
        icon={BookOpen}
        title="总答题数"
        value={overview.totalAnswers}
        subtitle={`正确 ${overview.correctAnswers} 题`}
        color="green"
      />
      <StatCard
        icon={TrendingUp}
        title="正确率"
        value={`${overview.accuracy}%`}
        subtitle={overview.accuracy >= 70 ? '继续保持！' : '需要加强练习'}
        color={overview.accuracy >= 70 ? 'green' : 'yellow'}
      />
      <StatCard
        icon={AlertTriangle}
        title="待复习错题"
        value={overview.activeWrongNotes}
        subtitle="需要巩固复习"
        color={overview.activeWrongNotes > 5 ? 'red' : 'yellow'}
      />
    </div>
  );
}

function PracticeTrend({ data, loading }) {
  if (loading || !data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">近7天练习趋势</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          {loading ? '加载中...' : '暂无练习数据'}
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    day: formatDate(d.day),
    答题数: d.total,
    正确数: d.correct,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">近7天练习趋势</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="day" stroke="#6B7280" fontSize={12} />
            <YAxis stroke="#6B7280" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="答题数" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
            <Line type="monotone" dataKey="正确数" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KnowledgePointChart({ data, loading }) {
  if (loading || !data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">知识点正确率统计</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          {loading ? '加载中...' : '暂无练习数据'}
        </div>
      </div>
    );
  }

  const chartData = data
    .filter((d) => d.total_answers > 0)
    .map((d) => ({
      name: d.name.length > 8 ? d.name.substring(0, 8) + '...' : d.name,
      fullName: d.name,
      正确率: parseFloat(d.accuracy),
      答题数: d.total_answers,
      category: categoryNames[d.category] || d.category,
    }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">知识点正确率统计</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" domain={[0, 100]} stroke="#6B7280" fontSize={12} />
            <YAxis dataKey="name" type="category" stroke="#6B7280" fontSize={11} width={80} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
              formatter={(value, name, props) => {
                return [
                  `${value}% (答题${props.payload.答题数}题)`,
                  name,
                ];
              }}
            />
            <Bar dataKey="正确率" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                key={`cell-${index}`}
                fill={entry.正确率 >= 70 ? '#10B981' : entry.正确率 >= 40 ? '#F59E0B' : '#EF4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function QuestionTypeChart({ data, loading }) {
  if (loading || !data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">题型正确率分布</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          {loading ? '加载中...' : '暂无练习数据'}
        </div>
      </div>
    );
  }

  const chartData = data
    .filter((d) => d.total_answers > 0)
    .map((d) => ({
      name: d.type_name,
      value: parseFloat(d.accuracy),
      答题数: d.total_answers,
    }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">题型正确率分布</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#E5E7EB" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
            <Radar
              name="正确率"
              dataKey="value"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
              formatter={(value) => [`${value}%`, '正确率']}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WeakPointsSection({ weakPoints, loading }) {
  if (loading || !weakPoints) {
    return null;
  }

  const { weakKnowledgePoints, topErrorTags } = weakPoints;

  if (!weakKnowledgePoints?.length === 0 && !topErrorTags?.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {weakKnowledgePoints && weakKnowledgePoints.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            需要优先复习的知识点
          </h3>
          <div className="space-y-3">
            {weakKnowledgePoints.map((kp, index) => (
              <div key={kp.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{kp.name}</p>
                    <p className="text-xs text-gray-500">
                      答题 {kp.total_answers} 题，正确 {kp.correct_answers} 题
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold text-yellow-600">
                  {kp.accuracy}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topErrorTags && topErrorTags.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            高频错因分析
          </h3>
          <div className="space-y-3">
            {topErrorTags.map((tag, index) => (
              <div key={tag.tag} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <span className="text-sm text-gray-900">{tag.tag}</span>
                </div>
                <span className="text-sm text-gray-500">
                  <span className="font-bold text-red-500">{tag.count}</span> 次
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PracticeHistory({ history, pagination, loading, onPageChange }) {
  if (loading || !history) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">练习历史记录</h3>
        <div className="h-40 flex items-center justify-center text-gray-400">
          {loading ? '加载中...' : '暂无练习历史'}
        </div>
      </div>
    );
  }

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">练习历史记录</h3>
      
      {history.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-gray-400">
          暂无练习历史
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">练习时间</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">知识点</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">题目数</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">正确率</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">状态</th>
                </tr>
              </thead>
              <tbody>
                {history.map((session) => (
                <tr key={session.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {formatDateTime(session.created_at)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {session.knowledge_point_name || '综合练习'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 text-right">
                    {session.correct_count}/{session.total_questions}
                  </td>
                  <td className="py-3 px-4 text-sm text-right">
                    <span className={`font-medium ${
                      session.accuracy >= 70 ? 'text-green-600' : 
                      session.accuracy >= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {session.accuracy}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {session.is_completed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        已完成
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                        进行中
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                共 {pagination.total} 条记录，第 {pagination.page} / {pagination.pages} 页
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-700 px-2">
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProgressPage() {
  const [overview, setOverview] = useState(null);
  const [knowledgePoints, setKnowledgePoints] = useState(null);
  const [questionTypes, setQuestionTypes] = useState(null);
  const [weakPoints, setWeakPoints] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);

  const loadData = async (page = 1) => {
    try {
      const [overviewRes, kpRes, qtRes, wpRes, historyRes] = await Promise.all([
        progressApi.getOverview(),
        progressApi.getByKnowledgePoint(),
        progressApi.getByQuestionType(),
        progressApi.getWeakPoints(),
        progressApi.getHistory({ page, limit: 10 }),
      ]);

      setOverview(overviewRes.data.data);
      setKnowledgePoints(kpRes.data.data);
      setQuestionTypes(qtRes.data.data);
      setWeakPoints(wpRes.data.data);
      setHistory(historyRes.data.data);
      setHistoryPagination(historyRes.data.pagination);
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(historyPage);
  }, [historyPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && (!historyPagination || page <= historyPagination.pages)) {
      setHistoryPage(page);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">进度看板</h2>
          <p className="text-gray-500 mt-1">查看你的学习进度和统计数据</p>
        </div>
      </div>

      <ProgressOverview overview={overview} loading={loading} />

      <PracticeTrend data={overview?.last7Days} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KnowledgePointChart data={knowledgePoints} loading={loading} />
        <QuestionTypeChart data={questionTypes} loading={loading} />
      </div>

      <WeakPointsSection weakPoints={weakPoints} loading={loading} />

      <PracticeHistory
        history={history}
        pagination={historyPagination}
        loading={loading}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

export default ProgressPage;
