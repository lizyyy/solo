import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Clock, User, FileText, Table2, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/store';
import type { HistoryTargetType } from '@/types';

const History: React.FC = () => {
  const navigate = useNavigate();
  const { historyRecords, studentAnswers, parameterTables } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<HistoryTargetType | 'all'>('all');

  const filteredRecords = historyRecords
    .filter((record) => {
      let targetName = '';
      if (record.targetType === 'answer') {
        const answer = studentAnswers.find((a) => a.id === record.targetId);
        targetName = answer?.studentName || '';
      } else {
        const table = parameterTables.find((t) => t.id === record.targetId);
        targetName = table?.name || '';
      }

      const matchesSearch =
        targetName.includes(searchTerm) ||
        record.operator.includes(searchTerm) ||
        record.fieldName.includes(searchTerm);
      const matchesType = typeFilter === 'all' || record.targetType === typeFilter;

      return matchesSearch && matchesType;
    })
    .sort(
      (a, b) =>
        new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime()
    );

  const getTargetInfo = (record: (typeof historyRecords)[0]) => {
    if (record.targetType === 'answer') {
      const answer = studentAnswers.find((a) => a.id === record.targetId);
      return {
        name: answer?.studentName || '未知',
        icon: FileText,
        link: `/answers/${record.targetId}`,
      };
    } else {
      const table = parameterTables.find((t) => t.id === record.targetId);
      return {
        name: table?.name || '未知',
        icon: Table2,
        link: `/parameters`,
      };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">历史记录</h1>
          <p className="text-slate-500 mt-1">追踪所有修改操作，支持备注和参数版本对比</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-blue-800">修改追踪说明</p>
            <p className="text-sm text-blue-700 mt-1">
              所有备注修改、状态变更、手算反例补充都会被记录。
              吴老师修改的备注会清晰显示改前改后的差别。
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索学生、操作人、字段..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as HistoryTargetType | 'all')}
            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 bg-white"
          >
            <option value="all">全部类型</option>
            <option value="answer">答案修改</option>
            <option value="parameter">参数修改</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-200">
          {filteredRecords.map((record) => {
            const targetInfo = getTargetInfo(record);
            const Icon = targetInfo.icon;

            return (
              <div
                key={record.id}
                className="p-6 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Icon className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">
                          {targetInfo.name}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                          {record.targetType === 'answer' ? '答案' : '参数'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {record.operator}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {record.operatedAt}
                        </span>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm text-slate-600">
                          修改了{' '}
                          <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">
                            {record.fieldName}
                          </code>
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-4 max-w-lg">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">修改前</p>
                            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                              <p className="text-sm text-red-700">
                                {record.oldValue || '(空)'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 mb-1">修改后</p>
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                              <p className="text-sm text-emerald-700">
                                {record.newValue || '(空)'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(targetInfo.link)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    查看详情
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredRecords.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-slate-400">暂无历史记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
