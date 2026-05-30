import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { HistoryTable } from '@/components/tables/HistoryTable';
import { DataCard } from '@/components/common/DataCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useAppStore } from '@/store/useAppStore';
import { getRecentHistory } from '@/services/historyService';
import { Clock, User, FileText, AlertTriangle, Activity, Database } from 'lucide-react';

const History: React.FC = () => {
  const { history, setHistory, loadDashboardData } = useAppStore();
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFullHistory();
  }, []);

  const loadFullHistory = async () => {
    setLoading(true);
    try {
      const records = await getRecentHistory(100);
      setHistory(records);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter((record) => {
    if (filterEntity !== 'all' && record.entityType !== filterEntity) return false;
    if (filterAction !== 'all' && record.action !== filterAction) return false;
    return true;
  });

  const actionCounts = history.reduce((acc, record) => {
    acc[record.action] = (acc[record.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const entityCounts = history.reduce((acc, record) => {
    acc[record.entityType] = (acc[record.entityType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const iconMap: Record<string, React.ReactNode> = {
    anomaly: <AlertTriangle size={18} />,
    sample: <Activity size={18} />,
    segment: <Database size={18} />,
    report: <FileText size={18} />,
    batch: <Database size={18} />,
  };

  const entityOptions = [
    { value: 'all', label: '全部实体' },
    { value: 'anomaly', label: '异常事件' },
    { value: 'sample', label: '采样数据' },
    { value: 'segment', label: '工况段' },
    { value: 'report', label: '分析报告' },
    { value: 'batch', label: '导入批次' },
  ];

  const actionOptions = [
    { value: 'all', label: '全部操作' },
    { value: 'created', label: '创建' },
    { value: 'updated', label: '更新' },
    { value: 'confirmed', label: '确认' },
    { value: 'dismissed', label: '忽略' },
    { value: 'corrected', label: '修正' },
    { value: 'exported', label: '导出' },
    { value: 'imported', label: '导入' },
  ];

  return (
    <MainLayout onRefresh={loadFullHistory}>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">操作历史</h1>
            <p className="text-sm text-slate-400 mt-1">
              全链路审计追踪 · 所有状态变更完整记录
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-sm border border-slate-700">
              <Clock size={14} className="text-slate-400" />
              <span className="text-sm text-slate-300">
                最近 24 小时
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {Object.entries(entityCounts).map(([entity, count]) => (
            <DataCard
              key={entity}
              title={entity === 'anomaly' ? '异常事件' : 
                     entity === 'sample' ? '采样数据' :
                     entity === 'segment' ? '工况段' :
                     entity === 'report' ? '分析报告' : '导入批次'}
              value={count.toString()}
              unit="次"
              icon={iconMap[entity]}
              highlight={entity === 'anomaly' && count > 0}
            />
          ))}
        </div>

        <div className="grid grid-cols-4 gap-4">
          {Object.entries(actionCounts).map(([action, count]) => (
            <DataCard
              key={action}
              title={action === 'created' ? '创建' :
                     action === 'updated' ? '更新' :
                     action === 'confirmed' ? '确认' :
                     action === 'dismissed' ? '忽略' :
                     action === 'corrected' ? '修正' :
                     action === 'exported' ? '导出' :
                     action === 'imported' ? '导入' : action}
              value={count.toString()}
              unit="次"
              icon={<User size={18} />}
            />
          ))}
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">筛选:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">实体类型</span>
              <select
                className="input py-1.5 text-sm w-36"
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
              >
                {entityOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">操作类型</span>
              <select
                className="input py-1.5 text-sm w-36"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              >
                {actionOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-500 ml-auto">
              显示 {filteredHistory.length} / {history.length} 条记录
            </span>
          </div>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-sm">
          <div className="flex items-start gap-3">
            <div className="text-blue-400 mt-0.5">
              <Clock size={18} />
            </div>
            <div>
              <div className="text-sm text-blue-400 font-medium mb-1">事件溯源说明</div>
              <div className="text-xs text-slate-400">
                所有状态变更均通过事件记录，原始数据导入后不可修改。
                每条历史记录保存完整的 beforeState 和 afterState，可对比确认前后变化。
                人工确认动作（异常确认、标记误报）会记录操作人、时间和备注。
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="card p-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-sm text-slate-400">正在加载历史记录...</div>
          </div>
        ) : (
          <HistoryTable history={filteredHistory} />
        )}

        <div className="bg-slate-800/30 border border-slate-700/50 p-4 rounded-sm">
          <div className="text-xs text-slate-400 mb-2">人工确认记录示例（点击详情查看前后变化对比）：</div>
          <div className="flex flex-wrap gap-3">
            {history.filter(h => h.action === 'confirmed' || h.action === 'dismissed').slice(0, 5).map(record => (
              <div key={record.id} className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-sm text-xs">
                <StatusBadge type="action" value={record.action} />
                <span className="text-slate-400">{record.operator}</span>
                <span className="text-slate-500">→</span>
                <span className="font-mono text-slate-300">#{record.entityId.slice(-8)}</span>
                {record.comment && (
                  <span className="text-slate-500 italic">"{record.comment}"</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default History;
