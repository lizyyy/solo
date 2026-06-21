import { useMemo } from 'react';
import {
  Eye,
  FileWarning,
  Table,
  GitCompare,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { useTidalStore } from '@/store/useTidalStore';
import type { DeltaItem, RightTab, StationRecord } from '@/types';

// CSV 字段中文对照（仅对常见 key 做翻译，其他保留原 key）
const CSV_FIELD_ZH: Record<string, string> = {
  station_name: '站点名称',
  log_id: '日志ID',
  record_id: '记录ID',
  annotation_id: '标注ID',
  latitude: '纬度(标准)',
  longitude: '经度(标准)',
  latitude_raw: '原始纬度',
  longitude_raw: '原始经度',
  coordinate_format: '坐标格式',
  tide_meters: '潮位(米)',
  tide_original: '原始潮位值',
  tide_unit_raw: '原始潮位单位',
  tide_level: '潮位等级',
  parse_notes: '坐标解析备注',
  tide_normalize_notes: '潮位归一备注',
  status: '状态',
  status_reasons: '状态原因',
  judgment_impact: '判断影响',
  raw_text: '原始日志文本',
  source_ref: '来源引用',
  timestamp: '时间戳',
  remarks: '人工备注',
  has_exception: '含异常',
  issues: '问题清单',
  tide_value: '潮位数值',
  tide_unit: '潮位单位',
  parse_errors: '解析错误',
};

const TABS: { key: RightTab; label: string; icon: typeof Eye }[] = [
  { key: 'scene', label: 'SCENE', icon: Eye },
  { key: 'side', label: 'SIDE', icon: FileWarning },
  { key: 'csv', label: 'CSV', icon: Table },
  { key: 'delta', label: 'DELTA', icon: GitCompare },
];

// 空占位
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-center p-8">
      <div>
        <AlertTriangle size={36} className="text-console-dim mx-auto mb-3" />
        <p className="font-mono text-[13px] text-console-muted mb-1">
          未选中站点
        </p>
        <p className="font-mono text-[11px] text-console-dim">
          请从左侧列表选择一个浮标站查看详情
        </p>
      </div>
    </div>
  );
}

// SCENE 标签
function SceneTab({ s }: { s: StationRecord }) {
  return (
    <div className="p-4 space-y-5">
      <div>
        <div className="text-[11px] font-mono text-console-dim uppercase tracking-wider mb-2">
          场景标注 (scene_annotation)
        </div>
        <div className="panel p-4 text-console-text text-[14px] leading-relaxed font-sans whitespace-pre-wrap">
          {s.scene_annotation || (
            <span className="text-console-dim italic">（空）</span>
          )}
        </div>
      </div>

      {s.judgment_impact.length > 0 && (
        <div>
          <div className="text-[11px] font-mono text-console-dim uppercase tracking-wider mb-2">
            判断影响 (judgment_impact)
          </div>
          <ul className="space-y-1.5">
            {s.judgment_impact.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] text-console-text
                  bg-ocean-mid/40 border border-ocean-line rounded-sm px-3 py-2"
              >
                <ArrowRight size={13} className="text-glow-cyanDim mt-0.5 shrink-0" />
                <span className="font-sans leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.status_reasons.length > 0 && (
        <div>
          <div className="text-[11px] font-mono text-console-dim uppercase tracking-wider mb-2">
            状态原因 (status_reasons)
          </div>
          <ul className="space-y-1.5">
            {s.status_reasons.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[12px] text-console-muted
                  bg-ocean-deep/60 border border-ocean-line rounded-sm px-3 py-1.5 font-mono"
              >
                <AlertTriangle
                  size={12}
                  className={`mt-0.5 shrink-0 ${
                    s.status === 'exception'
                      ? 'text-buoy-red'
                      : s.status === 'pending'
                      ? 'text-buoy-yellow'
                      : 'text-buoy-green'
                  }`}
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// SIDE 标签
function SideTab({ s }: { s: StationRecord }) {
  const lines = s.side_note ? s.side_note.split('\n') : [];
  return (
    <div className="p-4 h-full">
      <div className="text-[11px] font-mono text-console-dim uppercase tracking-wider mb-2">
        侧边说明 (side_note)
      </div>
      <div className="h-[calc(100%-28px)] bg-black/60 border border-ocean-line rounded-sm
        overflow-auto console-scroll p-4 font-mono text-[12px] leading-7">
        {lines.length === 0 ? (
          <span className="text-console-dim italic">（空）</span>
        ) : (
          lines.map((ln, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-8 shrink-0 text-right text-console-dim select-none">
                {i + 1}
              </span>
              <span className="flex-1 text-glow-cyan/90 whitespace-pre-wrap break-all">
                {ln || '\u00A0'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// CSV 标签
function CsvTab({ s }: { s: StationRecord }) {
  const rows = useMemo(() => {
    return Object.entries(s.csv_row).map(([k, v]) => ({
      key: k,
      zh: CSV_FIELD_ZH[k] || k,
      value: v,
    }));
  }, [s.csv_row]);

  return (
    <div className="p-4 h-full overflow-auto console-scroll">
      <div className="text-[11px] font-mono text-console-dim uppercase tracking-wider mb-3">
        CSV 行数据 (csv_row) — 共 {rows.length} 字段
      </div>
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr className="bg-ocean-mid/50 sticky top-0">
            <th className="text-left px-3 py-2 border border-ocean-line text-console-muted w-[30%]">
              字段名
            </th>
            <th className="text-left px-3 py-2 border border-ocean-line text-console-muted w-[25%]">
              中文
            </th>
            <th className="text-left px-3 py-2 border border-ocean-line text-console-muted">
              值
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="hover:bg-glow-cyan/5">
              <td className="px-3 py-1.5 border border-ocean-line text-glow-cyanDim break-all">
                {r.key}
              </td>
              <td className="px-3 py-1.5 border border-ocean-line text-console-text break-all">
                {r.zh}
              </td>
              <td className="px-3 py-1.5 border border-ocean-line text-console-muted break-all">
                {r.value || <span className="text-console-dim italic">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 单条 delta 渲染
function DeltaRow({ d }: { d: DeltaItem }) {
  const colorClass =
    String(d.new_value) !== String(d.old_value)
      ? 'text-buoy-green'
      : 'text-console-text';
  return (
    <div className="panel p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[12px] text-glow-cyan">
          {d.field_changed}
        </span>
        {d.judgment_impact && (
          <span className="text-[11px] font-mono text-buoy-yellow/80 max-w-[60%] truncate">
            {d.judgment_impact}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center font-mono text-[11px]">
        <div className="bg-ocean-deep/60 border border-ocean-line rounded-sm p-2 text-buoy-red/90 break-all">
          {String(d.old_value ?? '∅')}
        </div>
        <ArrowRight size={13} className="text-console-dim" />
        <div className={`bg-ocean-deep/60 border border-ocean-line rounded-sm p-2 break-all ${colorClass}`}>
          {String(d.new_value ?? '∅')}
        </div>
      </div>
    </div>
  );
}

// DELTA 标签
function DeltaTab({ s }: { s: StationRecord }) {
  const { deltas } = useTidalStore();
  const stationDeltas = useMemo(
    () => deltas.filter((d) => d.annotation_id === s.annotation_id),
    [deltas, s.annotation_id],
  );

  if (stationDeltas.length === 0) {
    return (
      <div className="p-8 text-center">
        <GitCompare size={32} className="text-console-dim mx-auto mb-3" />
        <p className="font-mono text-[13px] text-console-muted">
          该站点暂无版本变更
        </p>
        <p className="font-mono text-[11px] text-console-dim mt-1">
          v1 → v2 内容一致，未产生 delta
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto console-scroll h-full">
      {stationDeltas.map((report) => (
        <div key={report.version_id}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-ocean-line">
            <div className="flex items-center gap-2">
              <GitCompare size={14} className="text-glow-cyan" />
              <span className="font-mono text-[12px] text-glow-cyan">
                v{report.version_number} 变更报告
              </span>
              <span className="font-mono text-[10px] text-console-dim">
                {report.created_at}
              </span>
            </div>
          </div>
          {report.applied_remark && (
            <div className="mb-3 p-2 bg-buoy-yellow/10 border border-buoy-yellowDim rounded-sm
              font-mono text-[11px] text-buoy-yellow">
              备注: {report.applied_remark}
            </div>
          )}
          {report.deltas.map((d, i) => (
            <DeltaRow key={i} d={d} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function DetailPanel() {
  const { stations, selected_station_id, right_tab, setTab } = useTidalStore();

  const selected = stations.find(
    (s: StationRecord) => s.annotation_id === selected_station_id,
  );

  return (
    <aside className="flex flex-col h-full bg-ocean-deep/40 border-l border-ocean-line">
      {/* 头部：Tab 切换 */}
      <div className="flex items-center border-b border-ocean-line px-1 bg-ocean-surface/60">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = right_tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`tab-btn flex items-center gap-1.5 ${
                active ? 'tab-btn-active' : 'hover:text-console-text'
              }`}
            >
              <Icon size={12} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 选中站名 */}
      {selected && (
        <div className="px-4 py-2 border-b border-ocean-line bg-ocean-surface/40 flex items-center justify-between">
          <span className="font-mono text-[12px] text-console-text truncate">
            {selected.station_name}
          </span>
          <span className="font-mono text-[10px] text-console-dim">
            {selected.annotation_id.slice(-8)}
          </span>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden">
        {!selected ? (
          <EmptyState />
        ) : right_tab === 'scene' ? (
          <SceneTab s={selected} />
        ) : right_tab === 'side' ? (
          <SideTab s={selected} />
        ) : right_tab === 'csv' ? (
          <CsvTab s={selected} />
        ) : (
          <DeltaTab s={selected} />
        )}
      </div>
    </aside>
  );
}
