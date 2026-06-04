import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  History,
  Search,
  Filter,
  ChevronDown,
  User,
  Clock,
  FileText,
  Image,
  Calculator,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import type { ChangeRecord } from '../../shared/types';

export const AuditCenter: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { changeRecords, loadChangeRecords, isLoading, calculations, screenshots, samplingIntervals } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<ChangeRecord | null>(null);

  const params = new URLSearchParams(location.search);
  const entityTypeParam = params.get('entityType');
  const entityIdParam = params.get('entityId');

  useEffect(() => {
    loadChangeRecords(
      entityTypeParam || undefined,
      entityIdParam || undefined
    );
  }, [entityTypeParam, entityIdParam]);

  const filteredRecords = changeRecords.filter((record) => {
    const matchesSearch = record.fieldName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.changedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.changeReason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = entityTypeFilter === 'all' || record.entityType === entityTypeFilter;
    return matchesSearch && matchesType;
  });

  const getEntityInfo = (record: ChangeRecord) => {
    if (record.entityType === 'calculation') {
      const calc = calculations.find(c => c.id === record.entityId);
      return {
        name: calc?.name || '未知计算',
        link: `/calculations/${record.entityId}`,
        icon: Calculator,
        color: 'text-cyan-400',
      };
    }
    if (record.entityType === 'screenshot') {
      const shot = screenshots.find(s => s.id === record.entityId);
      return {
        name: shot?.fileName || '未知截图',
        link: `/import`,
        icon: Image,
        color: 'text-purple-400',
      };
    }
    if (record.entityType === 'sampling_interval') {
      const interval = samplingIntervals.find(s => s.id === record.entityId);
      return {
        name: interval?.description || '未知采样间隔',
        link: `/import`,
        icon: Clock,
        color: 'text-emerald-400',
      };
    }
    return { name: '未知', link: '#', icon: FileText, color: 'text-slate-400' };
  };

  const getFieldLabel = (fieldName: string) => {
    const labels: Record<string, string> = {
      remark: '备注',
      status: '状态',
      riskLevel: '风险等级',
      riskScore: '风险评分',
      name: '名称',
      description: '描述',
      ocrData: 'OCR数据',
      extractedData: '提取数据',
      intervalMinutes: '采样间隔',
      startTime: '开始时间',
      endTime: '结束时间',
    };
    return labels[fieldName] || fieldName;
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return '空';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? '是' : '否';
    return String(value);
  };

  const stats = [
    { label: '总变更数', value: changeRecords.length, icon: History, color: 'from-cyan-500 to-blue-500' },
    { label: '计算变更', value: changeRecords.filter(r => r.entityType === 'calculation').length, icon: Calculator, color: 'from-purple-500 to-pink-500' },
    { label: '截图变更', value: changeRecords.filter(r => r.entityType === 'screenshot').length, icon: Image, color: 'from-amber-500 to-orange-500' },
    { label: '采样间隔变更', value: changeRecords.filter(r => r.entityType === 'sampling_interval').length, icon: Clock, color: 'from-emerald-500 to-green-500' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">加载变更记录中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {(entityTypeParam || entityIdParam) && (
          <button
            onClick={() => navigate('/audit')}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-1">
            {entityTypeParam || entityIdParam ? '变更详情' : '变更审计中心'}
          </h1>
          <p className="text-slate-400 text-sm">
            {entityTypeParam || entityIdParam
              ? `查看${entityTypeParam === 'calculation' ? '计算任务' : entityTypeParam === 'screenshot' ? '截图' : '采样间隔'}的完整变更历史`
              : '谁改了什么、为什么改、改完影响哪些结果，都要说清楚'
            }
          </p>
        </div>
      </div>

      {!entityTypeParam && !entityIdParam && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center',
                  stat.color
                )}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-slate-400">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-start gap-2 mb-4">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-xs text-cyan-300">
            变更审计中心完整记录所有操作的改前改后快照、变更人、变更原因和影响分析。实验老师林老师修改备注后，在这里能看到完整的追溯链条。
          </p>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索字段名、修改人或变更原因..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 w-72"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
            >
              <option value="all">全部类型</option>
              <option value="calculation">计算任务</option>
              <option value="screenshot">维修群截图</option>
              <option value="sampling_interval">采样间隔说明</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-slate-800">
              <History className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400">暂无变更记录</p>
            </div>
          ) : (
            filteredRecords.map((record) => {
              const entityInfo = getEntityInfo(record);
              const EntityIcon = entityInfo.icon;
              return (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-cyan-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-slate-200">{record.changedBy}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(record.changedAt).toLocaleString('zh-CN')}
                        </span>
                        <StatusBadge status={record.entityType === 'calculation' ? 'completed' : record.entityType === 'screenshot' ? 'processed' : 'resolved'} size="sm" />
                      </div>

                      <p className="text-sm text-slate-300 mb-2">
                        修改了 <span className="text-cyan-300 font-medium">{getFieldLabel(record.fieldName)}</span>
                      </p>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2.5 py-1 bg-red-500/10 text-red-300 rounded text-xs font-mono border border-red-500/20">
                          {formatValue(record.oldValue)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-300 rounded text-xs font-mono border border-emerald-500/20">
                          {formatValue(record.newValue)}
                        </span>
                      </div>

                      {record.changeReason && (
                        <p className="text-xs text-slate-400 mb-2">
                          <span className="text-slate-500">变更原因:</span> {record.changeReason}
                        </p>
                      )}

                      <div className="flex items-center gap-4">
                        <div
                          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(entityInfo.link);
                          }}
                        >
                          <EntityIcon className={cn('w-3.5 h-3.5', entityInfo.color)} />
                          <span>{entityInfo.name}</span>
                        </div>

                        {record.affectedResults.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>影响 {record.affectedResults.length} 个计算结果</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedRecord(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold">变更详情</h2>
              <p className="text-sm text-slate-400 mt-1">
                完整记录改前改后快照和影响分析
              </p>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-1">变更人</p>
                  <p className="font-medium">{selectedRecord.changedBy}</p>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-1">变更时间</p>
                  <p className="font-medium">{new Date(selectedRecord.changedAt).toLocaleString('zh-CN')}</p>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-2">修改字段</p>
                <p className="text-lg font-medium text-cyan-300">{getFieldLabel(selectedRecord.fieldName)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-red-300">修改前</span>
                  </div>
                  <p className="font-mono text-sm text-slate-200 bg-slate-900/50 rounded-lg p-3 break-all">
                    {formatValue(selectedRecord.oldValue)}
                  </p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-300">修改后</span>
                  </div>
                  <p className="font-mono text-sm text-slate-200 bg-slate-900/50 rounded-lg p-3 break-all">
                    {formatValue(selectedRecord.newValue)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                <p className="text-xs text-slate-500 mb-2">变更原因</p>
                <p className="text-slate-200">{selectedRecord.changeReason || '未填写变更原因'}</p>
              </div>

              {selectedRecord.affectedResults.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-300">影响的计算结果</span>
                  </div>
                  <ul className="space-y-2">
                    {selectedRecord.affectedResults.map((result, idx) => (
                      <li key={idx} className="text-sm text-slate-300 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {result}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
