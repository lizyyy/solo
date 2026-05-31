import React, { useState } from 'react';
import { FileText, Download, Filter, Check, Clock, Sparkles, Calendar, Search } from 'lucide-react';
import { useAppStore } from '@/store';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProcessingBadge } from '@/components/common/ProcessingBadge';
import { KnowledgeStatus, ExportFilters } from '@/types';
import { exportToCSV } from '@/utils/export';
import { statusToText } from '@/utils/processing';

export const RecordsPage: React.FC = () => {
  const { knowledgePoints, scripts, parts, notes, setShowTracePanel } = useAppStore();
  const [activeTab, setActiveTab] = useState<KnowledgeStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs: { value: KnowledgeStatus | 'all'; icon: typeof Check; label: string }[] = [
    { value: 'all', icon: FileText, label: '全部记录' },
    { value: 'confirmed', icon: Check, label: '已确认' },
    { value: 'pending', icon: Clock, label: '待补' },
    { value: 'modified', icon: Sparkles, label: '人工修改' },
  ];

  const filteredRecords = knowledgePoints.filter((kp) => {
    const matchesTab = activeTab === 'all' || kp.status === activeTab;
    const matchesDateFrom = !dateFrom || kp.updatedAt >= dateFrom;
    const matchesDateTo = !dateTo || kp.updatedAt <= dateTo + ' 23:59:59';
    const matchesSearch =
      searchQuery === '' ||
      kp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kp.processingRule.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesDateFrom && matchesDateTo && matchesSearch;
  });

  const tabCounts = {
    all: knowledgePoints.length,
    confirmed: knowledgePoints.filter((k) => k.status === 'confirmed').length,
    pending: knowledgePoints.filter((k) => k.status === 'pending').length,
    modified: knowledgePoints.filter((k) => k.status === 'modified').length,
  };

  const handleExport = () => {
    const filters: ExportFilters = {
      status: activeTab,
      dateFrom,
      dateTo,
    };
    exportToCSV(filteredRecords, filters, scripts, parts, notes);
  };

  const getTabColor = (status: KnowledgeStatus | 'all') => {
    switch (status) {
      case 'confirmed':
        return 'border-status-confirmed text-status-confirmed bg-green-50';
      case 'pending':
        return 'border-status-pending text-status-pending bg-amber-50';
      case 'modified':
        return 'border-status-modified text-status-modified bg-purple-50';
      default:
        return 'border-space-blue text-space-blue bg-blue-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-graphite flex items-center gap-3">
            <FileText className="text-star-gold" />
            课堂记录
          </h2>
          <p className="text-graphite-light mt-1">
            分类查看课堂记录，带处理口径导出供教研负责人审阅
          </p>
        </div>
        <button
          onClick={handleExport}
          className="btn-gold flex items-center gap-2"
        >
          <Download size={16} />
          导出当前筛选结果
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2 flex-1">
            <Search size={18} className="text-graphite-light" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标题或处理口径..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-space-blue focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-graphite-light" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-space-blue focus:border-transparent"
            />
            <span className="text-graphite-light">至</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-space-blue focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-graphite-light" />
            <span className="text-sm text-graphite-light">
              筛选结果：{filteredRecords.length} 条
            </span>
          </div>
        </div>

        <div className="flex border-b border-slate-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 -mb-px transition-all duration-200 ${
                activeTab === tab.value
                  ? getTabColor(tab.value)
                  : 'border-transparent text-graphite-light hover:text-graphite'
              }`}
            >
              <tab.icon size={18} />
              <span className="font-medium">{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  activeTab === tab.value ? 'bg-white/80' : 'bg-slate-100'
                }`}
              >
                {tabCounts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-graphite-light mb-4 opacity-50" />
              <p className="text-graphite-light">暂无{statusToText(activeTab) || ''}记录</p>
            </div>
          ) : (
            filteredRecords.map((record) => (
              <div
                key={record.id}
                className="p-5 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={record.status} />
                    <span className="text-xs font-mono text-graphite-light">{record.id}</span>
                  </div>
                  <button
                    onClick={() => setShowTracePanel(true, record.id)}
                    className="text-space-blue text-sm hover:underline flex items-center gap-1"
                  >
                    查看原始依据 →
                  </button>
                </div>

                <h4 className="font-serif font-semibold text-lg text-graphite mb-2">
                  {record.title}
                </h4>
                <p className="text-graphite-light text-sm mb-4 leading-relaxed">
                  {record.content}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-4 text-xs text-graphite-light">
                    <span>创建：{record.createdAt}</span>
                    <span>更新：{record.updatedAt}</span>
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      脚本 {record.scriptReferences.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                      </svg>
                      零件 {record.partReferences.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>
                      </svg>
                      备注 {record.noteReferences.length}
                    </span>
                  </div>
                  <ProcessingBadge rule={record.processingRule} />
                </div>

                {record.manualEditReason && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-700">
                      <strong>修改原因：</strong>
                      {record.manualEditReason}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card bg-space-deep/5">
        <h4 className="font-serif font-semibold text-graphite mb-3">导出说明</h4>
        <ul className="text-sm text-graphite-light space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-star-gold">•</span>
            导出的 CSV 文件首行会包含处理口径说明，记录筛选条件和导出时间
          </li>
          <li className="flex items-start gap-2">
            <span className="text-star-gold">•</span>
            文件名格式：课堂记录_筛选状态_日期时间.csv，确保历史版本可追溯
          </li>
          <li className="flex items-start gap-2">
            <span className="text-star-gold">•</span>
            导出内容包含：知识点标题、内容、状态、关联脚本/零件/备注、处理口径、修改原因
          </li>
        </ul>
      </div>
    </div>
  );
};
