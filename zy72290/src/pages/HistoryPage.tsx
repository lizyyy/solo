import { History, Clock, CheckCircle2, AlertTriangle, RefreshCw, User } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const scenarioTabs = [
  { id: 'rec-001', label: '顺利记录', code: 'HD-A01', icon: CheckCircle2, color: 'emerald' },
  { id: 'rec-002', label: '缺行记录', code: 'HD-B03', icon: AlertTriangle, color: 'amber' },
  { id: 'rec-003', label: '补录记录', code: 'HD-C07', icon: RefreshCw, color: 'sky' },
];

export default function HistoryPage() {
  const { historyLogs, pointRecords, getLogsByRecordId } = useAppStore();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const displayLogs = activeTab
    ? getLogsByRecordId(activeTab)
    : [...historyLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const getRecordByPointCode = (pointCode: string) => {
    return pointRecords.find(r => r.pointCode === pointCode);
  };

  const getActionIcon = (action: string) => {
    if (action.includes('导入')) return '📥';
    if (action.includes('检测')) return '🔍';
    if (action.includes('标记')) return '🏷️';
    if (action.includes('查看')) return '👁️';
    if (action.includes('补录')) return '➕';
    if (action.includes('复核')) return '✅';
    if (action.includes('更新')) return '🔄';
    return '📋';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">历史记录</h2>
        <p className="text-slate-500 mt-1">查看完整操作日志，对比三种场景的处理结果</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-700 mb-4">三种场景处理链路对比</h3>
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab(null)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === null
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            全部记录
          </button>
          {scenarioTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id && tab.color === 'emerald' && 'bg-emerald-600 text-white',
                  activeTab === tab.id && tab.color === 'amber' && 'bg-amber-600 text-white',
                  activeTab === tab.id && tab.color === 'sky' && 'bg-sky-600 text-white',
                  activeTab !== tab.id && 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          {scenarioTabs.map((tab) => {
            const Icon = tab.icon;
            const record = pointRecords.find(r => r.id === tab.id);
            const logs = getLogsByRecordId(tab.id);
            return (
              <div
                key={tab.id}
                className={cn(
                  'rounded-xl p-5 border cursor-pointer transition-all',
                  activeTab === tab.id && tab.color === 'emerald' && 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500',
                  activeTab === tab.id && tab.color === 'amber' && 'bg-amber-50 border-amber-300 ring-2 ring-amber-500',
                  activeTab === tab.id && tab.color === 'sky' && 'bg-sky-50 border-sky-300 ring-2 ring-sky-500',
                  activeTab !== tab.id && 'bg-slate-50 border-slate-200 hover:border-slate-300'
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn(
                    tab.color === 'emerald' && 'text-emerald-500',
                    tab.color === 'amber' && 'text-amber-500',
                    tab.color === 'sky' && 'text-sky-500'
                  )} size={20} />
                  <span className="font-semibold text-slate-800">{tab.code}</span>
                  <span className="text-sm text-slate-500">{tab.label}</span>
                </div>
                <div className="space-y-2">
                  {logs.slice(0, 4).map((log, i) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs">
                      <span>{getActionIcon(log.action)}</span>
                      <span className="text-slate-600 truncate">{log.action}</span>
                    </div>
                  ))}
                  {logs.length > 4 && (
                    <p className="text-xs text-slate-400">+{logs.length - 4} 更多操作...</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">操作时间线</h4>
          <div className="space-y-4">
            {displayLogs.map((log, index) => {
              const record = pointRecords.find(r => r.id === log.recordId);
              return (
                <div key={log.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-lg',
                      record?.status === 'normal' && 'bg-emerald-100',
                      record?.status === 'pending_review' && 'bg-amber-100',
                      record?.status === 'supplemented' && 'bg-sky-100'
                    )}>
                      {getActionIcon(log.action)}
                    </div>
                    {index < displayLogs.length - 1 && (
                      <div className="w-0.5 h-full bg-slate-200 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{log.action}</span>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          record?.status === 'normal' && 'bg-emerald-100 text-emerald-700',
                          record?.status === 'pending_review' && 'bg-amber-100 text-amber-700',
                          record?.status === 'supplemented' && 'bg-sky-100 text-sky-700'
                        )}>
                          {record?.pointCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          {log.operator}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {log.timestamp}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{log.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-700 mb-4">关键流程节点说明</h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-lg">
            <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-emerald-800">顺利通过流程</p>
              <p className="text-sm text-emerald-700 mt-1">
                导入安全半径表 → 数据完整性检测通过 → 查看坐标原点说明 → 更新遮挡点清单
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-lg">
            <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-amber-800">缺行待复核流程</p>
              <p className="text-sm text-amber-700 mt-1">
                导入安全半径表 → 检测到照片有点位但坐标表缺一行 → 标记为待安全员复核（不归正常）
                → 查看坐标原点说明 → 提交安全复核流程
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-sky-50 rounded-lg">
            <RefreshCw className="text-sky-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-sky-800">补录旧口径流程</p>
              <p className="text-sm text-sky-700 mt-1">
                导入安全半径表 → 检测到缺行标记待复核 → 查看坐标原点说明找到旧口径基准
                → 补录缺失数据 → 安全员复核通过 → 更新遮挡点清单
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
