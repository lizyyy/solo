import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import type { PedalMapping, PolarityIssue } from '@/types';
import {
  Footprints,
  Plus,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Search,
} from 'lucide-react';

function parseCcInput(input: string): Record<string, number> {
  const result: Record<string, number> = {};
  input.split(',').forEach((pair) => {
    const trimmed = pair.trim();
    if (!trimmed) return;
    const [key, val] = trimmed.split(':').map((s) => s.trim());
    if (key && val !== undefined) {
      result[key] = Number(val) || 0;
    }
  });
  return result;
}

function groupByName(mappings: PedalMapping[]): Record<string, PedalMapping[]> {
  const groups: Record<string, PedalMapping[]> = {};
  mappings.forEach((m) => {
    if (!groups[m.name]) groups[m.name] = [];
    groups[m.name].push(m);
  });
  Object.values(groups).forEach((arr) =>
    arr.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
  );
  return groups;
}

function hasPolarityIssue(mappingId: string, issues: PolarityIssue[]): boolean {
  return issues.some((i) => i.mappingId === mappingId);
}

function getIssuesForMapping(mappingId: string, issues: PolarityIssue[]): PolarityIssue[] {
  return issues.filter((i) => i.mappingId === mappingId);
}

export default function Pedals() {
  const {
    mappings,
    polarityIssues,
    presets,
    models,
    addMapping,
    selectedMappingId,
    setSelectedMapping,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formVersion, setFormVersion] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formPolarity, setFormPolarity] = useState<'normal' | 'reversed'>('normal');
  const [formCcInput, setFormCcInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareName, setCompareName] = useState<string | null>(null);

  const filteredMappings = useMemo(() => {
    if (!searchTerm) return mappings;
    const lower = searchTerm.toLowerCase();
    return mappings.filter(
      (m) =>
        m.name.toLowerCase().includes(lower) ||
        m.source.toLowerCase().includes(lower)
    );
  }, [mappings, searchTerm]);

  const grouped = useMemo(() => groupByName(filteredMappings), [filteredMappings]);

  const resetForm = () => {
    setFormName('');
    setFormVersion('');
    setFormSource('');
    setFormPolarity('normal');
    setFormCcInput('');
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formVersion.trim()) return;
    addMapping({
      name: formName.trim(),
      version: formVersion.trim(),
      source: formSource.trim(),
      polarity: formPolarity,
      ccMappings: parseCcInput(formCcInput),
    });
    resetForm();
    setShowModal(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setSelectedMapping(expandedId === id ? null : id);
  };

  const totalAffectedPresets = useMemo(() => {
    const ids = new Set<string>();
    polarityIssues.forEach((i) => i.affectedPresetIds.forEach((id) => ids.add(id)));
    return ids.size;
  }, [polarityIssues]);

  const totalAffectedModels = useMemo(() => {
    const ids = new Set<string>();
    polarityIssues.forEach((i) => i.affectedModelIds.forEach((id) => ids.add(id)));
    return ids.size;
  }, [polarityIssues]);

  return (
    <div className="min-h-screen bg-[#0E0E1A] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Footprints size={28} className="text-amber-500" />
            <h1 className="text-2xl font-bold text-[#FAF5EF]">踏板映射</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8AA0]"
              />
              <input
                type="text"
                placeholder="搜索映射名称或来源..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-lg pl-9 pr-4 py-2 text-sm text-[#FAF5EF] placeholder-[#8A8AA0] focus:outline-none focus:border-amber-500/50 w-64"
              />
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-[#0E0E1A] font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Plus size={16} />
              添加映射
            </button>
          </div>
        </div>

        {polarityIssues.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
              <span className="text-amber-400 font-semibold">
                检测到 {polarityIssues.length} 个极性反转问题
              </span>
            </div>
            <ul className="space-y-1.5 ml-7">
              {polarityIssues.map((issue) => {
                const mapping = mappings.find((m) => m.id === issue.mappingId);
                const prevMapping = mappings.find(
                  (m) => m.id === issue.previousMappingId
                );
                return (
                  <li key={issue.id} className="text-amber-300/80 text-sm">
                    {mapping?.name ?? '未知映射'} v{mapping?.version ?? '?'}
                    {prevMapping
                      ? `（与 v${prevMapping.version} 极性不一致）`
                      : '（极性已反转）'}
                    ：{issue.description}
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-4 ml-7 text-xs text-amber-400/70">
              <span>受影响预设：{totalAffectedPresets} 个</span>
              <span>受影响型号：{totalAffectedModels} 个</span>
            </div>
          </div>
        )}

        {Object.entries(grouped).map(([name, group]) => {
          const hasMultipleVersions = group.length > 1;
          const isComparing = compareName === name;

          return (
            <div key={name} className="space-y-3">
              {hasMultipleVersions && (
                <div className="flex items-center gap-2 mt-2">
                  <ArrowUpDown size={16} className="text-[#8A8AA0]" />
                  <span className="text-[#8A8AA0] text-sm">
                    {name} 存在 {group.length} 个版本
                  </span>
                  <button
                    onClick={() => setCompareName(isComparing ? null : name)}
                    className="text-amber-500 text-sm hover:text-amber-400 transition-colors"
                  >
                    {isComparing ? '收起对比' : '版本对比'}
                  </button>
                </div>
              )}

              {isComparing && hasMultipleVersions && (
                <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-[#8A8AA0] mb-4">
                    版本对比 — {name}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {group.map((m, idx) => {
                      const other = group[idx === 0 ? 1 : 0];
                      const polarityDiff =
                        other && m.polarity !== other.polarity;
                      const ccKeys = Object.keys(m.ccMappings);
                      const otherCcKeys = other
                        ? Object.keys(other.ccMappings)
                        : [];
                      const addedKeys = otherCcKeys.filter(
                        (k) => !ccKeys.includes(k)
                      );
                      const removedKeys = ccKeys.filter(
                        (k) => !otherCcKeys.includes(k)
                      );

                      return (
                        <div
                          key={m.id}
                          className={`border rounded-lg p-4 space-y-3 ${
                            m.isActive
                              ? 'border-amber-500/40 bg-amber-500/5'
                              : 'border-[#2A2A3E] bg-[#12121E]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[#FAF5EF] font-semibold">
                              v{m.version}
                            </span>
                            {m.isActive ? (
                              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                                当前活跃
                              </span>
                            ) : (
                              <span className="text-xs bg-[#2A2A3E] text-[#8A8AA0] px-2 py-0.5 rounded-full">
                                旧版本
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-[#8A8AA0]">极性：</span>
                              <span
                                className={
                                  polarityDiff
                                    ? m.polarity === 'reversed'
                                      ? 'text-red-400 font-semibold bg-red-500/10 px-1.5 py-0.5 rounded'
                                      : 'text-green-400 font-semibold bg-green-500/10 px-1.5 py-0.5 rounded'
                                    : 'text-[#FAF5EF]'
                                }
                              >
                                {m.polarity === 'normal' ? '↑ 正极性' : '↓ 反极性'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[#8A8AA0]">来源：</span>
                              <span className="text-[#FAF5EF]">{m.source}</span>
                            </div>
                            <div>
                              <span className="text-[#8A8AA0]">CC 映射：</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {ccKeys.map((key) => {
                                  const isRemoved = removedKeys.includes(key);
                                  return (
                                    <span
                                      key={key}
                                      className={`text-xs px-2 py-0.5 rounded ${
                                        isRemoved
                                          ? 'bg-red-500/20 text-red-400 line-through'
                                          : 'bg-[#2A2A3E] text-[#FAF5EF]'
                                      }`}
                                    >
                                      {key}: {m.ccMappings[key]}
                                    </span>
                                  );
                                })}
                                {addedKeys.map((key) =>
                                  other ? (
                                    <span
                                      key={key}
                                      className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400"
                                    >
                                      + {key}: {other.ccMappings[key]}
                                    </span>
                                  ) : null
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.map((mapping) => {
                  const hasIssue = hasPolarityIssue(mapping.id, polarityIssues);
                  const mappingIssues = getIssuesForMapping(
                    mapping.id,
                    polarityIssues
                  );
                  const isExpanded = expandedId === mapping.id;

                  return (
                    <div
                      key={mapping.id}
                      className={`rounded-xl border transition-all duration-200 cursor-pointer ${
                        hasIssue
                          ? 'border-red-500/40 bg-[#1A1A2E] hover:border-red-500/60 shadow-lg shadow-red-500/5'
                          : selectedMappingId === mapping.id
                          ? 'border-amber-500/40 bg-[#1A1A2E]'
                          : 'border-[#2A2A3E] bg-[#1A1A2E] hover:border-[#3A3A4E]'
                      }`}
                      onClick={() => toggleExpand(mapping.id)}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="text-lg font-bold text-[#FAF5EF]">
                              {mapping.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-[#2A2A3E] text-amber-400 px-2 py-0.5 rounded-full">
                                v{mapping.version}
                              </span>
                              <span className="text-xs text-[#8A8AA0]">
                                {mapping.source}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasIssue && (
                              <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                <AlertTriangle size={12} />
                                极性异常
                              </span>
                            )}
                            <span
                              className={`text-2xl font-bold leading-none ${
                                mapping.polarity === 'normal'
                                  ? 'text-green-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {mapping.polarity === 'normal' ? '↑' : '↓'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(mapping.ccMappings).map(
                            ([key, val]) => (
                              <span
                                key={key}
                                className="text-xs bg-[#2A2A3E] text-[#C8C8D8] px-2 py-0.5 rounded"
                              >
                                {key}: {val}
                              </span>
                            )
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {mapping.isActive ? (
                              <CheckCircle
                                size={14}
                                className="text-green-400"
                              />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full bg-[#2A2A3E] inline-block" />
                            )}
                            <span
                              className={`text-xs ${
                                mapping.isActive
                                  ? 'text-green-400'
                                  : 'text-[#8A8AA0]'
                              }`}
                            >
                              {mapping.isActive ? '活跃' : '未激活'}
                            </span>
                          </div>
                          <ChevronRight
                            size={16}
                            className={`text-[#8A8AA0] transition-transform duration-200 ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-[#2A2A3E] p-4 space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-[#8A8AA0] mb-2">
                              CC 映射详情
                            </h4>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[#8A8AA0] text-xs">
                                  <th className="text-left py-1">CC 编号</th>
                                  <th className="text-left py-1">默认值</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(mapping.ccMappings).map(
                                  ([key, val]) => (
                                    <tr
                                      key={key}
                                      className="border-t border-[#2A2A3E]"
                                    >
                                      <td className="py-1.5 text-[#FAF5EF]">
                                        {key}
                                      </td>
                                      <td className="py-1.5 text-[#C8C8D8]">
                                        {val}
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-[#8A8AA0] mb-2">
                              极性状态
                            </h4>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xl font-bold ${
                                  mapping.polarity === 'normal'
                                    ? 'text-green-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {mapping.polarity === 'normal' ? '↑' : '↓'}
                              </span>
                              <span className="text-sm text-[#FAF5EF]">
                                {mapping.polarity === 'normal'
                                  ? '正极性 — 踏下时值增大'
                                  : '反极性 — 踏下时值减小'}
                              </span>
                            </div>
                          </div>

                          {mappingIssues.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-red-400 mb-2">
                                极性警告
                              </h4>
                              <div className="space-y-2">
                                {mappingIssues.map((issue) => (
                                  <div
                                    key={issue.id}
                                    className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-300"
                                  >
                                    <p>{issue.description}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-red-400/70">
                                      <span>
                                        受影响预设：
                                        {
                                          issue.affectedPresetIds.filter((id) =>
                                            presets.some((p) => p.id === id)
                                          ).length
                                        }{' '}
                                        个
                                      </span>
                                      <span>
                                        受影响型号：
                                        {
                                          issue.affectedModelIds.filter((id) =>
                                            models.some((m) => m.id === id)
                                          ).length
                                        }{' '}
                                        个
                                      </span>
                                    </div>
                                    <div className="mt-2 text-xs text-[#8A8AA0]">
                                      受影响预设：
                                      {issue.affectedPresetIds
                                        .map(
                                          (id) =>
                                            presets.find((p) => p.id === id)
                                              ?.name
                                        )
                                        .filter(Boolean)
                                        .join('、') || '无'}
                                    </div>
                                    <div className="mt-1 text-xs text-[#8A8AA0]">
                                      受影响型号：
                                      {issue.affectedModelIds
                                        .map(
                                          (id) =>
                                            models.find((m) => m.id === id)
                                              ?.model
                                        )
                                        .filter(Boolean)
                                        .join('、') || '无'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <h4 className="text-xs font-semibold text-[#8A8AA0] mb-1">
                              导入时间
                            </h4>
                            <p className="text-sm text-[#C8C8D8]">
                              {new Date(mapping.importedAt).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredMappings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#8A8AA0]">
            <Footprints size={48} className="mb-4 opacity-30" />
            <p className="text-lg">暂无踏板映射</p>
            <p className="text-sm mt-1">点击"添加映射"来创建第一个映射</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowModal(false);
              resetForm();
            }}
          />
          <div className="relative bg-[#1A1A2E] border border-[#2A2A3E] rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <h2 className="text-lg font-bold text-[#FAF5EF]">添加踏板映射</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#8A8AA0] mb-1">名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：Sustain Pedal"
                  className="w-full bg-[#12121E] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-[#FAF5EF] placeholder-[#8A8AA0] focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8A8AA0] mb-1">版本</label>
                <input
                  type="text"
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                  placeholder="例如：1.0"
                  className="w-full bg-[#12121E] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-[#FAF5EF] placeholder-[#8A8AA0] focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8A8AA0] mb-1">来源</label>
                <input
                  type="text"
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  placeholder="例如：出厂默认"
                  className="w-full bg-[#12121E] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-[#FAF5EF] placeholder-[#8A8AA0] focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-[#8A8AA0] mb-1">极性</label>
                <select
                  value={formPolarity}
                  onChange={(e) =>
                    setFormPolarity(e.target.value as 'normal' | 'reversed')
                  }
                  className="w-full bg-[#12121E] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-[#FAF5EF] focus:outline-none focus:border-amber-500/50"
                >
                  <option value="normal">正极性 (↑ normal)</option>
                  <option value="reversed">反极性 (↓ reversed)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#8A8AA0] mb-1">
                  CC 映射
                </label>
                <input
                  type="text"
                  value={formCcInput}
                  onChange={(e) => setFormCcInput(e.target.value)}
                  placeholder="例如：CC64: 0, CC11: 0"
                  className="w-full bg-[#12121E] border border-[#2A2A3E] rounded-lg px-3 py-2 text-sm text-[#FAF5EF] placeholder-[#8A8AA0] focus:outline-none focus:border-amber-500/50"
                />
                <p className="text-xs text-[#8A8AA0] mt-1">
                  格式：CC编号: 默认值，用逗号分隔
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 rounded-lg text-sm text-[#8A8AA0] hover:text-[#FAF5EF] hover:bg-[#2A2A3E] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formName.trim() || !formVersion.trim()}
                className="px-4 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-[#0E0E1A] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
