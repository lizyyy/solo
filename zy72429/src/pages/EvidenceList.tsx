import { useState } from 'react';
import { Music, User, Store } from 'lucide-react';
import { useEvidenceStore } from '../store/useEvidenceStore';
import { EvidenceCard } from '../components/EvidenceCard';
import type { EvidenceStatus, Operator } from '../types';
import { cn } from '../lib/utils';

const statusTabs: { key: EvidenceStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'processing', label: '处理中' },
  { key: 'manager_review', label: '待店长复核' },
  { key: 'completed', label: '已完成' },
];

const roles: { key: Operator; label: string; icon: any }[] = [
  { key: '阿梅', label: '巡演统筹 阿梅', icon: User },
  { key: '店长', label: '店长', icon: Store },
];

export function EvidenceList() {
  const { evidencePacks, currentRole, setCurrentRole } = useEvidenceStore();
  const [activeTab, setActiveTab] = useState<EvidenceStatus | 'all'>('all');

  const filteredPacks =
    activeTab === 'all'
      ? evidencePacks
      : evidencePacks.filter((p) => p.status === activeTab);

  const getStatusCount = (status: EvidenceStatus | 'all') => {
    if (status === 'all') return evidencePacks.length;
    return evidencePacks.filter((p) => p.status === status).length;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                <Music className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-800">音乐版权投诉证据包</h1>
                <p className="text-xs text-gray-500">版权投诉处理与证据追溯系统</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {roles.map((role) => {
                const RoleIcon = role.icon;
                const isActive = currentRole === role.key;
                return (
                  <button
                    key={role.key}
                    onClick={() => setCurrentRole(role.key)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'bg-slate-700 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <RoleIcon className="w-4 h-4" />
                    {role.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">投诉记录列表</h2>
          <p className="text-gray-500">
            当前角色：<span className="font-medium text-slate-700">{currentRole}</span>
            ，共 {evidencePacks.length} 条记录
          </p>
        </div>

        <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-100 mb-6 inline-flex">
          {statusTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = getStatusCount(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'ml-2 px-2 py-0.5 rounded-full text-xs',
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPacks.map((evidence) => (
            <EvidenceCard key={evidence.id} evidence={evidence} />
          ))}
        </div>

        {filteredPacks.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Music className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">暂无该状态的记录</p>
          </div>
        )}
      </main>
    </div>
  );
}
