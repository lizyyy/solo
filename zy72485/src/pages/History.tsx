import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  Search,
  Filter,
  User,
  Clock,
  ArrowRight,
  FileText,
  Accessibility,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../store';
import { labelMap } from '../data/mockData';

export default function HistoryPage() {
  const { changeLogs, notices, ramps, points } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const filteredLogs = changeLogs.filter(log => {
    const matchesSearch = log.reason.includes(searchTerm) ||
      log.operatorName.includes(searchTerm) ||
      JSON.stringify(log.affectedResults).includes(searchTerm);
    const matchesEntity = entityFilter === 'all' || log.entityType === entityFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesEntity && matchesAction;
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'notice': return <FileText className="w-4 h-4" />;
      case 'ramp': return <Accessibility className="w-4 h-4" />;
      case 'point': return <MapPin className="w-4 h-4" />;
      default: return null;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return <Plus className="w-3.5 h-3.5" />;
      case 'update': return <Edit className="w-3.5 h-3.5" />;
      case 'delete': return <Trash2 className="w-3.5 h-3.5" />;
      case 'import': return <Upload className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-emerald-100 text-emerald-700';
      case 'update': return 'bg-blue-100 text-blue-700';
      case 'delete': return 'bg-rose-100 text-rose-700';
      case 'import': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getEntityName = (log: any) => {
    switch (log.entityType) {
      case 'notice':
        return notices.find(n => n.id === log.entityId)?.title || '已删除';
      case 'ramp':
        return ramps.find(r => r.id === log.entityId)?.location || '已删除';
      case 'point':
        return points.find(p => p.id === log.entityId)?.name || '已删除';
      default:
        return '未知';
    }
  };

  const formatValue = (val: any) => {
    if (val === null || val === undefined || val === '') return '空';
    if (typeof val === 'boolean') return val ? '是' : '否';
    return String(val);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-slate-800">变更历史</h2>
          <p className="text-slate-500 text-sm mt-1">完整记录谁改了什么、为什么改、改完影响哪些结果</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索变更原因、操作人、影响结果..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="input-field w-36"
          >
            <option value="all">全部类型</option>
            <option value="notice">施工告示</option>
            <option value="ramp">坡道记录</option>
            <option value="point">点位</option>
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input-field w-36"
          >
            <option value="all">全部操作</option>
            <option value="create">创建</option>
            <option value="update">更新</option>
            <option value="delete">删除</option>
            <option value="import">导入</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="divide-y divide-slate-100">
          {filteredLogs.map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <div
                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-800">{log.operatorName}</span>
                      <span className="text-slate-400">
                        {labelMap.actionType[log.action]}
                      </span>
                      <span className="text-slate-400">{getEntityIcon(log.entityType)}</span>
                      <span className="text-primary text-sm">{getEntityName(log)}</span>
                    </div>
                    <p className="text-sm text-slate-600">{log.reason}</p>
                    {log.affectedResults.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <ArrowRight className="w-3 h-3" />
                        <span>影响：{log.affectedResults.join('、')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {new Date(log.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <p className="text-xs text-slate-400">
                        {new Date(log.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    {expandedLog === log.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              {expandedLog === log.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4"
                >
                  <div className="ml-12 p-4 bg-slate-50 rounded-xl space-y-4">
                    {(log.beforeChange && Object.keys(log.beforeChange).length > 0) && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">🔴 变更前</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(log.beforeChange).map(([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="text-slate-500">{key}：</span>
                              <span className="text-rose-700 line-through">{formatValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">🟢 变更后</p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(log.afterChange).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="text-slate-500">{key}：</span>
                            <span className="text-emerald-700 font-medium">{formatValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500">操作人 ID：</span>
                        <span className="text-slate-700 font-mono">{log.operatorId}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <p className="text-sm text-emerald-800">
          ✅ <strong>完整审计追踪：</strong>所有操作均记录在案，包括谁在什么时间做了什么修改、修改前后的对比、以及修改对系统产生了哪些影响。确保数据变更透明可追溯。
        </p>
      </div>
    </motion.div>
  );
}
