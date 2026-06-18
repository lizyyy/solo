import { useState } from 'react';
import { FileText, AlignLeft, Table2, Check, Link2, Edit3 } from 'lucide-react';
import type { Annotation, BleachingSeverity } from '@/shared/types';
import { cn } from '@/lib/utils';

interface TripleEditorProps {
  annotation: Annotation;
  onSceneChange: (v: string) => void;
  onSideNoteChange: (v: string) => void;
  onSeverityChange: (v: BleachingSeverity) => void;
  onBleachingAreaChange: (v: number) => void;
  editable?: boolean;
  className?: string;
}

type Tab = 'scene' | 'side' | 'csv';

const severityColors: Record<BleachingSeverity, string> = {
  正常: 'bg-status-normal text-white',
  轻度: 'bg-yellow-500 text-white',
  中度: 'bg-orange-500 text-white',
  严重: 'bg-status-anomaly text-white',
};

export default function TripleEditor({
  annotation,
  onSceneChange,
  onSideNoteChange,
  onSeverityChange,
  onBleachingAreaChange,
  editable = true,
  className,
}: TripleEditorProps) {
  const [tab, setTab] = useState<Tab>('scene');

  const validArea = annotation.hasCloudCover && annotation.cloudMask
    ? annotation.totalArea - annotation.cloudMask.affectedArea
    : annotation.totalArea;
  const bleachingRate = validArea > 0 ? (annotation.bleachingArea / validArea) * 100 : 0;

  const csvPreview = [
    ['标注ID', annotation.id],
    ['海洋站', annotation.station],
    ['采样时间', new Date(annotation.sampleTime).toLocaleString('zh-CN')],
    ['实验结果时间', new Date(annotation.experimentResult).toLocaleString('zh-CN')],
    ['总调查面积(km²)', annotation.totalArea.toFixed(2)],
    ['云遮挡排除(km²)', annotation.hasCloudCover && annotation.cloudMask ? annotation.cloudMask.affectedArea.toFixed(2) : '0.00'],
    ['有效调查面积(km²)', validArea.toFixed(2)],
    ['白化面积(km²)', annotation.bleachingArea.toFixed(2)],
    ['白化率', bleachingRate.toFixed(2) + '%'],
    ['白化等级', annotation.severity],
    ['记录状态', annotation.status],
    ['遥感数据源', annotation.screenshotMeta.dataSource],
    ['轨道号', annotation.screenshotMeta.orbitId],
    ['异常标记', annotation.status === '云遮挡' ? '云遮挡-已排除' : annotation.status === '异常' ? '人工改判-已记录' : '正常'],
    ['补看来源', annotation.cloudMask?.reviewSource ?? ''],
    ['坏数据回跳锚点', annotation.badDataRef ?? ''],
  ];

  const tabs: Array<{ key: Tab; label: string; icon: typeof FileText }> = [
    { key: 'scene', label: '场景标注', icon: FileText },
    { key: 'side', label: '侧边说明', icon: AlignLeft },
    { key: 'csv', label: 'CSV 明细', icon: Table2 },
  ];

  return (
    <div
      className={cn(
        'bg-ocean-800/70 rounded-xl border border-ocean-600/40 overflow-hidden flex flex-col',
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-ocean-700/50 border-b border-ocean-600/40">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-coral-300" />
          <h3 className="font-serif font-semibold text-ocean-50 text-sm">
            统一数据源 · 三联同步
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Check size={12} className="text-status-normal" />
          <span className="text-[11px] text-status-normal">三端一致</span>
        </div>
      </div>

      <div className="flex border-b border-ocean-600/30 bg-ocean-800/40">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-all relative',
              tab === t.key
                ? 'text-coral-300 bg-ocean-700/40'
                : 'text-ocean-300 hover:text-ocean-100 hover:bg-ocean-700/20',
            )}
          >
            <t.icon size={13} />
            {t.label}
            {tab === t.key && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-coral-400 rounded-t" />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {tab === 'scene' && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-ocean-300 mb-1.5 block">白化等级</label>
              <div className="flex gap-1.5 flex-wrap">
                {(['正常', '轻度', '中度', '严重'] as BleachingSeverity[]).map((s) => (
                  <button
                    key={s}
                    disabled={!editable}
                    onClick={() => onSeverityChange(s)}
                    className={cn(
                      'px-2.5 py-1 text-[11px] rounded-md transition-all',
                      annotation.severity === s
                        ? cn(severityColors[s], 'shadow')
                        : 'bg-ocean-700/50 text-ocean-200 hover:bg-ocean-600/60',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-ocean-300 mb-1.5 flex items-center justify-between">
                <span>白化面积 (km²)</span>
                <span className="font-mono text-coral-300">
                  白化率 {bleachingRate.toFixed(2)}%
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                value={annotation.bleachingArea}
                disabled={!editable}
                onChange={(e) => onBleachingAreaChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-ocean-900/60 border border-ocean-600/40 rounded-md px-3 py-1.5 text-sm text-ocean-50 font-mono focus:outline-none focus:border-coral-400/60 focus:ring-1 focus:ring-coral-400/30"
              />
            </div>

            <div>
              <label className="text-[11px] text-ocean-300 mb-1.5 flex items-center gap-1.5">
                <Edit3 size={11} />
                场景标注文本
              </label>
              <textarea
                value={annotation.sceneLabel}
                disabled={!editable}
                onChange={(e) => onSceneChange(e.target.value)}
                rows={8}
                className="w-full bg-ocean-900/60 border border-ocean-600/40 rounded-md px-3 py-2 text-sm text-ocean-50 leading-relaxed resize-none focus:outline-none focus:border-coral-400/60 focus:ring-1 focus:ring-coral-400/30"
              />
            </div>
          </div>
        )}

        {tab === 'side' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-ocean-700/30 rounded p-2">
                <div className="text-ocean-400 mb-0.5">采样时间</div>
                <div className="text-ocean-100 font-mono">
                  {new Date(annotation.sampleTime).toLocaleString('zh-CN')}
                </div>
              </div>
              <div className="bg-ocean-700/30 rounded p-2">
                <div className="text-ocean-400 mb-0.5">实验结果</div>
                <div className="text-ocean-100 font-mono">
                  {new Date(annotation.experimentResult).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>

            <div className="bg-coral-500/10 border border-coral-400/30 rounded p-2.5">
              <div className="text-[11px] text-coral-300 font-medium mb-1">时间一致性提示</div>
              <div className="text-[11px] text-ocean-200">
                采样与实验结果间隔{' '}
                <span className="font-mono text-coral-200">
                  {(
                    (new Date(annotation.experimentResult).getTime() -
                      new Date(annotation.sampleTime).getTime()) /
                    3600000
                  ).toFixed(1)}
                  小时
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-ocean-300 mb-1.5 flex items-center gap-1.5">
                <Edit3 size={11} />
                侧边说明
              </label>
              <textarea
                value={annotation.sideNote}
                disabled={!editable}
                onChange={(e) => onSideNoteChange(e.target.value)}
                rows={10}
                className="w-full bg-ocean-900/60 border border-ocean-600/40 rounded-md px-3 py-2 text-sm text-ocean-50 leading-relaxed resize-none focus:outline-none focus:border-coral-400/60 focus:ring-1 focus:ring-coral-400/30"
              />
            </div>
          </div>
        )}

        {tab === 'csv' && (
          <div>
            <div className="text-[11px] text-ocean-300 mb-2">CSV 明细预览（同源数据）</div>
            <div className="bg-ocean-900/60 rounded-md border border-ocean-600/30 overflow-hidden">
              <table className="w-full text-[11px]">
                <tbody>
                  {csvPreview.map(([k, v], i) => (
                    <tr key={k} className={i % 2 === 0 ? 'bg-ocean-800/30' : ''}>
                      <td className="px-2.5 py-1.5 text-ocean-400 w-1/3 border-r border-ocean-700/40">
                        {k}
                      </td>
                      <td className="px-2.5 py-1.5 text-ocean-100 font-mono break-all">
                        {v || <span className="text-ocean-600">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-ocean-400 flex items-center gap-1">
              <Check size={11} className="text-status-normal" />
              CSV 与场景标注、侧边说明共享同一数据源，任一字段修改三者同步更新
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
