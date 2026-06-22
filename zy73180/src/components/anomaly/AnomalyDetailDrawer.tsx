import { useAppStore } from '@/store/appStore';
import type { AnomalyRecord, ProcessingStatus } from '@/types';
import { ANOMALY_TYPE_LABELS, STATUS_LABELS } from '@/types';
import { AnomalyTypeTag, StatusTag } from './AnomalyTags';
import {
  X,
  ExternalLink,
  Lightbulb,
  Calculator,
  Ruler,
  GitBranch,
  FileWarning,
  History,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { value: ProcessingStatus; label: string; icon: any }[] = [
  { value: 'pending', label: '待处理', icon: History },
  { value: 'reviewing', label: '处理中', icon: Eye },
  { value: 'resolved', label: '已解决', icon: CheckCircle2 },
  { value: 'ignored', label: '已忽略', icon: EyeOff },
];

const TABS = [
  { id: 'suggestion', label: '处理建议', icon: Lightbulb },
  { id: 'calculation', label: '验算详情', icon: Calculator },
  { id: 'raw', label: '原始记录', icon: ExternalLink },
  { id: 'history', label: '对比历史', icon: History },
] as const;

type TabId = typeof TABS[number]['id'];

export default function AnomalyDetailDrawer() {
  const selectedAnomalyId = useAppStore(s => s.selectedAnomalyId);
  const currentRun = useAppStore(s => s.currentRun);
  const comparison = useAppStore(s => s.comparison);
  const selectAnomaly = useAppStore(s => s.selectAnomaly);
  const updateAnomalyStatus = useAppStore(s => s.updateAnomalyStatus);

  const [activeTab, setActiveTab] = useState<TabId>('suggestion');

  if (!selectedAnomalyId || !currentRun) return null;

  const anomaly = currentRun.anomalies.find(a => a.id === selectedAnomalyId);
  if (!anomaly) return null;

  const compareRecord = comparison?.changedRecords.find(c => c.answerId === anomaly.answerId);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-ink-900/30 animate-fade-in"
        onClick={() => selectAnomaly(null)}
      />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-start justify-between px-5 py-4 border-b border-ink-200">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <AnomalyTypeTag type={anomaly.type} />
              <StatusTag status={anomaly.status} />
            </div>
            <h2 className="font-serif text-lg font-bold text-ink-900 truncate">
              {getAnomalyTitle(anomaly)}
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">
              {anomaly.sourceInfo.source} · 第 {anomaly.sourceInfo.originalRowIndex + 1} 行
            </p>
          </div>
          <button
            onClick={() => selectAnomaly(null)}
            className="p-1.5 rounded-md hover:bg-ink-100 text-ink-400 hover:text-ink-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-ink-100 flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-ink-900 text-white'
                    : 'text-ink-500 hover:bg-ink-100'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
          {activeTab === 'suggestion' && <SuggestionTab anomaly={anomaly} />}
          {activeTab === 'calculation' && <CalculationTab anomaly={anomaly} />}
          {activeTab === 'raw' && <RawDataTab anomaly={anomaly} />}
          {activeTab === 'history' && <HistoryTab anomaly={anomaly} compareRecord={compareRecord} />}
        </div>

        <div className="px-5 py-3 border-t border-ink-200 bg-ink-50">
          <div className="text-[11px] text-ink-400 mb-2 font-medium">处理状态</div>
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isActive = anomaly.status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateAnomalyStatus(anomaly.id, opt.value)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-2 rounded-md text-[11px] font-medium border transition-all',
                    isActive
                      ? 'bg-white border-ink-400 text-ink-800 shadow-soft'
                      : 'border-ink-200 text-ink-400 hover:border-ink-300'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function getAnomalyTitle(anomaly: AnomalyRecord): string {
  const rawKeys = Object.keys(anomaly.rawSnapshot);
  return anomaly.rawSnapshot[rawKeys[1]]?.toString()
    || anomaly.rawSnapshot[rawKeys[0]]?.toString()
    || `记录 ${anomaly.answerId}`;
}

function SuggestionTab({ anomaly }: { anomaly: AnomalyRecord }) {
  const Icon = getAnomalyIcon(anomaly.type);
  return (
    <div className="space-y-4">
      <div className={cn('rounded-lg p-4 border', getSuggestionCardClass(anomaly.type))}>
        <div className="flex items-start gap-2.5">
          <div className={cn('w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0', getSuggestionIconBg(anomaly.type))}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink-800 mb-1">
              {ANOMALY_TYPE_LABELS[anomaly.type]}
            </div>
            <p className="text-xs text-ink-600 leading-relaxed">{anomaly.suggestion}</p>
          </div>
        </div>
      </div>

      {anomaly.unitIssue && anomaly.unitIssue.type === 'missing' && (
        <div className="card p-3">
          <div className="text-xs font-medium text-ink-500 mb-2 flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5" />
            缺失的单位字段（原始字段名）
          </div>
          <div className="space-y-2">
            {anomaly.unitIssue.affectedFields.map((field, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-red-50 px-2 py-1.5 rounded border border-red-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-red-700">{field.rawFieldName}</span>
                  <span className="text-ink-400">→</span>
                  <span className="text-ink-500">{field.targetFieldName}</span>
                </div>
                <span className="tag-unit text-[10px]">缺失</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {anomaly.unitIssue && anomaly.unitIssue.type === 'invalid' && (
        <div className="card p-3">
          <div className="text-xs font-medium text-ink-500 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            不合法的单位字段
          </div>
          <div className="space-y-2">
            {anomaly.unitIssue.invalidUnits?.map((u, idx) => (
              <div key={idx} className="text-xs bg-red-50 px-2 py-2 rounded border border-red-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-red-700 font-medium">{u.field}</span>
                  <span className="text-red-600 font-medium">= {u.value}</span>
                </div>
                <div className="text-ink-500">允许值：{u.allowed.join('、')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {anomaly.fieldMappingInfo && anomaly.fieldMappingInfo.length > 0 && (
        <div className="card p-3">
          <div className="text-xs font-medium text-ink-500 mb-2 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            字段映射溯源（原始字段 → 标准字段）
          </div>
          <div className="space-y-1.5">
            {anomaly.fieldMappingInfo.map((info, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <div className="flex-shrink-0 w-20 text-right text-ink-400 truncate font-mono" title={info.rawFieldName}>
                  {info.rawFieldName}
                </div>
                <span className="text-ink-300 flex-shrink-0">→</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-ink-600 font-medium">{info.targetFieldName}</span>
                  <span className="text-ink-400">=</span>
                  <span className="font-mono text-ink-800 break-all">
                    {info.rawValue === null || info.rawValue === undefined || info.rawValue === ''
                      ? <span className="text-red-600 italic">（空）</span>
                      : String(info.rawValue)
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {anomaly.boundaryReason && (
        <div className="card p-3">
          <div className="text-xs font-medium text-ink-500 mb-2 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            边界分析
          </div>
          <p className="text-xs text-ink-600 leading-relaxed">{anomaly.boundaryReason}</p>
        </div>
      )}
    </div>
  );
}

function CalculationTab({ anomaly }: { anomaly: AnomalyRecord }) {
  const calc = anomaly.calculation;
  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="text-xs text-ink-400 mb-1">计算公式</div>
        <code className="block text-sm font-mono text-ink-800 bg-ink-50 rounded px-3 py-2 break-all">
          {calc.formula}
        </code>
      </div>

      <div className="card p-4">
        <div className="text-xs text-ink-400 mb-2">变量取值</div>
        <div className="space-y-1.5">
          {Object.entries(calc.variables).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="font-mono text-ink-600">{key}</span>
              <span className="font-mono text-ink-800 font-medium">{value}</span>
            </div>
          ))}
          {Object.keys(calc.variables).length === 0 && (
            <p className="text-xs text-ink-400 italic">无可用变量</p>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="text-xs text-ink-400 mb-1">计算结果</div>
        {calc.success && calc.value !== null ? (
          <div className="text-2xl font-serif font-bold text-ink-900">
            {calc.value.toFixed(6)}
            {calc.unit && <span className="text-sm font-sans font-normal text-ink-500 ml-2">{calc.unit}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-anomaly-unit">
            <FileWarning className="w-4 h-4" />
            <span className="text-sm font-medium">计算失败</span>
          </div>
        )}
        {calc.errorMessage && (
          <p className="text-xs text-ink-500 mt-2 leading-relaxed">{calc.errorMessage}</p>
        )}
      </div>
    </div>
  );
}

function RawDataTab({ anomaly }: { anomaly: AnomalyRecord }) {
  return (
    <div className="space-y-3">
      <div className="card p-3 bg-amber-50/50 border-amber-200">
        <div className="flex items-center gap-2 text-xs text-amber-700">
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="font-medium">溯源锚点</span>
          <span className="text-ink-400">·</span>
          <span className="text-ink-500">指回历史答案原始记录</span>
        </div>
        <div className="mt-2 text-xs text-ink-600">
          来源：<span className="font-medium text-ink-800">{anomaly.sourceInfo.source}</span>
          <span className="mx-2 text-ink-300">|</span>
          批次：<span className="font-mono">{anomaly.sourceInfo.sourceBatch}</span>
          <span className="mx-2 text-ink-300">|</span>
          行号：<span className="font-mono">{anomaly.sourceInfo.originalRowIndex + 1}</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-3 py-2 bg-ink-50 border-b border-ink-100 text-xs font-medium text-ink-500">
          原始字段（保留来源格式）
        </div>
        <div className="divide-y divide-ink-100">
          {Object.entries(anomaly.rawSnapshot).map(([key, value]) => (
            <div key={key} className="flex items-start gap-3 px-3 py-2">
              <div className="text-xs font-medium text-ink-500 w-28 flex-shrink-0 font-mono">
                {key}
              </div>
              <div className="text-xs text-ink-800 font-mono break-all flex-1">
                {value === null || value === undefined || value === ''
                  ? <span className="text-anomaly-unit italic">（空值）</span>
                  : String(value)
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ anomaly, compareRecord }: { anomaly: AnomalyRecord; compareRecord?: any }) {
  if (!compareRecord) {
    return (
      <div className="card p-8 text-center">
        <History className="w-8 h-8 mx-auto mb-2 text-ink-300" />
        <p className="text-sm text-ink-400">暂无对比记录</p>
        <p className="text-xs text-ink-400 mt-1">调整参数复算后可查看变化</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card p-3">
        <div className="text-xs font-medium text-ink-500 mb-2">变化类型</div>
        <ChangeTypeBadge type={compareRecord.changeType} />
      </div>

      {compareRecord.valueChange && (
        <div className="card p-3">
          <div className="text-xs font-medium text-ink-500 mb-2">数值变化</div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[11px] text-ink-400">原值</div>
              <div className="text-sm font-mono font-medium text-ink-700">
                {compareRecord.valueChange.oldValue?.toFixed(6) ?? '—'}
              </div>
            </div>
            <div className="text-ink-300">→</div>
            <div className="flex-1">
              <div className="text-[11px] text-ink-400">新值</div>
              <div className="text-sm font-mono font-medium text-amber-600">
                {compareRecord.valueChange.newValue?.toFixed(6) ?? '—'}
              </div>
            </div>
            {compareRecord.valueChange.delta !== null && (
              <div className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-xs font-medium">
                Δ {compareRecord.valueChange.delta > 0 ? '+' : ''}{compareRecord.valueChange.delta.toFixed(6)}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card p-3">
        <div className="text-xs font-medium text-ink-500 mb-2">变化原因</div>
        <div className="flex flex-wrap gap-1.5">
          {compareRecord.reasons.map((reason: string) => (
            <span key={reason} className="tag bg-amber-50 text-amber-700 border border-amber-200">
              {reasonLabel(reason)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChangeTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    added: { label: '新增异常', cls: 'tag bg-red-50 text-anomaly-unit border border-red-200' },
    removed: { label: '异常消除', cls: 'tag bg-emerald-50 text-anomaly-normal border border-emerald-200' },
    type_changed: { label: '异常类型变化', cls: 'tag bg-purple-50 text-anomaly-boundary border border-purple-200' },
    status_changed: { label: '状态变化', cls: 'tag bg-blue-50 text-blue-700 border border-blue-200' },
    value_changed: { label: '数值变化', cls: 'tag bg-amber-50 text-amber-700 border border-amber-200' },
  };
  const config = map[type] || { label: type, cls: 'tag bg-gray-50 text-ink-600 border border-gray-200' };
  return <span className={config.cls}>{config.label}</span>;
}

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    formula: '公式变化',
    parameter: '参数变化',
    unit: '单位口径变化',
    boundary: '边界样本影响',
    data_quality: '数据质量',
  };
  return labels[reason] || reason;
}

function getAnomalyIcon(type: AnomalyRecord['type']) {
  return {
    unit_missing: Ruler,
    unit_invalid: AlertTriangle,
    boundary_sample: GitBranch,
    bad_data: FileWarning,
    calculation_error: Calculator,
  }[type];
}

function getSuggestionCardClass(type: AnomalyRecord['type']): string {
  return {
    unit_missing: 'bg-red-50 border-red-200',
    unit_invalid: 'bg-red-50 border-red-200',
    boundary_sample: 'bg-purple-50 border-purple-200',
    bad_data: 'bg-gray-50 border-gray-200',
    calculation_error: 'bg-amber-50 border-amber-200',
  }[type];
}

function getSuggestionIconBg(type: AnomalyRecord['type']): string {
  return {
    unit_missing: 'bg-red-100 text-anomaly-unit',
    unit_invalid: 'bg-red-100 text-red-700',
    boundary_sample: 'bg-purple-100 text-anomaly-boundary',
    bad_data: 'bg-gray-200 text-anomaly-bad',
    calculation_error: 'bg-amber-100 text-anomaly-calc',
  }[type];
}
