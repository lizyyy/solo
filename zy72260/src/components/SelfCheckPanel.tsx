import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  PlayCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SelfCheckItem } from '@/types';
import { runAllSelfChecks } from '@/utils/selfCheckEngine';
import { recalculateAllRoutes } from '@/utils/routeCalculator';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface SelfCheckPanelProps {
  checks: SelfCheckItem[];
  onChecksComplete?: () => void;
}

export default function SelfCheckPanel({ checks, onChecksComplete }: SelfCheckPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const pointCloudLog = useAppStore((s) => s.pointCloudLog);
  const safetyRadiusTable = useAppStore((s) => s.safetyRadiusTable);
  const routes = useAppStore((s) => s.routes);
  const conflicts = useAppStore((s) => s.conflicts);
  const exports = useAppStore((s) => s.exports);
  const workflow = useAppStore((s) => s.workflow);
  const setSelfChecks = useAppStore((s) => s.setSelfChecks);
  const setRoutes = useAppStore((s) => s.setRoutes);
  const setWorkflow = useAppStore((s) => s.setWorkflow);

  const getStatusIcon = (status: SelfCheckItem['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-success-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-danger-500" />;
      case 'pending_review':
        return <Clock className="w-5 h-5 text-warning-500 animate-pulse" />;
      case 'not_run':
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusClass = (status: SelfCheckItem['status']) => {
    switch (status) {
      case 'pass':
        return 'border-success-300 bg-success-50';
      case 'warning':
        return 'border-warning-300 bg-warning-50';
      case 'fail':
        return 'border-danger-300 bg-danger-50';
      case 'pending_review':
        return 'border-warning-400 bg-warning-50 animate-blink-orange';
      case 'not_run':
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getStatusLabel = (status: SelfCheckItem['status']) => {
    switch (status) {
      case 'pass':
        return '通过';
      case 'warning':
        return '警告';
      case 'fail':
        return '未通过';
      case 'pending_review':
        return '待客户复核';
      case 'not_run':
        return '未检测';
    }
  };

  const handleRunAllChecks = async () => {
    if (!pointCloudLog) return;
    
    setIsRunning(true);
    try {
      const results = await runAllSelfChecks(
        pointCloudLog,
        safetyRadiusTable,
        routes,
        conflicts,
        exports,
        {
          lastSupplementaryTime: workflow.lastSupplementaryTime,
          lastRouteCalcTime: workflow.lastRouteCalcTime,
        }
      );
      setSelfChecks(results);
      onChecksComplete?.();
    } catch (error) {
      console.error('Self-check failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRecalculateRoutes = async () => {
    setIsRunning(true);
    try {
      const updatedRoutes = await recalculateAllRoutes(routes);
      setRoutes(updatedRoutes);
      setWorkflow({
        lastRouteCalcTime: new Date().toISOString(),
      });
      await handleRunAllChecks();
    } catch (error) {
      console.error('Recalculate failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const renderActionButton = (check: SelfCheckItem) => {
    if (check.type === 'supplementary_recalc' && check.status === 'fail') {
      return (
        <button
          className="btn-primary text-sm py-1 px-3 flex items-center gap-1"
          onClick={handleRecalculateRoutes}
          disabled={isRunning}
        >
          <RefreshCw className={cn('w-4 h-4', isRunning && 'animate-spin')} />
          一键重算
        </button>
      );
    }
    return null;
  };

  const renderDetails = (check: SelfCheckItem) => {
    const details = check.details;
    
    if (check.type === 'duplicate_import' && details.previousImports) {
      return (
        <div className="mt-3 text-xs space-y-1">
          <p className="font-medium text-gray-700">历史导入记录：</p>
          <ul className="bg-white/50 p-2 rounded space-y-1">
            {details.previousImports.map((h: any, idx: number) => (
              <li key={idx} className="text-gray-600">
                • {new Date(h.importTime).toLocaleString('zh-CN')} · {h.operator}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (check.type === 'length_not_recalculated' && details.notRecalculatedRoutes) {
      return (
        <div className="mt-3 text-xs space-y-1">
          <p className="font-medium text-gray-700">未重算路线：</p>
          <div className="bg-white/50 p-2 rounded space-y-2">
            {details.notRecalculatedRoutes.map((r: any, idx: number) => (
              <div key={idx} className="border border-warning-300 rounded p-2">
                <p className="text-warning-700 font-medium">
                  路线 {idx + 1}
                </p>
                <p className="text-gray-600">
                  上报长度：<span className="data-mono">{r.reportedLength?.toFixed(2)}m</span>
                </p>
                <p className="text-gray-600">
                  计算长度：<span className="data-mono">{r.calculatedLength?.toFixed(2)}m</span>
                </p>
                <p className="text-danger-600">
                  差值：<span className="data-mono">{r.diff?.toFixed(2)}m</span>
                </p>
              </div>
            ))}
          </div>
          <p className="text-warning-700 mt-2">
            ⚠️ 这些路线需要展陈客户复核确认后才能标记为正常
          </p>
        </div>
      );
    }

    if (check.type === 'export_consistency' && details.differences) {
      return (
        <div className="mt-3 text-xs space-y-1">
          {details.differences.length > 0 ? (
            <>
              <p className="font-medium text-gray-700">与上一版本差异：</p>
              <ul className="bg-white/50 p-2 rounded space-y-1">
                {details.differences.map((d: any, idx: number) => (
                  <li key={idx} className="text-gray-600">
                    • {d.description}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-success-700">首次导出，无历史对比数据</p>
          )}
        </div>
      );
    }

    if (check.type === 'supplementary_recalc' && details.needRecalc) {
      return (
        <div className="mt-3 text-xs text-warning-700">
          <p>补录操作时间：{details.lastSupplementaryTime ? new Date(details.lastSupplementaryTime).toLocaleString('zh-CN') : '无记录'}</p>
          <p>最后重算时间：{details.lastRouteCalcTime ? new Date(details.lastRouteCalcTime).toLocaleString('zh-CN') : '无记录'}</p>
        </div>
      );
    }

    return null;
  };

  const summary = {
    pass: checks.filter(c => c.status === 'pass').length,
    warning: checks.filter(c => c.status === 'warning').length,
    fail: checks.filter(c => c.status === 'fail').length,
    pending: checks.filter(c => c.status === 'pending_review').length,
    notRun: checks.filter(c => c.status === 'not_run').length,
  };

  const canExport = summary.fail === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">自检状态</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success-500" />
              {summary.pass}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning-500" />
              {summary.warning}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-danger-500" />
              {summary.fail}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning-400 animate-pulse" />
              {summary.pending}
            </span>
          </div>
          <button
            className="btn-primary text-sm py-1 px-3 flex items-center gap-1"
            onClick={handleRunAllChecks}
            disabled={isRunning || !pointCloudLog}
          >
            <PlayCircle className={cn('w-4 h-4', isRunning && 'animate-spin')} />
            {isRunning ? '检测中...' : '执行全部自检'}
          </button>
        </div>
      </div>

      {!canExport && summary.fail > 0 && (
        <div className="bg-danger-50 border border-danger-300 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-danger-800">存在未通过的自检项</p>
            <p className="text-danger-600">请先处理所有错误后再导出</p>
          </div>
        </div>
      )}

      {summary.pending > 0 && (
        <div className="bg-warning-50 border border-warning-300 rounded-lg p-3 flex items-start gap-2 animate-blink-orange">
          <Clock className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-warning-800">有待客户复核的项目</p>
            <p className="text-warning-600">这些项目不会阻止导出，但会在导出结果中标记</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {checks.map((check) => {
          const isExpanded = expandedId === check.id;
          const actionButton = renderActionButton(check);

          return (
            <motion.div
              key={check.id}
              layout
              className={cn(
                'border-2 rounded-lg overflow-hidden transition-all',
                getStatusClass(check.status)
              )}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : check.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">
                          {check.title}
                        </span>
                        <span
                          className={cn(
                            'status-badge',
                            check.status === 'pass' && 'status-pass',
                            check.status === 'warning' && 'status-warning',
                            check.status === 'fail' && 'status-error',
                            check.status === 'pending_review' && 'status-pending-review',
                            check.status === 'not_run' && 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {getStatusLabel(check.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {check.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {actionButton}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200/50 pt-3">
                  {renderDetails(check)}
                  {check.checkTime && (
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      检测时间：{new Date(check.checkTime).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
