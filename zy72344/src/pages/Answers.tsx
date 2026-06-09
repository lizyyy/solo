import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Eye,
  AlertTriangle,
  FileText,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  Users,
  Layers,
} from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import type { AnswerStatus } from '@/types';
import { cn } from '@/lib/utils';

const Answers: React.FC = () => {
  const navigate = useNavigate();
  const {
    studentAnswers,
    getStudentAnswersByStudentId,
    getErrorsByAnswerId,
    getLatestMealPlan,
  } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AnswerStatus | 'all'>('all');

  const latestMealPlan = getLatestMealPlan();
  const unresolvedErrors =
    latestMealPlan?.errors.filter((e) => !e.resolved).length || 0;
  const totalErrors = latestMealPlan?.errors.length || 0;

  const filteredAnswers = studentAnswers.filter((answer) => {
    const matchesSearch = answer.studentName.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || answer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStudentVersionCount = (studentId: string) => {
    return getStudentAnswersByStudentId(studentId).length;
  };

  const multiVersionStudents = new Set(
    studentAnswers
      .filter((a) => getStudentAnswersByStudentId(a.studentId).length > 1)
      .map((a) => a.studentId)
  ).size;

  const answersWithManual = studentAnswers.filter((a) => a.manualExample).length;

  const stats = {
    total: studentAnswers.length,
    pending: studentAnswers.filter((a) => a.status === 'pending').length,
    reviewing: studentAnswers.filter((a) => a.status === 'reviewing').length,
    normal: studentAnswers.filter((a) => a.status === 'normal').length,
    exception: studentAnswers.filter((a) => a.status === 'exception').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">学生答案</h1>
          <p className="text-slate-500 mt-1">
            三步流程 - 第②步：吴老师补看手算反例 · 第③步：误差说明更新与运营复核
          </p>
        </div>
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition-colors"
        >
          <FileText className="w-4 h-4" />
          查看报告误差说明
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">答案总数</p>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Layers className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">多版答案学生</p>
              <p className="text-2xl font-bold text-slate-800">
                {multiVersionStudents}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Calculator className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">已补手算反例</p>
              <p className="text-2xl font-bold text-slate-800">
                {answersWithManual}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Clock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400">待运营复核</p>
              <p className="text-2xl font-bold text-slate-800">
                {stats.pending + stats.reviewing}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-base">
              🔔 业务运营复核须知（同数据实时联动报告中心）
            </p>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="bg-white/70 rounded-lg p-3 border border-amber-100">
                <p className="text-sm font-medium text-amber-700 mb-1">
                  📋 当前报告状态
                </p>
                <p className="text-xs text-amber-600">
                  共 {totalErrors} 条误差说明，{unresolvedErrors} 条未归档，
                  已保留原始说法、改后值、处理原因、下一步找谁，勿提前归正常
                </p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-amber-100">
                <p className="text-sm font-medium text-amber-700 mb-1">
                  👆 如何走完样例
                </p>
                <p className="text-xs text-amber-600">
                  点击学生姓名行 → 补充手算反例 → 选择"留待运营复核" → 报告中实时同步
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索学生姓名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AnswerStatus | 'all')}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 bg-white"
          >
            <option value="all">全部状态</option>
            <option value="pending">待审核</option>
            <option value="reviewing">复核中（运营）</option>
            <option value="normal">正常</option>
            <option value="exception">异常</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                学生
              </th>
              <th className="px-5 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                版本
              </th>
              <th className="px-5 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                三步进度
              </th>
              <th className="px-5 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-5 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                备注 / 处理原因
              </th>
              <th className="px-5 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredAnswers.map((answer) => {
              const versionCount = getStudentVersionCount(answer.studentId);
              const hasMultipleVersions = versionCount > 1;
              const linkedErrors = getErrorsByAnswerId(answer.id);
              const step1 = true;
              const step2 = !!answer.manualExample;
              const step3 = answer.status === 'normal';

              return (
                <tr
                  key={answer.id}
                  className={cn(
                    'hover:bg-slate-50/70 transition-colors',
                    hasMultipleVersions ? 'bg-amber-50/40' : ''
                  )}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center',
                          hasMultipleVersions
                            ? 'bg-amber-200 text-amber-800'
                            : 'bg-slate-200 text-slate-600'
                        )}
                      >
                        <span className="text-sm font-bold">
                          {answer.studentName[0]}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {answer.studentName}
                          </span>
                          {hasMultipleVersions && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                              {versionCount}版冲突
                            </span>
                          )}
                          {linkedErrors.length > 0 && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {linkedErrors.length}条误差
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {answer.createdAt}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium text-slate-700">
                        v{answer.version}
                      </span>
                      {answer.manualExample && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          step1
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 text-slate-500'
                        )}
                      >
                        1
                      </div>
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          step2
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-400 text-white'
                        )}
                        title={step2 ? '已补手算反例' : '待吴老师补看手算反例'}
                      >
                        2
                      </div>
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          step3
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-300 text-white'
                        )}
                        title={step3 ? '已归档' : '待运营复核归档'}
                      >
                        3
                      </div>
                      {!step3 && (
                        <span className="ml-2 text-xs text-slate-500">
                          {!step2 ? '②未完成' : '③待复核'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={answer.status} />
                  </td>
                  <td className="px-5 py-4 max-w-xs">
                    <p className="text-sm text-slate-600 truncate">
                      {answer.remark}
                    </p>
                    {answer.manualExample && (
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                        <Calculator className="w-3 h-3" />
                        已附手算验证
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => navigate(`/answers/${answer.id}`)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-lg font-medium transition-colors',
                        hasMultipleVersions
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                          : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                      )}
                    >
                      <Eye className="w-4 h-4" />
                      {hasMultipleVersions ? '去对比版本' : '查看详情'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Answers;
