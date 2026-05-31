import { useState } from 'react';
import {
  Cpu,
  FileText,
  MessageSquare,
  CheckCircle2,
  Beaker,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import type {
  TimelineEvent,
  SensorLog,
  ExperimentRecord,
  Correction,
  ManualConfirmation,
  ViscosityEstimate,
} from '@shared/types';
import { formatTime, getJudgmentLabel, getCorrectionCategoryLabel } from '@/lib/api';

interface TimelineEventCardProps {
  event: TimelineEvent;
  onClick?: () => void;
  isHighlighted?: boolean;
}

const eventConfig = {
  sensor_log: {
    icon: Cpu,
    color: 'border-ink-400 text-ink-600',
    dotColor: 'border-ink-400',
    accent: 'border-l-ink-400',
    label: '传感器日志',
  },
  experiment_record: {
    icon: FileText,
    color: 'border-moss-500 text-moss-600',
    dotColor: 'border-moss-500',
    accent: 'border-l-moss-500',
    label: '实验记录',
  },
  correction: {
    icon: MessageSquare,
    color: 'border-amber-500 text-amber-600',
    dotColor: 'border-amber-500',
    accent: 'border-l-amber-500',
    label: '批改意见',
  },
  manual_confirmation: {
    icon: CheckCircle2,
    color: 'border-ink-700 text-ink-700',
    dotColor: 'border-ink-700',
    accent: 'border-l-ink-700',
    label: '人工确认',
  },
  viscosity_estimate: {
    icon: Beaker,
    color: 'border-brick-500 text-brick-600',
    dotColor: 'border-brick-500',
    accent: 'border-l-brick-500',
    label: '黏度估计',
  },
};

const judgmentIcon = {
  pass: CheckCircle2,
  fail: XCircle,
  borderline: AlertTriangle,
  insufficient_data: HelpCircle,
};

const judgmentTagClass = {
  pass: 'tag-pass',
  fail: 'tag-fail',
  borderline: 'tag-borderline',
  insufficient_data: 'tag-insufficient',
};

export function TimelineEventCard({ event, onClick, isHighlighted }: TimelineEventCardProps) {
  const [expanded, setExpanded] = useState(true);
  const config = eventConfig[event.type];
  const Icon = config.icon;

  return (
    <div
      className={`card ${config.accent} border-l-4 transition-all duration-200 ${
        isHighlighted ? 'ring-2 ring-ink-400 ring-offset-2' : ''
      } hover:shadow-elevated cursor-pointer`}
      onClick={onClick}
    >
      <div className={`timeline-dot ${config.dotColor}`}>
        <Icon size={12} className={config.color} />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className={`tag ${config.color} bg-white`}>
              <Icon size={12} className="mr-1" />
              {config.label}
            </span>
            <span className="text-xs text-ink-400 font-mono">{formatTime(event.timestamp)}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-ink-400 hover:text-ink-600 transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {expanded && (
          <div className="animate-fade-in-up">
            {event.type === 'sensor_log' && <SensorLogContent data={event.data as SensorLog} />}
            {event.type === 'experiment_record' && (
              <ExperimentRecordContent data={event.data as ExperimentRecord} />
            )}
            {event.type === 'correction' && <CorrectionContent data={event.data as Correction} />}
            {event.type === 'manual_confirmation' && (
              <ManualConfirmationContent data={event.data as ManualConfirmation} />
            )}
            {event.type === 'viscosity_estimate' && (
              <ViscosityEstimateContent data={event.data as ViscosityEstimate} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SensorLogContent({ data }: { data: SensorLog }) {
  const hasAllFields =
    data.temperature !== null &&
    data.sphereDiameter !== null &&
    data.fallTime !== null &&
    data.fallDistance !== null;

  return (
    <div>
      {!hasAllFields && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs">
          <AlertTriangle size={12} className="inline mr-1" />
          部分字段缺失
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-ink-400 text-xs">温度 (°C)</span>
          <p className="font-mono text-ink-800">
            {data.temperature !== null ? data.temperature.toFixed(2) : '—'}
          </p>
        </div>
        <div>
          <span className="text-ink-400 text-xs">小球直径 (mm)</span>
          <p className="font-mono text-ink-800">
            {data.sphereDiameter !== null ? (data.sphereDiameter * 1000).toFixed(2) : '—'}
          </p>
        </div>
        <div>
          <span className="text-ink-400 text-xs">下落时间 (s)</span>
          <p className="font-mono text-ink-800">
            {data.fallTime !== null ? data.fallTime.toFixed(3) : '—'}
          </p>
        </div>
        <div>
          <span className="text-ink-400 text-xs">下落距离 (cm)</span>
          <p className="font-mono text-ink-800">
            {data.fallDistance !== null ? (data.fallDistance * 100).toFixed(1) : '—'}
          </p>
        </div>
      </div>
      {data.rawData && Object.keys(data.rawData).length > 0 && (
        <div className="mt-3 pt-3 border-t border-ink-100">
          <span className="text-ink-400 text-xs">原始数据</span>
          <pre className="mt-1 p-2 bg-ink-50 text-xs font-mono text-ink-600 overflow-x-auto">
            {JSON.stringify(data.rawData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ExperimentRecordContent({ data }: { data: ExperimentRecord }) {
  const typeLabels: Record<ExperimentRecord['type'], { label: string; className: string }> = {
    submission: { label: '提交', className: 'tag-pass' },
    revision: { label: '修改', className: 'tag-borderline' },
    note: { label: '备注', className: 'tag-insufficient' },
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`tag ${typeLabels[data.type].className}`}>
          {typeLabels[data.type].label}
        </span>
        <span className="text-xs text-ink-500">— {data.author}</span>
      </div>
      <p className="text-ink-700 text-sm leading-relaxed whitespace-pre-wrap">{data.content}</p>
    </div>
  );
}

function CorrectionContent({ data }: { data: Correction }) {
  const categoryColors: Record<Correction['category'], string> = {
    praise: 'tag-pass',
    suggestion: 'tag-borderline',
    error: 'tag-fail',
    deduction: 'tag-fail',
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`tag ${categoryColors[data.category]}`}>
          {getCorrectionCategoryLabel(data.category)}
        </span>
        {data.points !== undefined && (
          <span className="tag tag-fail">扣 {data.points} 分</span>
        )}
        <span className="text-xs text-ink-500">— {data.author}</span>
      </div>
      <p className="text-ink-700 text-sm leading-relaxed">{data.content}</p>
    </div>
  );
}

function ManualConfirmationContent({ data }: { data: ManualConfirmation }) {
  return (
    <div>
      <div className="mb-2">
        <span className="text-xs text-ink-500">确认人：{data.confirmer}</span>
        {data.relatedItemType && (
          <span className="ml-2 text-xs text-ink-400">
            关联：{data.relatedItemType === 'viscosity_estimate' ? '黏度估计' : data.relatedItemType === 'correction' ? '批改意见' : '传感器日志'}
          </span>
        )}
      </div>
      <p className="text-ink-700 text-sm leading-relaxed">{data.content}</p>
    </div>
  );
}

function ViscosityEstimateContent({ data }: { data: ViscosityEstimate }) {
  const JudgmentIcon = judgmentIcon[data.judgment];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-center">
          <div className="font-serif text-3xl font-semibold text-ink-800">
            {data.viscosity !== null ? data.viscosity.toFixed(4) : '—'}
          </div>
          <div className="text-xs text-ink-400">{data.unit}</div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`tag ${judgmentTagClass[data.judgment]}`}>
              <JudgmentIcon size={12} className="mr-1" />
              {getJudgmentLabel(data.judgment)}
            </span>
            <span className="text-xs text-ink-400 font-mono">v{data.algorithmVersion}</span>
          </div>
          <p className="text-sm text-ink-600 leading-relaxed">{data.judgmentReason}</p>
        </div>
      </div>

      {data.judgmentSteps.length > 0 && (
        <div className="mb-4 p-3 bg-ink-50 border border-ink-200">
          <h5 className="font-serif text-sm text-ink-700 mb-2">判断步骤</h5>
          <div className="space-y-2">
            {data.judgmentSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.passed ? 'bg-moss-100 text-moss-600' : 'bg-brick-100 text-brick-600'
                  }`}
                >
                  {step.passed ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                </span>
                <span className="flex-1 text-ink-600">{step.step}</span>
                <span className="font-mono text-ink-500">
                  {step.value.toFixed(4)} / {step.threshold.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.nextSteps.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200">
          <h5 className="font-serif text-sm text-amber-800 mb-2">下一步建议</h5>
          <ul className="space-y-1">
            {data.nextSteps.map((step, idx) => (
              <li key={idx} className="text-xs text-amber-700 flex items-start gap-2">
                <span className="text-amber-500 flex-shrink-0">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
