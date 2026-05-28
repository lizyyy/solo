import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, AlertCircle, AlertTriangle, Info, CheckCircle2, Clock, Edit3, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProcessingLogEntry } from '@/types/tour';

interface ProcessingLogPanelProps {
  logs: ProcessingLogEntry[];
  onResolve?: (logId: string, userValue: string) => void;
}

function getTypeLabel(type: ProcessingLogEntry['type']) {
  const labels: Record<ProcessingLogEntry['type'], string> = {
    missing_value: '缺失值',
    format_error: '格式错误',
    logic_error: '逻辑错误',
    outlier: '异常值',
    info: '信息',
  };
  return labels[type] || '未知';
}

function getTypeColor(type: ProcessingLogEntry['type']) {
  switch (type) {
    case 'missing_value':
      return {
        text: 'text-warning-orange',
        bg: 'bg-warning-orange',
        border: 'border-warning-orange',
      };
    case 'format_error':
    case 'logic_error':
      return {
        text: 'text-danger-red',
        bg: 'bg-danger-red',
        border: 'border-danger-red',
      };
    case 'outlier':
      return {
        text: 'text-neon-purple',
        bg: 'bg-neon-purple',
        border: 'border-neon-purple',
      };
    case 'info':
    default:
      return {
        text: 'text-neon-cyan',
        bg: 'bg-neon-cyan',
        border: 'border-neon-cyan',
      };
  }
}

function getSeverityIcon(severity: ProcessingLogEntry['severity']) {
  switch (severity) {
    case 'error':
      return AlertCircle;
    case 'warning':
      return AlertTriangle;
    case 'info':
    default:
      return Info;
  }
}

function getPriorityLabel(priority: number) {
  if (priority >= 90) return { label: '紧急', color: 'text-danger-red' };
  if (priority >= 70) return { label: '高', color: 'text-warning-orange' };
  if (priority >= 40) return { label: '中', color: 'text-neon-cyan' };
  return { label: '低', color: 'text-rock-light' };
}

interface LogItemProps {
  log: ProcessingLogEntry;
  onResolve?: (logId: string, userValue: string) => void;
  delay: number;
}

function LogItem({ log, onResolve, delay }: LogItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(log.cleanedValue || '');
  const typeColors = getTypeColor(log.type);
  const SeverityIcon = getSeverityIcon(log.severity);
  const priorityInfo = getPriorityLabel(log.priority);

  const handleResolve = () => {
    if (inputValue.trim()) {
      onResolve?.(log.id, inputValue.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setInputValue(log.cleanedValue || '');
    setIsEditing(false);
  };

  return (
    <motion.div
      className={cn(
        'relative p-4 border rounded-xl overflow-hidden transition-all duration-300',
        log.resolved
          ? 'bg-rock-darker/30 border-rock-light/30'
          : 'bg-rock-darker/50 border-rock-light hover:border-rock-light/80'
      )}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <div className={cn(
        'absolute top-0 left-0 w-1 h-full',
        typeColors.bg,
        log.resolved && 'opacity-30'
      )} />

      <div className="flex items-start gap-4">
        <div className={cn(
          'p-2 rounded-lg flex-shrink-0',
          `${typeColors.bg}/20`,
          log.resolved && 'opacity-50'
        )}>
          <SeverityIcon className={cn('w-5 h-5', typeColors.text, log.resolved && 'opacity-50')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-bold',
              `${typeColors.bg}/20`,
              typeColors.text,
              log.resolved && 'opacity-50'
            )}>
              {getTypeLabel(log.type)}
            </span>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-bold bg-rock-light/20',
              priorityInfo.color,
              log.resolved && 'opacity-50'
            )}>
              优先级: {priorityInfo.label} ({log.priority})
            </span>
            {log.resolved && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-success-green/20 text-success-green">
                已处理
              </span>
            )}
            {log.requiresUserAction && !log.resolved && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-neon-pink/20 text-neon-pink animate-pulse">
                需人工处理
              </span>
            )}
          </div>

          <h4 className={cn(
            'font-bold text-sm mb-1',
            log.resolved ? 'text-rock-light' : 'text-white'
          )}>
            {log.message}
          </h4>

          <div className="text-xs text-rock-light mb-2">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              字段: {log.field}
              {log.rowIndex !== undefined && ` | 行号: ${log.rowIndex}`}
            </span>
          </div>

          <div className="flex items-center gap-3 p-3 bg-rock-darker/50 rounded-lg mb-3">
            <div className="flex-1">
              <div className="text-[10px] text-rock-light mb-1">原始值</div>
              <div className={cn(
                'font-mono text-sm line-through decoration-danger-red/50',
                log.resolved ? 'text-rock-light' : 'text-danger-red'
              )}>
                {log.originalValue || '(空)'}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-rock-light flex-shrink-0" />
            <div className="flex-1">
              <div className="text-[10px] text-rock-light mb-1">清洗后值</div>
              <div className={cn(
                'font-mono text-sm',
                log.resolved ? 'text-rock-light' : 'text-success-green'
              )}>
                {log.cleanedValue || log.userOverride || '(空)'}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {log.requiresUserAction && !log.resolved && !isEditing && (
              <motion.button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-neon-cyan border border-neon-cyan/50 rounded-lg hover:bg-neon-cyan/10 transition-colors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Edit3 className="w-3 h-3" />
                修改值
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isEditing && (
              <motion.div
                className="mt-3 p-3 bg-rock-darker border border-neon-cyan/30 rounded-lg"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="text-xs text-rock-light mb-2">输入修正后的值：</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-rock-dark border border-rock-light rounded-lg text-white focus:outline-none focus:border-neon-cyan font-mono"
                    placeholder="输入修正后的值..."
                    autoFocus
                  />
                  <button
                    onClick={handleResolve}
                    className="px-4 py-2 text-xs font-bold text-white bg-success-green rounded-lg hover:bg-success-green/80 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-xs font-bold text-white bg-rock-light rounded-lg hover:bg-rock-light/80 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {log.resolved && (
          <CheckCircle2 className="w-5 h-5 text-success-green flex-shrink-0" />
        )}
      </div>
    </motion.div>
  );
}

export default function ProcessingLogPanel({ logs, onResolve }: ProcessingLogPanelProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [typeFilter, setTypeFilter] = useState<ProcessingLogEntry['type'] | 'all'>('all');

  const sortedLogs = [...logs].sort((a, b) => b.priority - a.priority);

  const filteredLogs = sortedLogs.filter(log => {
    if (filter === 'pending' && log.resolved) return false;
    if (filter === 'resolved' && !log.resolved) return false;
    if (typeFilter !== 'all' && log.type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: logs.length,
    resolved: logs.filter(l => l.resolved).length,
    pending: logs.filter(l => !l.resolved).length,
    requiresAction: logs.filter(l => l.requiresUserAction && !l.resolved).length,
  };

  const logTypes: Array<{ type: ProcessingLogEntry['type'] | 'all'; label: string }> = [
    { type: 'all', label: '全部' },
    { type: 'missing_value', label: '缺失值' },
    { type: 'format_error', label: '格式错误' },
    { type: 'logic_error', label: '逻辑错误' },
    { type: 'outlier', label: '异常值' },
    { type: 'info', label: '信息' },
  ];

  return (
    <div className="w-full p-6 bg-rock-dark/80 backdrop-blur-sm border border-rock-light rounded-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-neon-pink" />
          <h2 className="text-xl font-rock text-white tracking-wider">数据处理日志</h2>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-danger-red" />
            <span className="text-rock-light">待处理: <span className="text-danger-red font-bold">{stats.pending}</span></span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-success-green" />
            <span className="text-rock-light">已完成: <span className="text-success-green font-bold">{stats.resolved}</span></span>
          </div>
          {stats.requiresAction > 0 && (
            <div className="flex items-center gap-1 animate-pulse">
              <Edit3 className="w-3 h-3 text-neon-pink" />
              <span className="text-rock-light">需人工: <span className="text-neon-pink font-bold">{stats.requiresAction}</span></span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <motion.div
          className="p-3 bg-rock-darker/50 border border-rock-light rounded-lg text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="text-2xl font-bold text-neon-cyan font-mono">{stats.total}</div>
          <div className="text-xs text-rock-light">总条目</div>
        </motion.div>
        <motion.div
          className="p-3 bg-rock-darker/50 border border-rock-light rounded-lg text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="text-2xl font-bold text-success-green font-mono">{stats.resolved}</div>
          <div className="text-xs text-rock-light">已解决</div>
        </motion.div>
        <motion.div
          className="p-3 bg-rock-darker/50 border border-rock-light rounded-lg text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-2xl font-bold text-warning-orange font-mono">{stats.pending}</div>
          <div className="text-xs text-rock-light">待处理</div>
        </motion.div>
        <motion.div
          className="p-3 bg-rock-darker/50 border border-rock-light rounded-lg text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="text-2xl font-bold text-neon-pink font-mono">{stats.requiresAction}</div>
          <div className="text-xs text-rock-light">需人工</div>
        </motion.div>
      </div>

      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {(['all', 'pending', 'resolved'] as const).map((f, index) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 whitespace-nowrap',
                filter === f
                  ? 'bg-neon-cyan text-white shadow-neon-cyan'
                  : 'bg-rock-darker/50 text-rock-light hover:text-white border border-rock-light'
              )}
            >
              {f === 'all' ? '全部' : f === 'pending' ? '待处理' : '已解决'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {logTypes.map(({ type, label }) => {
            const colors = type === 'all'
              ? { text: 'text-white', bg: 'bg-neon-cyan' }
              : getTypeColor(type);
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  'px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 whitespace-nowrap',
                  typeFilter === type
                    ? `${colors.bg} ${colors.text} shadow-neon-cyan text-white`
                    : 'bg-rock-darker/50 text-rock-light hover:text-white border border-rock-light'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredLogs.map((log, index) => (
            <LogItem
              key={log.id}
              log={log}
              onResolve={onResolve}
              delay={index * 0.05}
            />
          ))}
        </AnimatePresence>

        {filteredLogs.length === 0 && (
          <motion.div
            className="text-center py-12 text-rock-light"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无匹配的日志条目</p>
          </motion.div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-6 pt-4 border-t border-rock-light">
          <div className="flex items-center justify-between text-xs">
            <div className="text-rock-light">
              处理进度: <span className="text-neon-cyan font-bold">{((stats.resolved / stats.total) * 100).toFixed(1)}%</span>
            </div>
            <div className="h-1.5 flex-1 max-w-xs bg-rock-gray rounded-full overflow-hidden mx-4">
              <motion.div
                className="h-full bg-gradient-to-r from-neon-cyan to-success-green rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(stats.resolved / stats.total) * 100}%` }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
            <div className="text-rock-light">
              {stats.resolved}/{stats.total}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
