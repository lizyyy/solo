import { useEffect, useState } from 'react';
import {
  Users, FileText, TrendingUp, AlertTriangle, CheckCircle,
  ChevronRight, Loader2, BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { StatCard } from '@/components/common/StatCard';
import { useClassStore } from '@/store/useClassStore';
import { IssueType } from '@/types';

const ISSUE_COLORS: Record<IssueType, string> = {
  duplicate: '#6366f1', gray: '#64748b', over_saturated: '#f59e0b'
};
const ISSUE_LABELS: Record<IssueType, string> = {
  duplicate: '配色重复', gray: '画面偏灰', over_saturated: '色彩过饱和'
};
const RANK_STYLES = [
  'bg-amber-100 text-amber-700', 'bg-slate-200 text-slate-600', 'bg-orange-100 text-orange-700'
];

export default function ClassOverview() {
  const {
    classes, currentClass, classStats, studentComparisons, isLoading,
    loadClasses, loadClassOverview, loadStudentComparisons
  } = useClassStore();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => {
    if (selectedClassId) {
      loadClassOverview(selectedClassId);
      loadStudentComparisons(selectedClassId);
    }
  }, [selectedClassId, loadClassOverview, loadStudentComparisons]);

  const getChartData = () => classStats
    ? Object.entries(classStats.issueDistribution).map(([type, count]) => ({
        name: ISSUE_LABELS[type as IssueType], value: count, type
      }))
    : [];

  const getScoreColor = (s: number) =>
    s >= 80 ? 'text-emerald-600' : s >= 60 ? 'text-amber-600' : 'text-red-600';

  const renderChart = () => {
    const data = getChartData();
    return (
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'pie' ? (
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
              paddingAngle={2} dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {data.map((entry, i) => (
                <Cell key={i} fill={ISSUE_COLORS[entry.type as IssueType]} />
              ))}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={ISSUE_COLORS[entry.type as IssueType]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  const renderTable = (headers: string[], rows: React.ReactNode[]) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr className="border-b border-slate-200">
          {headers.map((h, i) => (
            <th key={i} className="text-left py-3 px-4 text-sm font-medium text-slate-600">{h}</th>
          ))}
        </tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">班级概览</h1>
        <p className="text-slate-600">查看班级统计数据和学生表现</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />班级列表
            </h2>
            {isLoading && classes.length === 0 ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              </div>
            ) : classes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">暂无班级数据</div>
            ) : (
              <div className="space-y-2">
                {classes.map(cls => (
                  <button key={cls.id} onClick={() => setSelectedClassId(cls.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                      selectedClassId === cls.id
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                    <div>
                      <p className="font-medium">{cls.name}</p>
                      {cls.grade && <p className="text-xs text-slate-500">{cls.grade}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {!currentClass ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">请从左侧选择一个班级查看详情</p>
            </div>
          ) : isLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
            </div>
          ) : classStats ? (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  {currentClass.name}
                  {currentClass.grade && <span className="text-sm font-normal text-slate-500 ml-2">{currentClass.grade}</span>}
                </h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="作品总数" value={classStats.totalWorks} icon={<FileText className="w-6 h-6 text-indigo-600" />} color="default" />
                <StatCard title="平均分" value={classStats.averageScore} icon={<TrendingUp className="w-6 h-6 text-emerald-600" />} color="success" />
                <StatCard title="问题率" value={`${classStats.issueRate}%`} icon={<AlertTriangle className="w-6 h-6 text-amber-600" />} color={classStats.issueRate > 50 ? 'warning' : 'default'} />
                <StatCard title="完整率" value={`${classStats.completionRate}%`} icon={<CheckCircle className="w-6 h-6 text-emerald-600" />} color={classStats.completionRate >= 80 ? 'success' : 'default'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">问题类型分布</h3>
                    <div className="flex gap-1">
                      <button onClick={() => setChartType('pie')} className={`p-2 rounded-lg ${chartType === 'pie' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}>
                        <PieChartIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setChartType('bar')} className={`p-2 rounded-lg ${chartType === 'bar' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}>
                        <BarChart3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="h-64">{renderChart()}</div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">学生排名</h3>
                  {classStats.topStudents.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">暂无学生数据</div>
                  ) : (
                    <div className="space-y-3">
                      {classStats.topStudents.map((s, i) => (
                        <div key={s.studentId} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${RANK_STYLES[i] || 'bg-slate-100 text-slate-500'}`}>
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{s.studentName}</p>
                            <p className="text-xs text-slate-500">{s.workCount} 个作品</p>
                          </div>
                          <span className="text-lg font-bold text-indigo-600">{s.averageScore}分</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">最近作品</h3>
                {classStats.recentWorks.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">暂无作品数据</div>
                ) : renderTable(['学生', '作品', '评分', '时间'],
                  classStats.recentWorks.map(w => (
                    <tr key={w.workId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-900">{w.studentName}</td>
                      <td className="py-3 px-4 text-sm text-slate-900">{w.title}</td>
                      <td className="py-3 px-4"><span className={`text-sm font-medium ${getScoreColor(w.score)}`}>{w.score}分</span></td>
                      <td className="py-3 px-4 text-sm text-slate-500">{new Date(w.importedAt).toLocaleDateString('zh-CN')}</td>
                    </tr>
                  ))
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">学生对比</h3>
                {studentComparisons.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">暂无对比数据</div>
                ) : renderTable(['学生', '平均分', '问题数', '进步趋势', '主色'],
                  studentComparisons.map(s => (
                    <tr key={s.studentId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">{s.studentName}</td>
                      <td className="py-3 px-4"><span className={`text-sm font-bold ${getScoreColor(s.averageScore)}`}>{s.averageScore}分</span></td>
                      <td className="py-3 px-4 text-sm text-slate-900">{s.totalIssues}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {s.improvementTrend > 0 && <ArrowUpRight className="w-4 h-4 text-emerald-600" />}
                          {s.improvementTrend < 0 && <ArrowDownRight className="w-4 h-4 text-red-600" />}
                          <span className={`text-sm font-medium ${
                            s.improvementTrend > 0 ? 'text-emerald-600' : s.improvementTrend < 0 ? 'text-red-600' : 'text-slate-500'
                          }`}>
                            {s.improvementTrend > 0 ? '+' : ''}{s.improvementTrend}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {s.works.slice(0, 1).flatMap(w =>
                            w.dominantColors.slice(0, 3).map((c, i) => (
                              <div key={i} className="w-6 h-6 rounded-full border border-slate-200" style={{ backgroundColor: c }} />
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
