import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Clock,
  Copy,
  StickyNote,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  FlaskConical,
  Ship,
} from 'lucide-react';
import { useReportStore } from '@/store/useReportStore';
import TraceBreadcrumb from '@/components/TraceBreadcrumb';
import SourceRowsTable from '@/components/SourceRowsTable';
import { cn } from '@/lib/utils';
import type { AnomalyType } from '@/types';

const tabs: { key: AnomalyType | 'all'; label: string; icon: typeof Clock }[] = [
  { key: 'all', label: '全部', icon: AlertTriangle },
  { key: 'delayed', label: '晚到数据', icon: Clock },
  { key: 'duplicate', label: '采样瓶重复', icon: Copy },
  { key: 'manual', label: '临时备注', icon: StickyNote },
];

export default function TraceAnalysis() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { activeTab?: string } | null;

  const [activeTab, setActiveTab] = useState<AnomalyType | 'all'>(
    (state?.activeTab as AnomalyType) || 'all'
  );
  const [expandedDelays, setExpandedDelays] = useState<Set<string>>(new Set(['delay-001']));
  const [expandedDuplicates, setExpandedDuplicates] = useState<Set<string>>(new Set(['dup-001']));
  const [expandedRemarks, setExpandedRemarks] = useState<Set<string>>(new Set(['remark-001']));

  const { delayedRecords, duplicateBottles, tempRemarks } = useReportStore();

  const toggleDelay = (id: string) => {
    const newSet = new Set(expandedDelays);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedDelays(newSet);
  };

  const toggleDuplicate = (id: string) => {
    const newSet = new Set(expandedDuplicates);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedDuplicates(newSet);
  };

  const toggleRemark = (id: string) => {
    const newSet = new Set(expandedRemarks);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedRemarks(newSet);
  };

  const showDelayed = activeTab === 'all' || activeTab === 'delayed';
  const showDuplicate = activeTab === 'all' || activeTab === 'duplicate';
  const showRemark = activeTab === 'all' || activeTab === 'manual';

  const breadcrumbItems = [
    { label: '首页', onClick: () => navigate('/') },
    { label: '追溯分析', isLast: true },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <TraceBreadcrumb items={breadcrumbItems} />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">数据追溯分析</h1>
        <p className="text-slate-500 text-sm">
          追踪晚到数据、采样瓶重复和临时备注对报告结论的影响
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="flex border-b border-slate-200 px-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors relative',
                  isActive
                    ? 'text-sky-600'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 rounded-t" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showDelayed && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">晚到数据影响分析</h2>
              <p className="text-xs text-slate-500">
                实验室结果表和船上记录晚于传感器数据的关系追踪
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {delayedRecords.map((record) => {
              const isExpanded = expandedDelays.has(record.id);
              const Icon = record.materialType === 'lab' ? FlaskConical : Ship;

              return (
                <div
                  key={record.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  <button
                    onClick={() => toggleDelay(record.id)}
                    className="w-full p-5 flex items-start gap-4 text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-slate-800">
                          {record.materialName}
                        </h3>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                          晚到 {record.delayHours} 小时
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mb-2">
                        预计到达：{record.expectedTime} · 实际到达：{record.arriveTime}
                      </p>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {record.impactDescription}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-100">
                      <div className="pt-5 grid grid-cols-2 gap-5 mb-5">
                        <div className="p-4 bg-rose-50/50 rounded-lg border border-rose-100">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                            <span className="text-sm font-medium text-rose-700">原始结论</span>
                          </div>
                          <p className="text-sm text-rose-800">
                            {record.originalConclusion}
                          </p>
                        </div>
                        <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-medium text-emerald-700">修正后结论</span>
                          </div>
                          <p className="text-sm text-emerald-800">
                            {record.revisedConclusion}
                          </p>
                        </div>
                      </div>

                      <div className="mb-5">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">
                          影响指标
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {record.affectedIndicators.map((indicator) => (
                            <span
                              key={indicator}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
                            >
                              {indicator}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="mb-5">
                        <SourceRowsTable rows={record.sourceRows} title="变动来源行" />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/anomaly/${record.id}`);
                        }}
                        className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
                      >
                        查看完整追溯链路
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showDuplicate && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
              <Copy className="w-4.5 h-4.5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">采样瓶重复检测</h2>
              <p className="text-xs text-slate-500">
                系统自动检测重复采样瓶记录，展示影响范围和来源行
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {duplicateBottles.map((bottle) => {
              const isExpanded = expandedDuplicates.has(bottle.id);

              return (
                <div
                  key={bottle.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                >
                  <button
                    onClick={() => toggleDuplicate(bottle.id)}
                    className="w-full p-5 flex items-start gap-4 text-left hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {bottle.bottleNo}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-slate-800">
                          {bottle.bottleNo} 号采样瓶重复
                        </h3>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
                          重复 {bottle.duplicateCount} 次
                        </span>
                        {bottle.isManualChecked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            已人工确认
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                            待确认
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mb-2">
                        采集时间：{bottle.originalBottleData.collectTime} · 深度：{bottle.originalBottleData.depth}
                      </p>
                      <p className="text-sm text-slate-600">
                        {bottle.impactScope}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-100">
                      <div className="pt-5">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">
                          前后数据对比
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 rounded-lg">
                            <p className="text-xs text-slate-500 mb-2">原始（重复）数据</p>
                            <div className="space-y-1.5">
                              {Object.entries(bottle.originalBottleData.indicators).map(
                                ([key, value]) => (
                                  <div
                                    key={key}
                                    className="flex justify-between text-sm"
                                  >
                                    <span className="text-slate-500">{key}</span>
                                    <span className="font-medium text-rose-600">
                                      {String(value)}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                          <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                            <p className="text-xs text-emerald-600 mb-2">修正后数据</p>
                            <div className="space-y-1.5">
                              {Object.entries(bottle.currentBottleData.indicators).map(
                                ([key, value]) => (
                                  <div
                                    key={key}
                                    className="flex justify-between text-sm"
                                  >
                                    <span className="text-slate-600">{key}</span>
                                    <span className="font-medium text-emerald-700">
                                      {String(value)}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {bottle.isManualChecked && bottle.checker && (
                        <div className="mt-5 p-4 bg-emerald-50/30 rounded-lg border border-emerald-100">
                          <div className="flex items-center gap-2 mb-2">
                            <UserCheck className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-700">
                              人工确认信息
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">
                            <p>
                              确认人：<span className="font-medium">{bottle.checker}</span>
                            </p>
                            <p>
                              确认时间：<span className="font-medium">{bottle.checkTime}</span>
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-5">
                        <SourceRowsTable rows={bottle.sourceRows} title="影响来源行" />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/anomaly/${bottle.id}`);
                        }}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
                      >
                        查看完整追溯链路
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showRemark && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <StickyNote className="w-4.5 h-4.5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">临时备注追踪</h2>
              <p className="text-xs text-slate-500">
                彩排进场前补充的实验室结果表备注及其影响
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {tempRemarks.map((remark) => {
              const isExpanded = expandedRemarks.has(remark.id);

              return (
                <div
                  key={remark.id}
                  className="bg-white rounded-xl border border-purple-200 overflow-hidden bg-gradient-to-r from-purple-50/50 to-transparent"
                >
                  <button
                    onClick={() => toggleRemark(remark.id)}
                    className="w-full p-5 flex items-start gap-4 text-left hover:bg-purple-50/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                      <StickyNote className="w-5 h-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-slate-800">
                          彩排前补充备注
                        </h3>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          临时补充
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mb-2">
                        补充时间：{remark.addTime} · 补充人：{remark.addedBy}
                      </p>
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {remark.content}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-purple-200/50">
                      <div className="pt-5">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">
                          改变的判断
                        </h4>
                        <div className="space-y-3">
                          {remark.changedJudgments.map((judgment, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-white rounded-lg border border-slate-200"
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                                  {judgment.indicator}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">原判断</p>
                                  <p className="text-sm text-rose-700">
                                    {judgment.originalJudgment}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">新判断</p>
                                  <p className="text-sm text-emerald-700">
                                    {judgment.newJudgment}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <p className="text-xs text-slate-500">
                                  <span className="font-medium">原因：</span>
                                  {judgment.reason}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/anomaly/${remark.id}`);
                        }}
                        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
                      >
                        查看完整追溯链路
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
