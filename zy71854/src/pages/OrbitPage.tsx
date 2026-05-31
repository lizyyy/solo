import React, { useState } from 'react';
import { Orbit, Search, Filter, Check, Clock, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store';
import { KnowledgeTable } from '@/components/orbit/KnowledgeTable';
import { TracePanel } from '@/components/orbit/TracePanel';
import { KnowledgeStatus } from '@/types';
import { statusToText } from '@/utils/processing';

export const OrbitPage: React.FC = () => {
  const { knowledgePoints, filterStatus, setFilterStatus, setShowTracePanel } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPoints = knowledgePoints.filter((kp) => {
    const matchesStatus = filterStatus === 'all' || kp.status === filterStatus;
    const matchesSearch =
      searchQuery === '' ||
      kp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kp.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    all: knowledgePoints.length,
    confirmed: knowledgePoints.filter((k) => k.status === 'confirmed').length,
    pending: knowledgePoints.filter((k) => k.status === 'pending').length,
    modified: knowledgePoints.filter((k) => k.status === 'modified').length,
  };

  const statusFilters: { value: KnowledgeStatus | 'all'; icon: typeof Check; label: string }[] = [
    { value: 'all', icon: Filter, label: '全部' },
    { value: 'confirmed', icon: Check, label: '已确认' },
    { value: 'pending', icon: Clock, label: '待补' },
    { value: 'modified', icon: Sparkles, label: '人工修改' },
  ];

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-graphite flex items-center gap-3">
            <Orbit className="text-star-gold" />
            轨道讲解
          </h2>
          <p className="text-graphite-light mt-1">
            查看知识点总表，点击追溯链接查看原始依据
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite-light" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索知识点..."
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-space-blue focus:border-transparent w-64"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setFilterStatus(filter.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
              filterStatus === filter.value
                ? 'bg-space-deep text-white shadow-md'
                : 'bg-white text-graphite border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <filter.icon size={16} />
            <span>{statusToText(filter.value) || filter.label}</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                filterStatus === filter.value ? 'bg-white/20' : 'bg-slate-100'
              }`}
            >
              {statusCounts[filter.value]}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-xl border border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-green-700 text-sm font-medium">已确认</span>
              <Check size={20} className="text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-700 mt-2">{statusCounts.confirmed}</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-amber-700 text-sm font-medium">待补</span>
              <Clock size={20} className="text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-amber-700 mt-2">{statusCounts.pending}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
            <div className="flex items-center justify-between">
              <span className="text-purple-700 text-sm font-medium">人工修改</span>
              <Sparkles size={20} className="text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-700 mt-2">{statusCounts.modified}</p>
          </div>
          <div className="p-4 bg-space-deep/5 rounded-xl border border-space-blue/20">
            <div className="flex items-center justify-between">
              <span className="text-space-deep text-sm font-medium">总计</span>
              <Orbit size={20} className="text-star-gold" />
            </div>
            <p className="text-3xl font-bold text-space-deep mt-2">{statusCounts.all}</p>
          </div>
        </div>

        {filteredPoints.length === 0 ? (
          <div className="text-center py-12">
            <Orbit size={48} className="mx-auto text-graphite-light mb-4 opacity-50" />
            <p className="text-graphite-light">暂无匹配的知识点</p>
            <p className="text-sm text-slate-400 mt-1">
              请先在"数据管理"中导入演示脚本并生成知识点
            </p>
          </div>
        ) : (
          <KnowledgeTable knowledgePoints={filteredPoints} />
        )}
      </div>

      <TracePanel />
    </div>
  );
};
