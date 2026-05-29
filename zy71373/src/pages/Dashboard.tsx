import { useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle, AlertCircle, CheckCircle2, Clock, TrendingUp,
  PieChart as PieChartIcon, ListTodo, FileText, Calendar, User
} from 'lucide-react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent, CardFooter } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { RiskBadge } from '../components/RiskBadge';
import { Button } from '../components/Button';
import type { TodoItem, AuditReport } from '../types';

const riskTypeLabels: Record<string, string> = {
  expired: '授权过期',
  channel_out_of_scope: '渠道超范围',
  font_renamed: '字体重名',
  missing_license: '缺少授权',
  pending_info: '待补资料'
};

const COLORS = ['#E53935', '#FB8C00', '#43A047', '#22D3EE', '#3B82F6'];

export default function Dashboard() {
  const { reports, todos, loadReports, loadTodos, completeTodo } = useStore();

  useEffect(() => {
    loadReports();
    loadTodos();
  }, [loadReports, loadTodos]);

  const stats = useMemo(() => {
    const allRisks = reports.flatMap(r => r.risks);
    return {
      total: allRisks.length,
      high: allRisks.filter(r => r.level === 'high').length,
      medium: allRisks.filter(r => r.level === 'medium').length,
      pending: todos.filter(t => t.status === 'pending').length
    };
  }, [reports, todos]);

  const trendData = useMemo(() => {
    const monthly: Record<string, { high: number; medium: number; low: number }> = {};
    reports.forEach(report => {
      const month = report.createDate.slice(0, 7);
      if (!monthly[month]) monthly[month] = { high: 0, medium: 0, low: 0 };
      report.risks.forEach(risk => {
        if (risk.level === 'high') monthly[month].high++;
        else if (risk.level === 'medium') monthly[month].medium++;
        else monthly[month].low++;
      });
    });
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));
  }, [reports]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.flatMap(r => r.risks).forEach(risk => {
      counts[risk.type] = (counts[risk.type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, value]) => ({
      name: riskTypeLabels[type] || type,
      value
    }));
  }, [reports]);

  const pendingTodos = useMemo(() =>
    todos.filter(t => t.status === 'pending').slice(0, 5),
    [todos]
  );

  const recentReports = useMemo(() =>
    [...reports].sort((a, b) => b.createDate.localeCompare(a.createDate)).slice(0, 5),
    [reports]
  );

  const StatCard = ({ title, value, icon: Icon, color }: {
    title: string; value: number; icon: LucideIcon; color: string;
  }) => (
    <Card hover>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className={`text-3xl font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
            {value}
          </p>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${color} bg-opacity-10`}>
          <Icon className="w-8 h-8 text-white opacity-90" />
        </div>
      </CardContent>
    </Card>
  );

  const handleCompleteTodo = (id: string) => completeTodo(id);

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0F2B4A' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">风险仪表盘</h1>
          <p className="text-slate-400">实时监控字体授权风险与合规状态</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="总风险数" value={stats.total} icon={AlertTriangle} color="from-cyan-400 to-blue-500" />
          <StatCard title="高风险" value={stats.high} icon={AlertCircle} color="from-red-500 to-red-600" />
          <StatCard title="中风险" value={stats.medium} icon={AlertCircle} color="from-orange-500 to-orange-600" />
          <StatCard title="待办事项" value={stats.pending} icon={Clock} color="from-cyan-400 to-blue-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">风险趋势</h3>
                </div>
                <span className="text-sm text-slate-400">近6个月</span>
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94A3B8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94A3B8" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#F1F5F9' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="high" name="高风险" stroke="#E53935" strokeWidth={2} dot={{ fill: '#E53935' }} />
                  <Line type="monotone" dataKey="medium" name="中风险" stroke="#FB8C00" strokeWidth={2} dot={{ fill: '#FB8C00' }} />
                  <Line type="monotone" dataKey="low" name="低风险" stroke="#43A047" strokeWidth={2} dot={{ fill: '#43A047' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                  <PieChartIcon className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">风险类型分布</h3>
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#94A3B8' }}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#F1F5F9' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                    <ListTodo className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">待办事项</h3>
                </div>
                <Button variant="ghost" size="sm">查看全部</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-700/50">
                {pendingTodos.map((todo: TodoItem) => (
                  <div key={todo.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium mb-1 truncate">{todo.title}</h4>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />{todo.assignee}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />{todo.dueDate}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={todo.status === 'pending' ? 'temp_note' : 'confirmed'} size="sm" />
                        <Button variant="ghost" size="sm" onClick={() => handleCompleteTodo(todo.id)}>
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            {pendingTodos.length === 0 && (
              <CardFooter className="justify-center py-8 text-slate-400">
                <ListTodo className="w-8 h-8 mr-2 opacity-50" />
                暂无待办事项
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                    <FileText className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">最近审计报告</h3>
                </div>
                <Button variant="ghost" size="sm">查看全部</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-700/50">
                {recentReports.map((report: AuditReport) => (
                  <div key={report.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium mb-1 truncate">{report.projectName}</h4>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />{report.createDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />{report.auditor}
                          </span>
                        </div>
                      </div>
                      <RiskBadge level={report.overallRisk} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            {recentReports.length === 0 && (
              <CardFooter className="justify-center py-8 text-slate-400">
                <FileText className="w-8 h-8 mr-2 opacity-50" />
                暂无审计报告
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
