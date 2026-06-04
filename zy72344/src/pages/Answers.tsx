import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Eye, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import type { AnswerStatus } from '@/types';

const Answers: React.FC = () => {
  const navigate = useNavigate();
  const { studentAnswers, getStudentAnswersByStudentId } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AnswerStatus | 'all'>('all');

  const filteredAnswers = studentAnswers.filter((answer) => {
    const matchesSearch = answer.studentName.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || answer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStudentVersionCount = (studentId: string) => {
    return getStudentAnswersByStudentId(studentId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">学生答案</h1>
          <p className="text-slate-500 mt-1">管理和复核学生提交的答案，支持多版答案对比</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">业务运营复核提示</p>
            <p className="text-sm text-amber-700 mt-1">
              同一学生提交多版答案时，请先查看历史版本和手算反例，再决定是否标记为正常。
              吴老师已补充手算验证的答案优先处理。
            </p>
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
            <option value="reviewing">复核中</option>
            <option value="normal">正常</option>
            <option value="exception">异常</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                学生
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                版本
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                答案内容
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                备注
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                提交时间
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredAnswers.map((answer) => {
              const versionCount = getStudentVersionCount(answer.studentId);
              const hasMultipleVersions = versionCount > 1;

              return (
                <tr
                  key={answer.id}
                  className={`hover:bg-slate-50 transition-colors ${
                    hasMultipleVersions ? 'bg-amber-50/50' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-slate-600">
                          {answer.studentName[0]}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">
                          {answer.studentName}
                        </span>
                        {hasMultipleVersions && (
                          <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                            多版答案
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">v{answer.version}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-600 truncate max-w-xs">
                      {answer.content}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={answer.status} />
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-500 truncate max-w-xs">
                      {answer.remark}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500">{answer.createdAt}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => navigate(`/answers/${answer.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      查看详情
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
