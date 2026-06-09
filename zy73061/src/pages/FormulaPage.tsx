import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Gauge, ThermometerSun, Activity, ChevronDown, ChevronRight, Info, Target, CheckCircle2, AlertTriangle, OctagonX, FileSearch, MousePointerClick } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useAppStore } from '@/store/useAppStore';
import type { ThresholdRule, InspectionRecord } from '@/types';
import { evaluateWarning } from '@/utils/calculator';

const iconMap: Record<string, React.ReactNode> = {
  管线工作压力: <Gauge className="w-4.5 h-4.5" />,
  介质温度: <ThermometerSun className="w-4.5 h-4.5" />,
  管体振动速度: <Activity className="w-4.5 h-4.5" />,
};

function BoundaryBar({ rule }: { rule: ThresholdRule }) {
  const range = rule.upper_bound - rule.lower_bound;
  const warnLowPct = ((rule.warning_low - rule.lower_bound) / range) * 100;
  const warnHighPct = ((rule.warning_high - rule.lower_bound) / range) * 100;

  return (
    <div className="space-y-2">
      <div className="relative h-9 rounded-lg overflow-hidden bg-surface-muted border border-surface-border">
        <div
          className="absolute top-0 bottom-0 bg-alert-green/40"
          style={{ left: `${warnLowPct}%`, width: `${Math.max(0, warnHighPct - warnLowPct)}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-alert-yellow"
          style={{ left: `${warnLowPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-alert-yellow"
          style={{ left: `${warnHighPct}%` }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-alert-red via-alert-green to-alert-red opacity-70" />
      </div>
      <div className="flex items-center justify-between text-[11px] text-industrial-500 font-mono num">
        <span className="flex items-center gap-1 text-alert-red">
          <OctagonX className="w-3 h-3" />
          {rule.lower_bound} 下限
        </span>
        <span className="flex items-center gap-1 text-[#b54a1e]">
          <AlertTriangle className="w-3 h-3" />
          预警低 {rule.warning_low}
        </span>
        <span className="flex items-center gap-1 text-alert-green">
          <CheckCircle2 className="w-3 h-3" />
          绿区
        </span>
        <span className="flex items-center gap-1 text-[#b54a1e]">
          <AlertTriangle className="w-3 h-3" />
          预警高 {rule.warning_high}
        </span>
        <span className="flex items-center gap-1 text-alert-red">
          <OctagonX className="w-3 h-3" />
          {rule.upper_bound} 上限
        </span>
      </div>
    </div>
  );
}

function FormulaCard({ rule, onSelect }: { rule: ThresholdRule; onSelect: (r: ThresholdRule) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      layout
      className="card-base overflow-hidden"
    >
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-industrial-50/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="w-10 h-10 rounded-lg bg-industrial-500 text-white flex items-center justify-center shrink-0 shadow-sm">
          {iconMap[rule.metric] || <Calculator className="w-4.5 h-4.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="title-font font-semibold text-industrial-800">{rule.metric}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-industrial-100 text-industrial-600 font-mono num">
                  单位 {rule.unit}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-industrial-500 text-white font-mono num">
                  口径 {rule.formula_version}
                </span>
              </div>
              <div className="formula-block mt-2 text-sm break-words">{rule.formula}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(rule);
              }}
              className="shrink-0 text-xs px-2.5 py-1 rounded-md border border-industrial-300 text-industrial-600 hover:bg-industrial-500 hover:text-white hover:border-industrial-500 transition-colors inline-flex items-center gap-1"
            >
              <MousePointerClick className="w-3 h-3" />
              代入演示
            </button>
          </div>
        </div>
        <div className="p-1 rounded hover:bg-industrial-100 transition-colors shrink-0 mt-1">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-industrial-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-industrial-500" />
          )}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 pb-4 space-y-4 border-t border-surface-border"
        >
          <div className="pt-4">
            <div className="text-xs font-semibold text-industrial-600 mb-2 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              变量说明
            </div>
            <div className="overflow-hidden rounded-lg border border-surface-border">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th-cell">变量名</th>
                    <th className="th-cell">含义</th>
                    <th className="th-cell w-[80px]">单位</th>
                  </tr>
                </thead>
                <tbody>
                  {rule.variables.map((v) => (
                    <tr key={v.name} className="hover:bg-industrial-50/40 transition-colors">
                      <td className="td-cell font-mono text-industrial-700 font-semibold">{v.name}</td>
                      <td className="td-cell text-industrial-600">{v.description}</td>
                      <td className="td-cell font-mono text-industrial-500">{v.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-industrial-600 mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              边界值可视化
            </div>
            <BoundaryBar rule={rule} />
            <p className="mt-2 text-[11px] text-industrial-400 leading-relaxed">
              超出上下边界 = 红警；进入预警区间但未超边界 = 黄警；处于两个预警阈值之间 = 绿区（正常）。
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function StepDemo({ rule, record }: { rule: ThresholdRule; record: InspectionRecord | null }) {
  const result = record ? evaluateWarning(record.measured_value, rule) : null;

  return (
    <div className="card-base p-5 sticky top-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title !mb-0">
          <Calculator className="w-4 h-4" />
          分步计算演示
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-industrial-100 text-industrial-600 font-mono">
          {rule.formula_version}
        </span>
      </div>

      {!record && (
        <div className="p-8 rounded-xl border-2 border-dashed border-industrial-200 bg-industrial-50/40 text-center">
          <FileSearch className="w-10 h-10 text-industrial-300 mx-auto mb-2" />
          <p className="text-sm text-industrial-500">
            点击左侧公式卡片上的「<span className="font-semibold">代入演示</span>」按钮
          </p>
          <p className="text-xs text-industrial-400 mt-1">
            或选择下方任意一条巡检记录，系统将按当前口径逐步计算
          </p>
        </div>
      )}

      {record && result && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-industrial-50 border border-industrial-100">
            <div className="text-[11px] text-industrial-400 mb-1">示例记录</div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="num text-sm font-bold text-industrial-800">{record.equipment_no}</div>
                <div className="text-xs text-industrial-500 truncate">{record.pipeline_name}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="num text-lg font-bold text-industrial-800 leading-none">
                  {record.measured_value.toFixed(2)}
                </div>
                <div className="text-[11px] text-industrial-400">{record.measure_unit}</div>
              </div>
            </div>
          </div>

          <div className="space-y-0">
            {result.steps.map((s, i) => {
              const isLast = i === result.steps.length - 1;
              return (
                <div key={i} className={`relative pl-7 ${isLast ? 'pb-0' : 'pb-4'}`}>
                  {!isLast && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-industrial-200" />}
                  <div
                    className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isLast
                        ? result.level === 'red'
                          ? 'bg-alert-red text-white'
                          : result.level === 'yellow'
                            ? 'bg-alert-orange text-white'
                            : 'bg-alert-green text-white'
                        : 'bg-industrial-500 text-white'
                    }`}
                  >
                    {s.step}
                  </div>
                  <div className="text-xs font-semibold text-industrial-700 mb-1">{s.title}</div>
                  <div className="formula-block mb-1.5 text-[12px]">{s.expression}</div>
                  <div className="text-right text-xs num">
                    = <span className="font-bold text-industrial-800">{s.result.toFixed(2)}</span>{' '}
                    <span className="text-industrial-400">{s.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={`p-3 rounded-xl ${
              result.level === 'red'
                ? 'bg-alert-red/10 border border-alert-red/40'
                : result.level === 'yellow'
                  ? 'bg-alert-orange/10 border border-alert-orange/40'
                  : 'bg-alert-green/10 border border-alert-green/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-industrial-700">最终判定</span>
              {result.level === 'red' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-alert-red text-white">
                  <OctagonX className="w-3.5 h-3.5" /> 红警 · 超标
                </span>
              )}
              {result.level === 'yellow' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-alert-orange text-white">
                  <AlertTriangle className="w-3.5 h-3.5" /> 黄警 · 预警区间
                </span>
              )}
              {result.level === 'green' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-alert-green text-white">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 绿区 · 正常
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FormulaPage() {
  const rules = useAppStore((s) => s.rules);
  const records = useAppStore((s) => s.records);
  const currentRules = rules.filter((r) => r.formula_version === 'v2.3');
  const [activeRule, setActiveRule] = useState<ThresholdRule>(currentRules[0]);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(records[0]?.id || null);

  const demoRecords = records.filter((r) => r.metric_type === activeRule.metric);
  const demoRecord = activeRecordId ? records.find((r) => r.id === activeRecordId) || demoRecords[0] || null : demoRecords[0] || null;

  return (
    <PageContainer
      title="预警公式 · 计算口径说明"
      subtitle="公式、单位、边界值、计算过程全部摆在明处。选中任意公式并代入巡检记录，查看每一步的中间结果和最终判定依据——别光看最终数字。"
      breadcrumb={[{ label: '预警公式说明' }]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="card-base p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-industrial-500 text-white text-xs font-semibold">
                <SparklesPlaceholder /> 当前口径 v2.3
              </span>
              <span className="text-xs text-industrial-500">以下规则为系统正在使用的版本</span>
            </div>
            <div className="space-y-3">
              {currentRules.map((r) => (
                <FormulaCard
                  key={r.id}
                  rule={r}
                  onSelect={(sel) => {
                    setActiveRule(sel);
                    const matches = records.filter((rec) => rec.metric_type === sel.metric);
                    setActiveRecordId(matches[0]?.id || null);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="card-base p-5">
            <h3 className="section-title">
              <Info className="w-4 h-4" />
              新手材料：快速读懂公式页
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-industrial-50 border border-industrial-100">
                <div className="text-industrial-500 mb-1.5">① 材料入口</div>
                <p className="text-industrial-600 leading-relaxed">
                  上方3张公式卡片，点击标题行展开「变量说明 + 边界值」；点「代入演示」进入分步计算。
                </p>
              </div>
              <div className="p-3 rounded-lg bg-alert-orange/5 border border-alert-orange/25">
                <div className="text-[#b54a1e] mb-1.5">② 异常出口</div>
                <p className="text-industrial-600 leading-relaxed">
                  最后一步会标红/黄/绿色块，与仪表盘和巡检页的预警等级完全一致——三者共用同一套口径。
                </p>
              </div>
              <div className="p-3 rounded-lg bg-alert-green/5 border border-alert-green/25">
                <div className="text-[#1f7a3a] mb-1.5">③ 口径统一</div>
                <p className="text-industrial-600 leading-relaxed">
                  历史时间线的所有记录均按当前口径重新折算，差异会在时间卡片里用小字标注变动原因。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <StepDemo rule={activeRule} record={demoRecord} />

          {demoRecords.length > 1 && (
            <div className="card-base p-4">
              <div className="text-xs font-semibold text-industrial-600 mb-2 flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5" />
                切换示例巡检记录（{demoRecords.length}条）
              </div>
              <div className="space-y-1.5">
                {demoRecords.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActiveRecordId(r.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                      activeRecordId === r.id
                        ? 'border-industrial-500 bg-industrial-50 shadow-inner'
                        : 'border-surface-border bg-white hover:bg-industrial-50/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="num text-xs font-semibold text-industrial-700">{r.equipment_no}</div>
                      <div className="text-[11px] text-industrial-400 truncate">{r.pipeline_name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="num text-sm font-bold text-industrial-800 leading-none">
                        {r.measured_value.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-industrial-400">{r.measure_unit}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function SparklesPlaceholder() {
  return <Calculator className="w-3.5 h-3.5" />;
}
