import { useState } from 'react';
import { Music, Monitor, Footprints, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, ShieldAlert, ShieldX, Shield } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '@/store';
import type { CompatibilityResult, PresetOverride, PolarityIssue } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  compatible: '#10B981',
  incompatible: '#EF4444',
  polarity_warning: '#F59E0B',
  override_pending: '#8B5CF6',
};

const STATUS_LABELS: Record<string, string> = {
  compatible: '兼容',
  incompatible: '不兼容',
  polarity_warning: '极性警告',
  override_pending: '覆盖待处理',
};

const BORDER_COLORS: Record<string, string> = {
  incompatible: 'border-l-red-500',
  polarity_warning: 'border-l-amber-500',
  override_pending: 'border-l-purple-500',
};

const ICON_MAP: Record<string, typeof Shield> = {
  incompatible: ShieldX,
  polarity_warning: ShieldAlert,
  override_pending: Shield,
};

interface WarningItem {
  id: string;
  type: 'incompatible' | 'polarity_warning' | 'override_pending' | 'override' | 'polarity';
  title: string;
  description: string;
  affectedCount: number;
  affectedItems: string[];
  borderColor: string;
}

function buildWarnings(
  compatResults: CompatibilityResult[],
  overrides: PresetOverride[],
  polarityIssues: PolarityIssue[],
  presets: { id: string; name: string }[],
  models: { id: string; brand: string; model: string }[],
  mappings: { id: string; name: string }[]
): WarningItem[] {
  const warnings: WarningItem[] = [];
  const presetMap = new Map(presets.map((p) => [p.id, p.name]));
  const modelMap = new Map(models.map((m) => [m.id, `${m.brand} ${m.model}`]));
  const mappingMap = new Map(mappings.map((m) => [m.id, m.name]));

  const seen = new Set<string>();

  for (const cr of compatResults) {
    if (cr.status === 'compatible') continue;
    const key = `${cr.presetId}-${cr.modelId}-${cr.mappingId}-${cr.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    warnings.push({
      id: cr.id,
      type: cr.status,
      title: STATUS_LABELS[cr.status] || cr.status,
      description: cr.description,
      affectedCount: cr.affectedItems.length,
      affectedItems: cr.affectedItems.map(
        (id) => presetMap.get(id) || modelMap.get(id) || mappingMap.get(id) || id
      ),
      borderColor: BORDER_COLORS[cr.status] || 'border-l-amber-500',
    });
  }

  for (const ov of overrides) {
    const key = `override-${ov.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    warnings.push({
      id: ov.id,
      type: 'override',
      title: '版本覆盖',
      description: ov.description,
      affectedCount: ov.affectedModelIds.length + ov.affectedMappingIds.length,
      affectedItems: [
        ...ov.affectedModelIds.map((id) => modelMap.get(id) || id),
        ...ov.affectedMappingIds.map((id) => mappingMap.get(id) || id),
      ],
      borderColor: 'border-l-purple-500',
    });
  }

  for (const pi of polarityIssues) {
    const key = `polarity-${pi.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    warnings.push({
      id: pi.id,
      type: 'polarity',
      title: '极性问题',
      description: pi.description,
      affectedCount: pi.affectedPresetIds.length + pi.affectedModelIds.length,
      affectedItems: [
        ...pi.affectedPresetIds.map((id) => presetMap.get(id) || id),
        ...pi.affectedModelIds.map((id) => modelMap.get(id) || id),
      ],
      borderColor: 'border-l-amber-500',
    });
  }

  return warnings;
}

function buildPieData(compatResults: CompatibilityResult[]) {
  const counts: Record<string, number> = {
    compatible: 0,
    incompatible: 0,
    polarity_warning: 0,
    override_pending: 0,
  };
  for (const cr of compatResults) {
    counts[cr.status] = (counts[cr.status] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: STATUS_LABELS[name], value, key: name }));
}

function buildTimelineData(presets: { importedAt: string }[]) {
  const dateMap: Record<string, number> = {};
  for (const p of presets) {
    const date = new Date(p.importedAt).toISOString().slice(0, 10);
    dateMap[date] = (dateMap[date] || 0) + 1;
  }
  return Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: date.slice(5), count }));
}

function WarningRow({ item }: { item: WarningItem }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON_MAP[item.type] || AlertTriangle;

  return (
    <div
      className={`bg-[#1A1A2E] border-l-4 ${item.borderColor} rounded-lg overflow-hidden transition-all duration-300 hover:bg-[#22223A]`}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className="w-4 h-4 text-[#8A8AA0] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#FAF5EF] truncate">{item.title}</span>
            <span className="text-xs text-[#8A8AA0] shrink-0">{item.affectedCount} 项受影响</span>
          </div>
          <p className="text-xs text-[#8A8AA0] truncate mt-0.5">{item.description}</p>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[#8A8AA0] shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#8A8AA0] shrink-0" />
        )}
      </button>
      {expanded && item.affectedItems.length > 0 && (
        <div className="px-4 pb-3 pl-11">
          <div className="text-xs text-[#8A8AA0] mb-1.5">受影响项目：</div>
          <div className="flex flex-wrap gap-1.5">
            {item.affectedItems.map((name, i) => (
              <span
                key={i}
                className="inline-block text-xs bg-[#0E0E1A] text-[#FAF5EF] px-2 py-0.5 rounded"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const {
    presets,
    models,
    mappings,
    compatibilityResults,
    presetOverrides,
    polarityIssues,
    runCompatibility,
  } = useStore();

  const [running, setRunning] = useState(false);

  const handleRunCheck = () => {
    setRunning(true);
    setTimeout(() => {
      runCompatibility();
      setRunning(false);
    }, 600);
  };

  const pieData = buildPieData(compatibilityResults);
  const timelineData = buildTimelineData(presets);
  const warnings = buildWarnings(compatibilityResults, presetOverrides, polarityIssues, presets, models, mappings);

  const activeWarnings = compatibilityResults.filter((r) => r.status !== 'compatible').length;

  const stats = [
    { label: '预设总数', value: presets.length, icon: Music, color: 'text-amber-500' },
    { label: '键盘型号', value: models.length, icon: Monitor, color: 'text-amber-500' },
    { label: '踏板映射', value: mappings.length, icon: Footprints, color: 'text-amber-500' },
    { label: '待处理警告', value: activeWarnings, icon: AlertTriangle, color: 'text-red-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#FAF5EF]">仓库总览</h1>
        <button
          onClick={handleRunCheck}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0E0E1A] font-medium rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          运行检查
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative group rounded-xl p-[1px] bg-gradient-to-br from-amber-500/30 via-transparent to-amber-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10"
          >
            <div className="rounded-xl bg-[#1A1A2E] p-5 h-full">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-3xl font-bold text-[#FAF5EF]">{stat.value}</div>
              <div className="text-sm text-[#8A8AA0] mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A1A2E] rounded-xl p-5">
          <h2 className="text-lg font-semibold text-[#FAF5EF] mb-4">兼容性分布</h2>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-[#8A8AA0] text-sm">
              点击「运行检查」查看兼容性分析
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1A1A2E',
                      border: '1px solid #2A2A4A',
                      borderRadius: '8px',
                      color: '#FAF5EF',
                    }}
                    itemStyle={{ color: '#FAF5EF' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {pieData.map((entry) => (
                  <div key={entry.key} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[entry.key] }}
                    />
                    <span className="text-xs text-[#8A8AA0]">{entry.name}</span>
                    <span className="text-xs text-[#FAF5EF] font-medium">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-[#1A1A2E] rounded-xl p-5">
          <h2 className="text-lg font-semibold text-[#FAF5EF] mb-4">导入时间线</h2>
          {timelineData.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-[#8A8AA0] text-sm">
              暂无导入数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timelineData}>
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8A8AA0', fontSize: 11 }}
                  axisLine={{ stroke: '#2A2A4A' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#8A8AA0', fontSize: 11 }}
                  axisLine={{ stroke: '#2A2A4A' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1A2E',
                    border: '1px solid #2A2A4A',
                    borderRadius: '8px',
                    color: '#FAF5EF',
                  }}
                  itemStyle={{ color: '#FAF5EF' }}
                  cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }}
                />
                <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-[#1A1A2E] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-[#FAF5EF] mb-4">警告汇总</h2>
        {warnings.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[#8A8AA0] text-sm">
            {compatibilityResults.length === 0 ? '运行检查后查看警告信息' : '暂无警告'}
          </div>
        ) : (
          <div className="space-y-2">
            {warnings.map((item) => (
              <WarningRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
