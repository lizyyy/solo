import { useState } from 'react';
import { useAppStore } from '@/store';
import {
  ProblemType,
  ConfirmationStatus,
  SourceType,
  PROBLEM_TYPE_LABELS,
  CONFIRMATION_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  INSTRUMENT_LABELS,
  formatTime,
} from '@/types';
import { Filter, X, RotateCcw, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

export function FilterPanel() {
  const {
    filters,
    setFilters,
    resetFilters,
    voiceParts,
    statistics,
    viewRange,
    setViewRange,
  } = useAppStore();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    voicePart: true,
    problemType: true,
    status: true,
    source: true,
    timeRange: false,
    advanced: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleVoicePartToggle = (voicePartId: string) => {
    const newIds = filters.voicePartIds.includes(voicePartId)
      ? filters.voicePartIds.filter((id) => id !== voicePartId)
      : [...filters.voicePartIds, voicePartId];
    setFilters({ voicePartIds: newIds });
  };

  const handleProblemTypeToggle = (type: ProblemType) => {
    const newTypes = filters.problemTypes.includes(type)
      ? filters.problemTypes.filter((t) => t !== type)
      : [...filters.problemTypes, type];
    setFilters({ problemTypes: newTypes });
  };

  const handleStatusToggle = (status: ConfirmationStatus) => {
    const newStatuses = filters.confirmationStatuses.includes(status)
      ? filters.confirmationStatuses.filter((s) => s !== status)
      : [...filters.confirmationStatuses, status];
    setFilters({ confirmationStatuses: newStatuses });
  };

  const handleSourceToggle = (source: SourceType) => {
    const newSources = filters.sourceTypes.includes(source)
      ? filters.sourceTypes.filter((s) => s !== source)
      : [...filters.sourceTypes, source];
    setFilters({ sourceTypes: newSources });
  };

  const hasActiveFilters =
    filters.voicePartIds.length > 0 ||
    filters.problemTypes.length > 0 ||
    filters.confirmationStatuses.length > 0 ||
    filters.sourceTypes.length > 0 ||
    filters.minConfidence > 0 ||
    filters.maxDeviation < 500;

  const SectionHeader = ({
    title,
    section,
    count,
  }: {
    title: string;
    section: string;
    count?: number;
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between text-sm font-medium text-primary-200 hover:text-primary-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span>{title}</span>
        {count !== undefined && (
          <span className="text-xs bg-primary-700 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </div>
      {expandedSections[section] ? (
        <ChevronUp size={16} />
      ) : (
        <ChevronDown size={16} />
      )}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-primary-900 border-r border-primary-700">
      <div className="p-4 border-b border-primary-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-primary-400" />
            <h2 className="font-semibold text-primary-100">筛选器</h2>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-200 transition-colors"
            >
              <RotateCcw size={14} />
              重置
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5">
            {filters.voicePartIds.map((id) => {
              const part = voiceParts.find((v) => v.id === id);
              return (
                <span
                  key={id}
                  className="tag tag-system flex items-center gap-1"
                >
                  {part?.name}
                  <button
                    onClick={() => handleVoicePartToggle(id)}
                    className="hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
            {filters.problemTypes.map((type) => (
              <span
                key={type}
                className={`tag flex items-center gap-1 ${
                  type === 'voice_overlap'
                    ? 'tag-overlap'
                    : type === 'section_misalignment'
                    ? 'tag-misalignment'
                    : 'tag-noise'
                }`}
              >
                {PROBLEM_TYPE_LABELS[type]}
                <button
                  onClick={() => handleProblemTypeToggle(type)}
                  className="hover:text-white"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {filters.confirmationStatuses.map((status) => (
              <span
                key={status}
                className={`tag flex items-center gap-1 ${
                  status === 'confirmed'
                    ? 'tag-confirmed'
                    : status === 'rejected'
                    ? 'tag-rejected'
                    : 'tag-pending'
                }`}
              >
                {CONFIRMATION_STATUS_LABELS[status]}
                <button
                  onClick={() => handleStatusToggle(status)}
                  className="hover:text-white"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {filters.sourceTypes.map((source) => (
              <span
                key={source}
                className={`tag flex items-center gap-1 ${
                  source === 'system' ? 'tag-system' : 'tag-manual'
                }`}
              >
                {SOURCE_TYPE_LABELS[source]}
                <button
                  onClick={() => handleSourceToggle(source)}
                  className="hover:text-white"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {statistics && (
          <div className="card bg-primary-800/50">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-primary-400" />
              <span className="text-sm font-medium text-primary-200">统计概览</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-primary-400">错音总数</span>
                <span className="font-mono font-semibold text-primary-100">
                  {statistics.total}
                </span>
              </div>
              <div className="h-px bg-primary-700 my-2" />
              <div className="space-y-1.5">
                {(
                  Object.entries(statistics.byProblemType) as [
                    ProblemType,
                    number
                  ][]
                ).map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        type === 'voice_overlap'
                          ? 'bg-problem-overlap'
                          : type === 'section_misalignment'
                          ? 'bg-problem-misalignment'
                          : 'bg-problem-noise'
                      }`}
                    />
                    <span className="text-xs text-primary-400 flex-1">
                      {PROBLEM_TYPE_LABELS[type]}
                    </span>
                    <span className="text-xs font-mono text-primary-200">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-px bg-primary-700 my-2" />
              <div className="space-y-1.5">
                {(
                  Object.entries(statistics.byConfirmationStatus) as [
                    ConfirmationStatus,
                    number
                  ][]
                ).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        status === 'confirmed'
                          ? 'bg-status-confirmed'
                          : status === 'rejected'
                          ? 'bg-status-rejected'
                          : 'bg-status-pending'
                      }`}
                    />
                    <span className="text-xs text-primary-400 flex-1">
                      {CONFIRMATION_STATUS_LABELS[status]}
                    </span>
                    <span className="text-xs font-mono text-primary-200">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <SectionHeader
            title="声部筛选"
            section="voicePart"
            count={
              filters.voicePartIds.length > 0
                ? filters.voicePartIds.length
                : undefined
            }
          />
          {expandedSections.voicePart && (
            <div className="space-y-2">
              {voiceParts.map((part) => (
                <label
                  key={part.id}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={filters.voicePartIds.includes(part.id)}
                    onChange={() => handleVoicePartToggle(part.id)}
                    className="w-4 h-4 rounded border-primary-600 bg-primary-900 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-primary-200 group-hover:text-primary-100">
                    {part.name}
                  </span>
                  <span className="text-xs text-primary-500">
                    ({INSTRUMENT_LABELS[part.instrument]})
                  </span>
                  <span
                    className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                      part.sourceType === 'system'
                        ? 'bg-source-system/20 text-source-system'
                        : 'bg-source-manual/20 text-source-manual'
                    }`}
                  >
                    {SOURCE_TYPE_LABELS[part.sourceType]}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SectionHeader
            title="问题类型"
            section="problemType"
            count={
              filters.problemTypes.length > 0
                ? filters.problemTypes.length
                : undefined
            }
          />
          {expandedSections.problemType && (
            <div className="space-y-2">
              {(
                Object.keys(PROBLEM_TYPE_LABELS) as ProblemType[]
              ).map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={filters.problemTypes.includes(type)}
                    onChange={() => handleProblemTypeToggle(type)}
                    className="w-4 h-4 rounded border-primary-600 bg-primary-900 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
                  />
                  <div
                    className={`w-3 h-3 rounded-full ${
                      type === 'voice_overlap'
                        ? 'bg-problem-overlap'
                        : type === 'section_misalignment'
                        ? 'bg-problem-misalignment'
                        : 'bg-problem-noise'
                    }`}
                  />
                  <span className="text-sm text-primary-200 group-hover:text-primary-100">
                    {PROBLEM_TYPE_LABELS[type]}
                  </span>
                  <span className="ml-auto text-xs text-primary-500">
                    {statistics?.byProblemType[type] || 0}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SectionHeader
            title="确认状态"
            section="status"
            count={
              filters.confirmationStatuses.length > 0
                ? filters.confirmationStatuses.length
                : undefined
            }
          />
          {expandedSections.status && (
            <div className="space-y-2">
              {(
                Object.keys(CONFIRMATION_STATUS_LABELS) as ConfirmationStatus[]
              ).map((status) => (
                <label
                  key={status}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={filters.confirmationStatuses.includes(status)}
                    onChange={() => handleStatusToggle(status)}
                    className="w-4 h-4 rounded border-primary-600 bg-primary-900 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
                  />
                  <div
                    className={`w-3 h-3 rounded-full ${
                      status === 'confirmed'
                        ? 'bg-status-confirmed'
                        : status === 'rejected'
                        ? 'bg-status-rejected'
                        : 'bg-status-pending'
                    }`}
                  />
                  <span className="text-sm text-primary-200 group-hover:text-primary-100">
                    {CONFIRMATION_STATUS_LABELS[status]}
                  </span>
                  <span className="ml-auto text-xs text-primary-500">
                    {statistics?.byConfirmationStatus[status] || 0}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SectionHeader
            title="数据来源"
            section="source"
            count={
              filters.sourceTypes.length > 0
                ? filters.sourceTypes.length
                : undefined
            }
          />
          {expandedSections.source && (
            <div className="space-y-2">
              {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map((source) => (
                <label
                  key={source}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={filters.sourceTypes.includes(source)}
                    onChange={() => handleSourceToggle(source)}
                    className="w-4 h-4 rounded border-primary-600 bg-primary-900 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-primary-200 group-hover:text-primary-100">
                    {SOURCE_TYPE_LABELS[source]}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SectionHeader title="时间范围" section="timeRange" />
          {expandedSections.timeRange && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-primary-400 block mb-1">
                    开始时间
                  </label>
                  <input
                    type="text"
                    value={formatTime(viewRange[0])}
                    readOnly
                    className="input w-full text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-primary-400 block mb-1">
                    结束时间
                  </label>
                  <input
                    type="text"
                    value={formatTime(viewRange[1])}
                    readOnly
                    className="input w-full text-xs font-mono"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (filters.timeRange) {
                    setFilters({ timeRange: null });
                  } else {
                    setFilters({ timeRange: [viewRange[0], viewRange[1]] });
                  }
                }}
                className={`w-full text-sm py-2 rounded-lg border transition-colors ${
                  filters.timeRange
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-primary-800 border-primary-600 text-primary-200 hover:bg-primary-700'
                }`}
              >
                {filters.timeRange ? '取消时间范围筛选' : '应用当前视图范围'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <SectionHeader title="高级筛选" section="advanced" />
          {expandedSections.advanced && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-primary-400">最低置信度</label>
                  <span className="text-xs font-mono text-primary-300">
                    {(filters.minConfidence * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={filters.minConfidence}
                  onChange={(e) =>
                    setFilters({ minConfidence: parseFloat(e.target.value) })
                  }
                  className="w-full accent-primary-500"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-primary-400">最大偏差</label>
                  <span className="text-xs font-mono text-primary-300">
                    {filters.maxDeviation} 音分
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={filters.maxDeviation}
                  onChange={(e) =>
                    setFilters({ maxDeviation: parseInt(e.target.value) })
                  }
                  className="w-full accent-primary-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
