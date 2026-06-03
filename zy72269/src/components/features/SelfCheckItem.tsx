import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronUp,
  Database,
  Compass,
  Calculator,
  FileCheck
} from 'lucide-react';
import type { SelfCheckReport } from '@/types';
import Button from '@/components/ui/Button';
import { getCheckTypeLabel, getCheckResultLabel } from '@/services/selfCheckService';

interface SelfCheckItemProps {
  report?: SelfCheckReport;
  checkType: SelfCheckReport['checkType'];
  onRun: () => void;
  isRunning?: boolean;
}

export default function SelfCheckItem({ report, checkType, onRun, isRunning }: SelfCheckItemProps) {
  const [expanded, setExpanded] = useState(false);

  const getIcon = () => {
    switch (checkType) {
      case 'duplicate_import': return Database;
      case 'z_axis_check': return Compass;
      case 'recalculation': return Calculator;
      case 'export_consistency': return FileCheck;
    }
  };

  const getResultIcon = () => {
    if (!report) return null;
    switch (report.result) {
      case 'pass': return <CheckCircle2 className="text-accent-success" size={24} />;
      case 'fail': return <XCircle className="text-accent-warning" size={24} />;
      case 'warning': return <AlertTriangle className="text-accent-warning" size={24} />;
    }
  };

  const getResultBg = () => {
    if (!report) return 'bg-primary-800/30';
    switch (report.result) {
      case 'pass': return 'bg-accent-success/10 border-accent-success/30';
      case 'fail': return 'bg-accent-warning/10 border-accent-warning/30';
      case 'warning': return 'bg-accent-warning/10 border-accent-warning/30';
    }
  };

  const Icon = getIcon();

  return (
    <div className={`card-industrial mb-4 ${getResultBg()}`}>
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-primary-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <Icon className="text-primary-400" size={24} />
          <div>
            <h4 className="font-mono text-sm text-primary-200">
              {getCheckTypeLabel(checkType)}
            </h4>
            {report && (
              <p className="font-mono text-xs text-primary-400 mt-1">
                执行于 {new Date(report.executedAt).toLocaleString('zh-CN')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {getResultIcon()}
          {report ? (
            <span className={`px-3 py-1 text-xs font-mono border tracking-wider ${
              report.result === 'pass' ? 'text-accent-success border-accent-success/50' :
              'text-accent-warning border-accent-warning/50'
            }`}>
              {getCheckResultLabel(report.result)}
            </span>
          ) : (
            <span className="px-3 py-1 text-xs font-mono border border-primary-500 text-primary-400 tracking-wider">
              未执行
            </span>
          )}
          <Button
            variant="primary"
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            disabled={isRunning}
            className="text-xs"
          >
            <Play size={14} className="mr-2 inline" />
            {isRunning ? '执行中...' : '执行'}
          </Button>
          {expanded ? <ChevronUp size={18} className="text-primary-400" /> : <ChevronDown size={18} className="text-primary-400" />}
        </div>
      </div>

      {expanded && report && (
        <div className="px-6 pb-6">
          <div className="bg-primary-800/50 border border-primary-700 p-4 mb-4">
            <p className="font-mono text-xs text-primary-400 mb-2">检查结果</p>
            <p className="text-sm text-primary-200">{report.details}</p>
          </div>

          {report.rawDataSnapshot && (
            <div className="bg-primary-900/50 border border-primary-700 p-4">
              <p className="font-mono text-xs text-primary-400 mb-2">原始数据快照</p>
              <pre className="font-mono text-xs text-primary-300 overflow-x-auto max-h-[200px] scrollbar-thin">
                {JSON.stringify(report.rawDataSnapshot, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
