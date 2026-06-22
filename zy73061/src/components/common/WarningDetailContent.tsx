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
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import type { InspectionRecord, WarningAlert, ThresholdRule, TimelineItem } from '@/types';
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
  const timeline = useAppStore((s) => s.timeline);
  const rule = propRule || findRuleByMetric(rules, record.metric_type);
  const result = rule ? evaluateWarning(record.measured_value, rule) : null;
  const currentVersion = versions.find((v) => v.is_current);

  const relatedWarnings = warnings.filter((w) => w.record_id === record.id);
  const activeWarn = relatedWarnings.find((w) => w.status !== 'voided');
  const voidedWarn = relatedWarnings.find((w) => w.status === 'voided');
  const isVoided = !activeWarn && !!voidedWarn;

  const relatedTimeline: TimelineItem[] = timeline.filter(
    (t) => t.record_id === record.id && (t.event_type === 'confirm' || t.event_type === 'void'),
  );

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
            ? isVoided
              ? 'bg-industrial-300 text-white line-through'
              : result?.level === 'red'
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
            ? isVoided
              ? 'border-industrial-200 bg-industrial-50 line-through opacity-60'
              : result?.level === 'red'
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
      {isVoided && voidedWarn && (
        <div className="p-4 rounded-xl bg-industrial-100/80 border border-industrial-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-industrial-200 flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5 text-industrial-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-industrial-200 text-industrial-600 line-through">
                  <Ban className="w-3.5 h-3.5" />
                  已作废 · 未纳入统计
                </span>
              </div>
              <p className="text-sm text-industrial-600 leading-relaxed">
                本条记录因 <span className="font-semibold">设备编号 {record.equipment_no} 重复</span>，经人工确认后未被采信，对应预警已作废并从所有汇总统计中移除。
              </p>
              {voidedWarn.voided_reason && (
                <p className="text-xs text-industrial-500 mt-2 flex items-start gap-1.5">
                  <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" />
                  {voidedWarn.voided_reason}
                </p>
              )}
              {relatedTimeline.length > 0 && (
                <p className="text-xs text-industrial-500 mt-2 flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  相关确认事件已记入 <span className="text-industrial-700 font-medium">历史时间线</span>，可追溯确认人和确认时间。
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div className={`num font-bold text-lg ${isVoided ? 'text-industrial-400 line-through' : 'text-industrial-800'}`}>
              {record.equipment_no}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-industrial-400 mb-0.5">
              <User className="w-3 h-3 inline mr-1" />
              巡检人
            </div>
            <div className={`font-semibold ${isVoided ? 'text-industrial-400 line-through' : 'text-industrial-800'}`}>
              {record.inspector}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-[11px] text-industrial-400 mb-0.5">管线</div>
            <div className={`text-sm ${isVoided ? 'text-industrial-400 line-through' : 'text-industrial-700'}`}>
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
            <div className={`num text-sm ${isVoided ? 'text-industrial-400 line-through' : 'text-industrial-700'}`}>
              {formatDateTime(record.inspect_time)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-industrial-400 mb-0.5">测量值</div>
            <div>
              <span className={`num font-bold text-lg ${isVoided ? 'text-industrial-400 line-through' : 'text-industrial-800'}`}>
                {record.measured_value.toFixed(2)}
              </span>
              <span className={`text-sm ml-1 ${isVoided ? 'text-industrial-300' : 'text-industrial-400'}`}>
                {record.measure_unit}
              </span>
              {!isVoided && renderUnitConversion()}
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
            {isVoided ? '历史计算链路（已作废，不参与统计）' : `计算链路（${currentVersion?.version} 口径）`}
          </h3>
          {result && !isVoided && <LevelBadge level={result.level} />}
          {isVoided && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-industrial-100 text-industrial-400 line-through">
              <Ban className="w-3 h-3" />
              历史计算
            </span>
          )}
        </div>

        {rule && (
          <div className={`mb-4 p-3 rounded-lg border ${
            isVoided
              ? 'bg-industrial-50 border-industrial-200 opacity-60'
              : 'bg-industrial-50 border-industrial-100'
          }`}>
            <div className="flex items-center gap-2 text-xs text-industrial-500 mb-1.5">
              <Gauge className="w-3.5 h-3.5" />
              指标：{rule.metric}
            </div>
            <div className={`formula-block text-sm ${isVoided ? 'line-through' : ''}`}>
              {rule.formula}
            </div>
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
          <div className={`relative pl-4 ${isVoided ? 'opacity-70' : ''}`}>
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

          {relatedTimeline.map((t) => (
            <div key={t.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 ${
                    t.event_type === 'confirm' ? 'bg-alert-blue' : 'bg-industrial-300'
                  }`}
                />
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="num text-xs font-semibold text-industrial-700">
                    {t.date}
                  </span>
                  {t.event_type === 'confirm' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-alert-blue/10 text-alert-blue">
                      <UserCheck className="w-3 h-3" />
                      人工确认采信
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-industrial-100 text-industrial-400">
                      <Ban className="w-3 h-3" />
                      确认作废
                    </span>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-industrial-500/10 text-industrial-600 num">
                    口径 {t.formula_version}
                  </span>
                </div>
                <p className={`text-xs mb-1 ${t.event_type === 'void' ? 'text-industrial-400' : 'text-industrial-600'}`}>
                  {t.event_type === 'confirm' ? (
                    <>
                      采信记录 <span className="font-mono num font-semibold">{t.record_id}</span>，
                      测量值 <span className="font-mono num font-semibold">{t.value.toFixed(2)} {t.unit}</span>，
                      等级 <span className="font-semibold">{t.level === 'red' ? '红警' : t.level === 'yellow' ? '黄警' : '正常'}</span>
                    </>
                  ) : (
                    <>
                      记录 <span className="font-mono num font-semibold line-through">{t.record_id}</span> 对应预警作废，
                      测量值 <span className="font-mono num font-semibold line-through">{t.value.toFixed(2)} {t.unit}</span> 不再参与统计
                    </>
                  )}
                </p>
                {t.change_reason && (
                  <p className={`text-xs flex items-start gap-1.5 ${
                    t.event_type === 'void' ? 'text-industrial-400' : 'text-alert-blue'
                  }`}>
                    {t.event_type === 'confirm' ? (
                      <UserCheck className="w-3 h-3 shrink-0 mt-0.5" />
                    ) : (
                      <Ban className="w-3 h-3 shrink-0 mt-0.5" />
                    )}
                    {t.change_reason}
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
