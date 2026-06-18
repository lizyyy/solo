import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Plus,
  Image as ImageIcon,
  MessageSquare,
  Link as LinkIcon,
  TrendingDown,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Play,
  Upload,
  History,
} from 'lucide-react';
import { useTrackingStore } from '@/stores/trackingStore';
import type { TrackingRecord, RecordStatus, RecordSource } from '@/types/tracking';
import { cn } from '@/lib/utils';

const statusMap: Record<RecordStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待处理', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  processing: { label: '处理中', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  completed: { label: '已完成', color: 'text-green-700', bgColor: 'bg-green-100' },
  withdrawn: { label: '已撤回', color: 'text-gray-700', bgColor: 'bg-gray-200' },
  delayed: { label: '延期', color: 'text-red-700', bgColor: 'bg-red-100' },
};

const sourceMap: Record<RecordSource, { label: string; color: string }> = {
  'on-site': { label: '现场签证', color: 'text-purple-600' },
  'change-order': { label: '变更单', color: 'text-orange-600' },
  withdrawal: { label: '撤回复测', color: 'text-rose-600' },
  'old-material': { label: '旧材料', color: 'text-teal-600' },
};

const buildings = ['1号楼', '2号楼', '3号楼', '4号楼', '5号楼'];

function StatusBadge({ status }: { status: RecordStatus }) {
  const config = statusMap[status];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', config.bgColor, config.color)}>
      {status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
      {status === 'processing' && <Play className="w-3 h-3 mr-1" />}
      {status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
      {status === 'withdrawn' && <XCircle className="w-3 h-3 mr-1" />}
      {status === 'delayed' && <AlertTriangle className="w-3 h-3 mr-1" />}
      {config.label}
    </span>
  );
}

function SourceBadge({ source }: { source: RecordSource }) {
  const config = sourceMap[source];
  return <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>;
}

function PriorityDot({ priority }: { priority: 'low' | 'medium' | 'high' }) {
  const colors = {
    low: 'bg-green-400',
    medium: 'bg-amber-400',
    high: 'bg-red-500',
  };
  return <span className={cn('w-2 h-2 rounded-full', colors[priority])} />;
}

function SummaryCards() {
  const records = useTrackingStore((state) => state.records);

  const summary = useMemo(() => {
    const pendingRecords = records.filter(
      (r) => r.status === 'pending' || r.status === 'processing' || r.status === 'delayed'
    );
    return {
      total: pendingRecords.length,
      highPriority: pendingRecords.filter((r) => r.priority === 'high').length,
      delayed: pendingRecords.filter((r) => r.status === 'delayed').length,
      abnormal: pendingRecords.filter((r) => r.isAbnormal).length,
    };
  }, [records]);

  const cards = [
    { label: '待处理总数', value: summary.total, color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Clock },
    { label: '高优先级', value: summary.highPriority, color: 'text-red-600', bgColor: 'bg-red-50', icon: AlertTriangle },
    { label: '延期记录', value: summary.delayed, color: 'text-orange-600', bgColor: 'bg-orange-50', icon: TrendingDown },
    { label: '异常记录', value: summary.abnormal, color: 'text-rose-600', bgColor: 'bg-rose-50', icon: AlertCircle },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className={cn('rounded-xl p-4', card.bgColor)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{card.label}</p>
              <p className={cn('text-2xl font-bold mt-1', card.color)}>{card.value}</p>
            </div>
            <card.icon className={cn('w-8 h-8', card.color, 'opacity-70')} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterBar() {
  const filters = useTrackingStore((state) => state.filters);
  const setFilters = useTrackingStore((state) => state.setFilters);
  const resetFilters = useTrackingStore((state) => state.resetFilters);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">筛选条件</span>
        </div>

        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索记录编号、标题..."
              value={filters.keyword}
              onChange={(e) => setFilters({ keyword: e.target.value })}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value as RecordStatus | 'all' })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="processing">处理中</option>
            <option value="completed">已完成</option>
            <option value="withdrawn">已撤回</option>
            <option value="delayed">延期</option>
          </select>

          <select
            value={filters.source}
            onChange={(e) => setFilters({ source: e.target.value as RecordSource | 'all' })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部来源</option>
            <option value="on-site">现场签证</option>
            <option value="change-order">变更单</option>
            <option value="withdrawal">撤回复测</option>
            <option value="old-material">旧材料</option>
          </select>

          <select
            value={filters.building}
            onChange={(e) => setFilters({ building: e.target.value })}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部楼栋</option>
            {buildings.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={String(filters.isAbnormal)}
            onChange={(e) =>
              setFilters({
                isAbnormal: e.target.value === 'all' ? 'all' : e.target.value === 'true',
              })
            }
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部异常</option>
            <option value="true">仅异常</option>
            <option value="false">正常</option>
          </select>
        </div>

        <button
          onClick={resetFilters}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重置
        </button>
      </div>
    </div>
  );
}

function RecordListItem({ record, isSelected, onClick }: { record: TrackingRecord; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50',
        isSelected && 'bg-blue-50 border-l-4 border-l-blue-500'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <PriorityDot priority={record.priority} />
            <span className="text-xs text-gray-500 font-mono">{record.recordNo}</span>
            <SourceBadge source={record.source} />
            {record.isAbnormal && (
              <span className="inline-flex items-center text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                <AlertTriangle className="w-3 h-3 mr-0.5" />
                异常
              </span>
            )}
          </div>
          <h4 className="font-medium text-gray-900 text-sm truncate">{record.title}</h4>
          <p className="text-xs text-gray-500 mt-1 truncate">{record.building} · 更新于 {record.updatedAt}</p>
        </div>
        <StatusBadge status={record.status} />
      </div>
    </div>
  );
}

function WithdrawalTrack({ record }: { record: TrackingRecord }) {
  const records = useTrackingStore((state) => state.records);
  const selectRecord = useTrackingStore((state) => state.selectRecord);

  const finalRecord = useMemo(() => {
    if (!record.withdrawalRecordId) return null;
    return records.find((r) => r.id === record.withdrawalRecordId) || null;
  }, [records, record.withdrawalRecordId]);

  if (record.status !== 'withdrawn' || !finalRecord) {
    return null;
  }

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-rose-600" />
        <span className="font-medium text-rose-700 text-sm">撤回追踪</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-gray-500">原结论已撤回</p>
          <p className="text-sm text-gray-700 mt-0.5 line-through">{record.currentConclusion}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <div className="flex-1">
          <p className="text-xs text-green-600 font-medium">最新结论</p>
          <p className="text-sm text-gray-700 mt-0.5">{finalRecord.currentConclusion}</p>
        </div>
      </div>
      <button
        onClick={() => selectRecord(finalRecord.id)}
        className="mt-3 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
      >
        查看最新记录 <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}

function AbnormalExplanation({ record }: { record: TrackingRecord }) {
  if (!record.isAbnormal) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <span className="font-medium text-amber-700 text-sm">异常说明</span>
      </div>
      {record.abnormalReason && (
        <div className="mb-2">
          <p className="text-xs text-gray-500">异常原因</p>
          <p className="text-sm text-gray-700 mt-0.5">{record.abnormalReason}</p>
        </div>
      )}
      {record.conclusionChangeReason && (
        <div>
          <p className="text-xs text-gray-500">结论变化原因</p>
          <p className="text-sm text-gray-700 mt-0.5">{record.conclusionChangeReason}</p>
        </div>
      )}
    </div>
  );
}

function DelayAlert({ record }: { record: TrackingRecord }) {
  if (record.status !== 'delayed' || !record.nextStepSuggestion) return null;

  const steps = record.nextStepSuggestion.split(/\d+\.\s+/).filter(Boolean);

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <div>
          <span className="font-medium text-red-700 text-sm">变更单延迟提醒</span>
          {record.changeOrderDueDate && (
            <p className="text-xs text-red-600 mt-0.5">应到日期：{record.changeOrderDueDate}</p>
          )}
        </div>
      </div>
      <div className="bg-white rounded-lg p-3 border border-red-100">
        <p className="text-xs font-medium text-gray-700 mb-2">下一步处理建议：</p>
        <ul className="space-y-1.5">
          {steps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="flex-shrink-0 w-5 h-5 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-medium">
                {idx + 1}
              </span>
              <span>{step.trim()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function NotesSection({ record }: { record: TrackingRecord }) {
  const addNote = useTrackingStore((state) => state.addNote);
  const [noteText, setNoteText] = useState('');
  const [showAll, setShowAll] = useState(false);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote(record.id, noteText, '当前用户');
    setNoteText('');
  };

  const displayNotes = showAll ? record.notes : record.notes.slice(0, 3);

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-700 text-sm">人工备注</span>
          <span className="text-xs text-gray-400">({record.notes.length})</span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {record.notes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">暂无备注</p>
        ) : (
          <>
            {displayNotes.map((note) => (
              <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{note.author}</span>
                  <span className="text-xs text-gray-400">{note.createdAt}</span>
                </div>
                <p className="text-sm text-gray-600">{note.content}</p>
              </div>
            ))}
            {record.notes.length > 3 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto"
              >
                {showAll ? (
                  <>
                    收起 <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    查看全部 {record.notes.length} 条 <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
          placeholder="添加备注..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAddNote}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          添加
        </button>
      </div>
    </div>
  );
}

function ScreenshotsSection({ record }: { record: TrackingRecord }) {
  const addScreenshot = useTrackingStore((state) => state.addScreenshot);

  const handleAddDemoScreenshot = () => {
    addScreenshot(
      record.id,
      `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=building%20survey%20measurement%20site%20photo&image_size=square`,
      `现场截图 - ${new Date().toLocaleDateString('zh-CN')}`,
      '当前用户'
    );
  };

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-700 text-sm">截图说明</span>
          <span className="text-xs text-gray-400">({record.screenshots.length})</span>
        </div>
        <button
          onClick={handleAddDemoScreenshot}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          添加截图
        </button>
      </div>

      {record.screenshots.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">暂无截图</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {record.screenshots.map((shot) => (
            <div key={shot.id} className="group relative">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={shot.url}
                  alt={shot.description}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="mt-1.5">
                <p className="text-xs text-gray-700 font-medium truncate">{shot.description}</p>
                <p className="text-xs text-gray-400">{shot.uploader} · {shot.uploadedAt}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RelatedRecordsSection({ record }: { record: TrackingRecord }) {
  const records = useTrackingStore((state) => state.records);
  const selectRecord = useTrackingStore((state) => state.selectRecord);

  const related = useMemo(() => {
    return records.filter((r) => record.relatedRecords.includes(r.id));
  }, [records, record.relatedRecords]);

  if (related.length === 0) return null;

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <LinkIcon className="w-4 h-4 text-gray-500" />
        <span className="font-medium text-gray-700 text-sm">关联记录</span>
        <span className="text-xs text-gray-400">({related.length})</span>
      </div>
      <div className="space-y-2">
        {related.map((rel) => (
          <div
            key={rel.id}
            onClick={() => selectRecord(rel.id)}
            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-gray-700">{rel.recordNo}</p>
              <p className="text-xs text-gray-500 truncate max-w-48">{rel.title}</p>
            </div>
            <StatusBadge status={rel.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingExplanation({ record }: { record: TrackingRecord }) {
  if (record.status === 'completed' || record.status === 'withdrawn') return null;

  const explanationMap: Record<string, { title: string; details: string }> = {
    pending: {
      title: '待处理说明',
      details: '该记录尚未开始处理，请尽快安排现场测绘或资料审核。',
    },
    processing: {
      title: '处理中说明',
      details: '该记录正在处理中，请关注处理进度和后续更新。',
    },
    delayed: {
      title: '延期说明',
      details: '该记录因变更单未到或其他原因延期，请按建议步骤跟进。',
    },
  };

  const config = explanationMap[record.status];
  if (!config) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-700 text-sm">{config.title}</p>
          <p className="text-sm text-blue-600 mt-1">{config.details}</p>
          {record.handler && (
            <p className="text-xs text-blue-500 mt-1">处理人：{record.handler}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ record }: { record: TrackingRecord }) {
  return (
    <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500 font-mono">{record.recordNo}</span>
              <SourceBadge source={record.source} />
              <PriorityDot priority={record.priority} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{record.title}</h2>
          </div>
          <StatusBadge status={record.status} />
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{record.building}</span>
          <span>创建：{record.createdAt}</span>
          <span>更新：{record.updatedAt}</span>
          {record.handler && <span>处理人：{record.handler}</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">当前结论</h3>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-700 leading-relaxed">{record.currentConclusion}</p>
          </div>
        </div>

        <PendingExplanation record={record} />

        <AbnormalExplanation record={record} />

        <WithdrawalTrack record={record} />

        <DelayAlert record={record} />

        <NotesSection record={record} />

        <ScreenshotsSection record={record} />

        <RelatedRecordsSection record={record} />
      </div>
    </div>
  );
}

function ActionBar() {
  const addRecord = useTrackingStore((state) => state.addRecord);
  const importOldMaterial = useTrackingStore((state) => state.importOldMaterial);
  const addWithdrawalRecord = useTrackingStore((state) => state.addWithdrawalRecord);
  const selectedRecordId = useTrackingStore((state) => state.selectedRecordId);
  const records = useTrackingStore((state) => state.records);

  const handleImportOldMaterial = () => {
    const oldMaterials = [
      {
        recordNo: `CL-OLD-${String(records.length + 1).padStart(3, '0')}`,
        title: `旧材料导入-屋面渗漏测绘`,
        building: '2号楼',
        status: 'pending' as const,
        source: 'old-material' as const,
        currentConclusion: '待复核旧材料数据',
        isAbnormal: false,
        relatedRecords: [],
        notes: [],
        screenshots: [],
        priority: 'medium' as const,
        handler: '待分配',
      },
    ];
    importOldMaterial(oldMaterials);
  };

  const handleAddWithdrawal = () => {
    if (!selectedRecordId) {
      alert('请先选择一条记录');
      return;
    }
    addWithdrawalRecord(
      selectedRecordId,
      {
        currentConclusion: '待复测确认',
      },
      '数据复核有误，撤回原结论重新测绘'
    );
  };

  const handleAddRecord = () => {
    addRecord({
      recordNo: `CL-NEW-${String(records.length + 1).padStart(3, '0')}`,
      title: '新增测绘记录',
      building: '1号楼',
      status: 'pending',
      source: 'on-site',
      currentConclusion: '待现场确认',
      isAbnormal: false,
      priority: 'medium',
      handler: '待分配',
    });
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        onClick={handleImportOldMaterial}
        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors"
      >
        <Upload className="w-4 h-4" />
        导入旧材料
      </button>
      <button
        onClick={handleAddWithdrawal}
        className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        补撤回记录
      </button>
      <button
        onClick={handleAddRecord}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        新增记录
      </button>
    </div>
  );
}

export default function Home() {
  const records = useTrackingStore((state) => state.records);
  const filters = useTrackingStore((state) => state.filters);
  const selectedRecordId = useTrackingStore((state) => state.selectedRecordId);
  const selectRecord = useTrackingStore((state) => state.selectRecord);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filters.status !== 'all' && r.status !== filters.status) return false;
      if (filters.source !== 'all' && r.source !== filters.source) return false;
      if (filters.building && r.building !== filters.building) return false;
      if (filters.isAbnormal !== 'all' && r.isAbnormal !== filters.isAbnormal) return false;
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        if (
          !r.title.toLowerCase().includes(kw) &&
          !r.recordNo.toLowerCase().includes(kw) &&
          !r.currentConclusion.toLowerCase().includes(kw)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [records, filters]);

  const selectedRecord = useMemo(
    () => records.find((r) => r.id === selectedRecordId) || null,
    [records, selectedRecordId]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">旧楼测绘材料追踪</h1>
              <p className="text-xs text-gray-500">追踪测绘记录、变更单、撤回记录，确保结论可追溯</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <SummaryCards />

        <ActionBar />

        <FilterBar />

        <div className="flex gap-4" style={{ height: 'calc(100vh - 380px)', minHeight: '500px' }}>
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">记录列表</span>
                <span className="text-xs text-gray-500">共 {filteredRecords.length} 条</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                  <FileText className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">暂无符合条件的记录</p>
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <RecordListItem
                    key={record.id}
                    record={record}
                    isSelected={record.id === selectedRecordId}
                    onClick={() => selectRecord(record.id)}
                  />
                ))
              )}
            </div>
          </div>

          {selectedRecord ? (
            <DetailPanel record={selectedRecord} />
          ) : (
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <FileText className="w-16 h-16 mx-auto mb-3 opacity-50" />
                <p className="text-base">选择左侧记录查看详情</p>
                <p className="text-sm mt-1">可查看结论、备注、截图及关联记录</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
