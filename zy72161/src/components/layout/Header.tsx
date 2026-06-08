import React, { useState } from 'react';
import { Map, AlertTriangle, FileText, Search, Filter, Download, Layers, X, Upload, RotateCcw } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useShelter } from '@/hooks/useShelter';
import { ShelterStatus, shelterStatusLabels } from '@/types';
import { cn } from '@/lib/utils';

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, openReportModal, openImportDialog } = useUIStore();
  const { filterStatus, searchKeyword, setFilterStatus, setSearchKeyword, is3DMode, toggle3DMode, stats, resetToDefault } = useShelter();
  const [showFilters, setShowFilters] = useState(false);

  const navItems = [
    { id: 'map', label: '地图总览', icon: Map },
    { id: 'conflicts', label: '冲突处理', icon: AlertTriangle, badge: stats.pending + stats.onsite },
    { id: 'report', label: '报告导出', icon: FileText }
  ];

  return (
    <header className="relative z-50 border-b border-gray-700/50 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30">
              <Map className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">应急避难场所容量管理</h1>
              <p className="text-xs text-gray-400">社区运营 · 应急管理</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                  activeTab === item.id
                    ? 'bg-blue-500/20 text-blue-400 shadow-inner'
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'map' && (
            <>
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="搜索点位名称..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-56 rounded-lg border border-gray-600 bg-gray-800/80 py-2 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 transition-all duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {searchKeyword && (
                  <button
                    onClick={() => setSearchKeyword('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200',
                    showFilters || filterStatus !== 'all'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                      : 'border-gray-600 bg-gray-800/80 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  )}
                >
                  <Filter className="h-4 w-4" />
                  筛选
                  {filterStatus !== 'all' && (
                    <span className="ml-1 rounded bg-blue-500 px-1.5 py-0.5 text-xs text-white">1</span>
                  )}
                </button>

                {showFilters && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-700 bg-gray-800 p-2 shadow-2xl">
                    <button
                      onClick={() => { setFilterStatus('all'); setShowFilters(false); }}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        filterStatus === 'all'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'text-gray-300 hover:bg-gray-700'
                      )}
                    >
                      全部状态
                    </button>
                    {Object.values(ShelterStatus).map((status) => (
                      <button
                        key={status}
                        onClick={() => { setFilterStatus(status); setShowFilters(false); }}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          filterStatus === status
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'text-gray-300 hover:bg-gray-700'
                        )}
                      >
                        {shelterStatusLabels[status]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={toggle3DMode}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200',
                  is3DMode
                    ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                    : 'border-gray-600 bg-gray-800/80 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                )}
              >
                <Layers className="h-4 w-4" />
                {is3DMode ? '3D模式' : '2D模式'}
              </button>
            </>
          )}

          <button
            onClick={openImportDialog}
            className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-400 transition-all duration-200 hover:bg-green-500/20"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden md:inline">导入台账</span>
          </button>

          {(activeTab === 'map' || activeTab === 'report') && (
            <button
              onClick={openReportModal}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/30 transition-all duration-200 hover:from-blue-600 hover:to-blue-700 hover:shadow-xl hover:shadow-blue-500/40"
            >
              <Download className="h-4 w-4" />
              导出报告
            </button>
          )}

          <button
            onClick={() => {
              if (confirm('确定要重置为默认样例数据吗？导入的数据将被清除。')) {
                resetToDefault();
              }
            }}
            className="flex items-center gap-1 rounded-lg border border-gray-700 px-2 py-2 text-xs text-gray-500 transition-all hover:border-gray-600 hover:text-gray-400"
            title="重置为默认数据"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
