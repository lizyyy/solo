import { useEffect, useState } from 'react';
import {
  ScrollText,
  Clock,
  User,
  Copy,
  Check,
  Terminal,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useAuditStore } from '../store/auditStore';
import type { AuditLog, LogActionType } from '../types';
import { formatTimestamp } from '../utils/checksum';
import { ACTION_TYPE_LABELS } from '../types';

export function AuditLogPage() {
  const { logs, loadLogs, isLoading, exportLogsToCsv } = useAuditStore();
  const [filterAction, setFilterAction] = useState<LogActionType | 'all'>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const copyCommand = async (log: AuditLog) => {
    if (log.rerunnableCommand) {
      await navigator.clipboard.writeText(log.rerunnableCommand);
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const filteredLogs = filterAction === 'all'
    ? logs
    : logs.filter((log) => log.actionType === filterAction);

  const actionTypes = Array.from(new Set(logs.map((log) => log.actionType))) as LogActionType[];

  const getActionColor = (actionType: LogActionType) => {
    switch (actionType) {
      case 'import':
      case 'supplement':
      case 'occlusion_update':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'review':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'recalculate':
        return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'self_check':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'export':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getActionIcon = (actionType: LogActionType) => {
    switch (actionType) {
      case 'import':
        return <FileText className="w-4 h-4" />;
      case 'review':
        return <AlertCircle className="w-4 h-4" />;
      case 'recalculate':
        return <Terminal className="w-4 h-4" />;
      case 'export':
        return <Download className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Terminal className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">复盘记录</h1>
          <p className="text-sm text-gray-500 mt-1">
            完整操作时间线，每条记录都有可重跑命令，支持一键复现
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as LogActionType | 'all')}
              className="input-industrial text-sm"
            >
              <option value="all">全部操作</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {ACTION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={exportLogsToCsv}
            className="btn-industrial-outline flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            导出日志
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="card-industrial p-12 text-center">
          <ScrollText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">暂无操作记录</h3>
          <p className="text-sm text-gray-400">
            开始操作后，所有关键操作将被记录在此处，包含可重跑命令
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-3">
            {filteredLogs.map((log, index) => {
              const isExpanded = expandedLog === log.id;
              const isCopied = copiedId === log.id;

              return (
                <div key={log.id} className="relative pl-14">
                  <div
                    className={`absolute left-4 w-5 h-5 rounded-full border-4 ${
                      log.actionType === 'error'
                        ? 'bg-white border-danger-500'
                        : log.actionType === 'review'
                        ? 'bg-white border-warning-500'
                        : 'bg-white border-primary-600'
                    }`}
                    style={{
                      boxShadow: '0 0 0 3px white',
                    }}
                  />

                  <div className="card-industrial p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className={`px-2.5 py-1 text-xs font-medium border ${getActionColor(
                              log.actionType
                            )} flex items-center gap-1.5`}
                          >
                            {getActionIcon(log.actionType)}
                            {ACTION_TYPE_LABELS[log.actionType]}
                          </span>
                          <span className="text-sm text-gray-600">{log.message}</span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.operator}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(log.timestamp)}
                          </span>
                          {log.rowReference && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              关联行号：{log.rowReference}
                            </span>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-4 space-y-3">
                            {log.details && Object.keys(log.details).length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 mb-2">操作详情</h4>
                                <div className="bg-gray-50 p-3 border border-gray-200 text-xs font-mono overflow-x-auto">
                                  <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                </div>
                              </div>
                            )}

                            {log.rerunnableCommand && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 mb-2">
                                  可重跑命令
                                </h4>
                                <div className="bg-gray-900 text-gray-100 p-3 font-mono text-sm flex items-center justify-between">
                                  <code className="text-green-400">${log.rerunnableCommand}</code>
                                  <button
                                    onClick={() => copyCommand(log)}
                                    className="ml-4 p-1.5 hover:bg-gray-700 transition-colors"
                                    title="复制命令"
                                  >
                                    {isCopied ? (
                                      <Check className="w-4 h-4 text-green-400" />
                                    ) : (
                                      <Copy className="w-4 h-4 text-gray-400" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {log.traceInfo && log.traceInfo.length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-gray-500 mb-2">追溯链路</h4>
                                <div className="space-y-1">
                                  {log.traceInfo.map((trace, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-blue-50 border border-blue-100 p-2 text-xs"
                                    >
                                      <span className="text-blue-600 font-medium">
                                        {trace.action}
                                      </span>
                                      {' · '}
                                      <span className="text-gray-600">
                                        {formatTimestamp(trace.timestamp)}
                                      </span>
                                      {' · '}
                                      <span className="text-gray-500">{trace.operator}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() =>
                          setExpandedLog(isExpanded ? null : log.id)
                        }
                        className="ml-4 p-1.5 hover:bg-gray-100 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>

                    {log.rerunnableCommand && !isExpanded && (
                      <div className="mt-3 flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-gray-400" />
                        <code className="text-xs text-gray-500 font-mono truncate flex-1">
                          $ {log.rerunnableCommand}
                        </code>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyCommand(log);
                          }}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center gap-1"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3" />
                              已复制
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              复制
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card-industrial p-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-primary-600" />
          可重跑命令说明
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-4 border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">导入数据</h4>
            <code className="text-xs bg-gray-900 text-green-400 p-2 block">
              $ bridge-crack import --file="坐标原点说明.csv" --operator="许工"
            </code>
            <p className="text-xs text-gray-500 mt-2">
              从CSV文件导入坐标原点说明，自动检测重复和缺行
            </p>
          </div>
          <div className="bg-gray-50 p-4 border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">补录照片编号</h4>
            <code className="text-xs bg-gray-900 text-green-400 p-2 block">
              $ bridge-crack supplement --type="photo_number" --id="pp003" --value="P2024-003"
            </code>
            <p className="text-xs text-gray-500 mt-2">
              补录指定点位的巡检照片编号
            </p>
          </div>
          <div className="bg-gray-50 p-4 border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">安全员复核</h4>
            <code className="text-xs bg-gray-900 text-green-400 p-2 block">
              $ bridge-crack review --id="pp003" --comment="数据核对无误" --operator="安全员"
            </code>
            <p className="text-xs text-gray-500 mt-2">
              对缺行异常记录进行复核确认
            </p>
          </div>
          <div className="bg-gray-50 p-4 border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">触发重算</h4>
            <code className="text-xs bg-gray-900 text-green-400 p-2 block">
              $ bridge-crack recalculate --operator="许工"
            </code>
            <p className="text-xs text-gray-500 mt-2">
              重新计算三维坐标并生成新版本标注结果
            </p>
          </div>
          <div className="bg-gray-50 p-4 border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">运行自检</h4>
            <code className="text-xs bg-gray-900 text-green-400 p-2 block">
              $ bridge-crack self-check --type="export_consistency"
            </code>
            <p className="text-xs text-gray-500 mt-2">
              执行指定类型的自检验证
            </p>
          </div>
          <div className="bg-gray-50 p-4 border border-gray-200">
            <h4 className="font-medium text-gray-800 mb-2">导出数据</h4>
            <code className="text-xs bg-gray-900 text-green-400 p-2 block">
              $ bridge-crack export --format="xlsx" --version="v20241215-103022"
            </code>
            <p className="text-xs text-gray-500 mt-2">
              导出指定版本的标注结果和追溯信息
            </p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
