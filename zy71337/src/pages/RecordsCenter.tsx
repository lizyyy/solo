import React from 'react';
import { Search, Filter, Calendar, User, Tag, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store';

const RecordsCenter: React.FC = () => {
  const { records, works } = useAppStore();

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="font-display text-xl font-bold text-white mb-1">记录中心</h2>
        <p className="text-sm text-slate-400">查看历史检索记录和作品管理</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="搜索记录..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <button className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 transition-all">
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {records.length > 0 ? (
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Search className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">{record.queryTitle}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {record.createdAt.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-slate-200">{record.resultsCount} 结果</div>
                        <div className="text-xs text-amber-400">
                          {record.highSimilarityCount} 高相似
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <Search className="w-12 h-12 mb-3 opacity-50" />
              <p>暂无检索记录</p>
              <p className="text-sm">在检索工作台开始第一次检索</p>
            </div>
          )}
        </div>

        <div className="w-80 border-l border-slate-700 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">作品管理</h3>

          <div className="space-y-4">
            {works.map((work) => (
              <div
                key={work.id}
                className="p-4 bg-slate-800/50 rounded-xl border border-slate-700"
              >
                <div className="font-medium text-slate-200">{work.title}</div>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3" />
                    {work.studentName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-3 h-3" />
                    {work.keySignature} 调
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {work.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
                  {work.remarks}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordsCenter;
