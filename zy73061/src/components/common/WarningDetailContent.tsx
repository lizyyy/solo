import { motion } from 'framer-motion';
import {
  FileText,
  ArrowRight,
  Calculator,
  Gauge,
  History,
  Paperclip,
  MessageSquareText,
  AlertTriangle,
  Clock3,
  User,
  Ban,
} from 'lucide-react';
import type { InspectionRecord, WarningAlert, ThresholdRule } from '@/types';
import { LevelBadge, StatusBadge } from '@/components/common/Badges';
import { findRuleByMetric, evaluateWarning } from '@/utils/calculator';
import { formatDateTime, MPaToBar, cToF, mmpsToInps } from '@/utils/unitConverter';
import { useAppStore } from '@/store/useAppStore';

interface Props {
  record: InspectionRecord;
  warnings: WarningAlert[];
  rule?: ThresholdRule;
}

export default function WarningDetailContent({ record, warnings, rule: propRule }: Props) {
  const rules = useAppStore((s) => s.rules);
  const versions = useAppStore((s) => s.versions);
  const rule = propRule || findRuleByMetric(rules, record.metric_type);
  const result = rule ? evaluateWarning(record.measured_value, rule) : null;
  const currentVersion = versions.find((v) => v.is_current);

  const relatedWarnings = warnings.filter((w) => w.record_id === record.id);

  const renderUnitConversion = () => {
    if (!rule) return null;
    if (rule.unit === 'MPa') {
      return (
        <div className="text-xs text-industrial-500 font-mono num">
          = {MPaToBar(record.measured_value)} bar（工程常用单位换算）
        </div>
      );
    }
    if (rule.unit === '℃') {
      return (
        <div className="text-xs text-industrial-500 font-mono num">
          = {cToF(record.measured_value)} ℉（华氏度换算）
        </div>
      );
    }
    if (rule.unit === 'mm/s') {
      return (
        <div className="text-xs text-industrial-500 font-mono num">
          = {mmpsToInps(record.measured_value)} in/s（英制换算）
        </div>
      );
    }
    return null;
  };

  const StepCard = ({ step, isLast }: { step: (typeof result)['steps'][number]; isLast: boolean }) => (
    <div className="relative pl-6 pb-5 last:pb-0">
      {!isLast && (
        <span className="absolute left-[13px] top-7 bottom-0 w-px bg-industrial-200" />
      )}
      <div
        className={`absolute left-0 top-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          isLast
            ? result?.level === 'red'
              ? 'bg-alert-red text-white'
              : result?.level === 'yellow'
                ? 'bg-alert-orange text-white'
                : 'bg-alert-green text-white'
            : 'bg-industrial-100 text-industrial-600'
        }`}
      >
        {step.step}
      </div>
      <div
        className={`ml-3 p-3 rounded-lg border ${
          isLast
            ? result?.level === 'red'
              ? 'border-alert-red/40 bg-alert-red/5'
              : result?.level === 'yellow'
                ? 'border-alert-orange/40 bg-alert-orange/5'
                : 'border-alert-green/40 bg-alert-green/5'
            : 'border-surface-border bg-surface-muted/50'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-industrial-700">{step.title}</span>
          <span className="num text-xs font-bold text-industrial-800">
            {step.result.toFixed(2)} {step.unit}
          </span>
        </div>
        <div className="formula-block !py-1.5 text-[12px] break-words">{step.expression}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="section-title !mb-0">
            <FileText className="w-4 h-4" />
            巡检原始数据
          </h3>
          <StatusBadge status={record.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-surface-muted/60 border border-surface-border">
          <div>
            <div className="text-[11px] text-industrial-400 mb-0.5">设备编号</div>
            <div className="num font-bold text-industrial-800 text-lg">{record.equipment_no}</div>
          </div>
          <div>
            <div className="text-[11px] text-industrial-400 mb-0.5">
              <User className="w-3 h-3 inline mr-1" />
              巡检人
            </div>
            <div className="font-semibold text-industrial-800">{record.inspector}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[11px] text-industrial-400 mb-0.5">管线</div>
            <div className="text-sm text-industrial-700">
              {record.pipeline_name}
              <span className="text-industrial-400 mx-1.5">·</span>
              {record.area}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-industrial-400 mb-0.5">
              <Clock3 className="w-3 h-3 inline mr-1" />
              巡检时间
            </div>
            <div className="num text-sm text-industrial-700">{formatDateTime(record.inspect_time)}</div>
          </div>
          <div>
            <div className="text-[11px] text-industrial-400 mb-0.5">测量值</div>
            <div>
              <span className="num font-bold text-industrial-800 text-lg">
                {record.measured_value.toFixed(2)}
              </span>
              <span className="text-sm text-industrial-400 ml-1">{record.measure_unit}</span>
              {renderUnitConversion()}
            </div>
          </div>
        </div>
      </section>

      {record.attachments.length > 0 && (
        <section>
          <h3 className="section-title">
            <Paperclip className="w-4 h-4" />
            附件材料 <span className="text-xs font-normal text-industrial-400">（{record.attachments.length}个）</span>
          </h3>
          <ul className="space-y-2">
            {record.attachments.map((a) => (
              <li
                key={a.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  a.is_late
                    ? 'bg-alert-orange/5 border-alert-orange/30'
                    : 'bg-surface-muted/40 border-surface-border'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                    a.is_late ? 'bg-alert-orange/20 text-alert-orange' : 'bg-industrial-100 text-industrial-500'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-industrial-700 truncate">{a.file_name}</div>
                  <div className="text-[11px] text-industrial-400 num mt-0.5">
                    上传：{formatDateTime(a.upload_time)}
                  </div>
                </div>
                {a.is_late && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-alert-orange/20 text-[#b54a1e] shrink-0">
                    <AlertTriangle className="w-3 h-3" />
                    晚到 {Math.max(1, Math.ceil((new Date(a.upload_time).getTime() - new Date(record.inspect_time).getTime()) / 86400000))} 天
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {record.notes.length > 0 && (
        <section>
          <h3 className="section-title">
            <MessageSquareText className="w-4 h-4" />
            巡检备注说明 <span className="text-xs font-normal text-industrial-400">（{record.notes.length}条）</span>
          </h3>
          <ul className="space-y-2">
            {record.notes.map((n) => (
              <li
                key={n.id}
                className={`p-3 rounded-lg border ${
                  n.is_backfilled
                    ? 'bg-alert-blue/5 border-alert-blue/30'
                    : 'bg-surface-muted/40 border-surface-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs text-industrial-500 num">{formatDateTime(n.created_at)}</span>
                  {n.is_backfilled && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-alert-blue/15 text-[#0a56a5] shrink-0">
                      后补说明
                    </span>
                  )}
                </div>
                <p className="text-sm text-industrial-700 leading-relaxed">{n.content}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title !mb-0">
            <Calculator className="w-4 h-4" />
            计算链路（{currentVersion?.version} 口径）
          </h3>
          {result && <LevelBadge level={result.level} />}
        </div>

        {rule && (
          <div className="mb-4 p-3 rounded-lg bg-industrial-50 border border-industrial-100">
            <div className="flex items-center gap-2 text-xs text-industrial-500 mb-1.5">
              <Gauge className="w-3.5 h-3.5" />
              指标：{rule.metric}
            </div>
            <div className="formula-block text-sm">{rule.formula}</div>
            <div className="grid grid-cols-2 gap-2 mt-2.5 text-[11px]">
              <div className="p-2 rounded bg-white/60">
                <span className="text-industrial-400">边界：</span>
                <span className="font-mono num text-industrial-700">
                  [{rule.lower_bound}, {rule.upper_bound}] {rule.unit}
                </span>
              </div>
              <div className="p-2 rounded bg-white/60">
                <span className="text-industrial-400">预警：</span>
                <span className="font-mono num text-industrial-700">
                  [{rule.warning_low}, {rule.warning_high}] {rule.unit}
                </span>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="relative pl-4">
            {result.steps.map((s, i) => (
              <StepCard key={i} step={s} isLast={i === result.steps.length - 1} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="section-title">
          <History className="w-4 h-4" />
          历史变动记录
        </h3>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-industrial-500 mt-1.5" />
              <div className="w-px flex-1 bg-industrial-200" />
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="num text-xs font-semibold text-industrial-700">
                  {formatDateTime(record.inspect_time)}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-industrial-100 text-industrial-600">
                  巡检录入
                </span>
              </div>
              <p className="text-xs text-industrial-500">
                {record.inspector} 提交原始数据，测量值 {record.measured_value.toFixed(2)} {record.measure_unit}
              </p>
            </div>
          </div>

          {relatedWarnings.map((w) => (
            <div key={w.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 ${
                    w.status === 'voided'
                      ? 'bg-industrial-300'
                      : w.level === 'red'
                        ? 'bg-alert-red'
                        : w.level === 'yellow'
                          ? 'bg-alert-orange'
                          : 'bg-alert-green'
                  }`}
                />
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="num text-xs font-semibold text-industrial-700">
                    {formatDateTime(w.created_at)}
                  </span>
                  {w.status === 'voided' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-industrial-100 text-industrial-400 line-through">
                      <Ban className="w-3 h-3" />
                      已作废 · 移出统计
                    </span>
                  ) : (
                    <LevelBadge level={w.level} />
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-industrial-100 text-industrial-600 num">
                    预警 {w.id}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-industrial-500/10 text-industrial-600 num">
                    口径 {w.formula_version}
                  </span>
                </div>
                <p className={`text-xs mb-1 ${w.status === 'voided' ? 'text-industrial-400 line-through' : 'text-industrial-500'}`}>
                  计算值{' '}
                  <span className="font-mono num text-industrial-700 font-semibold">
                    {w.calculated_value.toFixed(2)} {rule?.unit}
                  </span>{' '}
                  {w.status === 'voided' ? '（本条已不计入汇总）' : '触发预警'}
                </p>
                {w.status === 'voided' && w.voided_reason && (
                  <p className="text-xs text-industrial-400 flex items-start gap-1.5">
                    <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" />
                    {w.voided_reason}
                  </p>
                )}
                {w.status !== 'voided' && w.change_reason && (
                  <p className="text-xs text-alert-orange flex items-start gap-1.5">
                    <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" />
                    {w.change_reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
