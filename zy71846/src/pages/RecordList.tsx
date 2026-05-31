import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import type { RecordStatus, RecordSource } from '../types';
import { STATUS_LABELS, SOURCE_LABELS } from '../types';

const STATUS_COLORS: Record<RecordStatus, string> = {
  normal: 'bg-emerald-500',
  pending: 'bg-amber-500',
  reviewed: 'bg-sky-500',
  closed: 'bg-gray-400',
};

const STATUS_TEXT_COLORS: Record<RecordStatus, string> = {
  normal: 'text-emerald-600 bg-emerald-50',
  pending: 'text-amber-600 bg-amber-50',
  reviewed: 'text-sky-600 bg-sky-50',
  closed: 'text-gray-500 bg-gray-100',
};

const STATUS_ICONS: Record<RecordStatus, React.ReactNode> = {
  normal: <CheckCircle size={14} />,
  pending: <Clock size={14} />,
  reviewed: <CheckCircle size={14} />,
  closed: <XCircle size={14} />,
};

const SOURCE_COLORS: Record<RecordSource, string> = {
  initial: 'bg-green-100 text-green-700',
  late_attachment: 'bg-amber-100 text-amber-700',
  duplicate: 'bg-red-100 text-red-700',
  manual_correction: 'bg-blue-100 text-blue-700',
};

type FilterKey = '全部' | '正常' | '待处理' | '已复核' | '已关闭';
const FILTER_OPTIONS: FilterKey[] = ['全部', '正常', '待处理', '已复核', '已关闭'];
const FILTER_STATUS_MAP: Record<string, RecordStatus | null> = {
  '全部': null,
  '正常': 'normal',
  '待处理': 'pending',
  '已复核': 'reviewed',
  '已关闭': 'closed',
};

export default function RecordList() {
  const navigate = useNavigate();
  const records = useRecordStore((s) => s.records);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('全部');
  const [searchText, setSearchText] = useState('');

  const stats = useMemo(() => {
    const pending = records.filter((r) => r.status === 'pending').length;
    const disputed = records.filter((r) => r.isDisputed).length;
    const normal = records.filter((r) => r.status === 'normal').length;
    return { pending, disputed, normal, total: records.length };
  }, [records]);

  const filtered = useMemo(() => {
    let result = records;
    const status = FILTER_STATUS_MAP[activeFilter];
    if (status) result = result.filter((r) => r.status === status);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.cabinetId.toLowerCase().includes(q) ||
          r.artifactName.toLowerCase().includes(q) ||
          r.artifactCode.toLowerCase().includes(q) ||
          r.position.toLowerCase().includes(q)
      );
    }
    return result;
  }, [records, activeFilter, searchText]);

  const statCards = [
    { label: '待处理', value: stats.pending },
    { label: '争议', value: stats.disputed },
    { label: '正常', value: stats.normal },
    { label: '总数', value: stats.total },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f0e8' }}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="grid grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white rounded-xl shadow-sm p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: '#c48a5a' }}>{s.value}</div>
              <div className="text-xs mt-1 font-medium" style={{ color: '#2d5a3d' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === f
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              style={activeFilter === f ? { backgroundColor: '#2d5a3d' } : undefined}
            >
              {f}
            </button>
          ))}
          <div className="flex-1 min-w-[160px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索展柜/文物/位置..."
              className="w-full pl-9 pr-3 py-1.5 rounded-full bg-white text-sm outline-none shadow-sm focus:ring-2 focus:ring-emerald-300"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((record) => (
            <div
              key={record.id}
              onClick={() => navigate(`/record/${record.id}`)}
              className="bg-white rounded-xl shadow-sm flex overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className={`w-1.5 shrink-0 ${STATUS_COLORS[record.status]}`} />

              <div className="flex-1 p-4 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">{record.cabinetId}</span>
                  <span className="text-gray-500 text-sm">·</span>
                  <span className="text-gray-700 text-sm truncate">{record.artifactName}</span>
                  <span className="text-gray-400 text-xs shrink-0">{record.artifactCode}</span>
                  {record.isDisputed && (
                    <span className="inline-flex items-center gap-0.5 text-red-600 text-xs font-semibold shrink-0">
                      <AlertTriangle size={12} /> 争议
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <span>{record.position}</span>
                  <span>坐标 {record.coordinateAxis}</span>
                  {record.axisFlipped && <span className="text-amber-600">轴向翻转</span>}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLORS[record.source]}`}>
                    {SOURCE_LABELS[record.source]}
                  </span>
                  {record.status === 'pending' && record.pendingReason && (
                    <span className="text-xs text-gray-400 line-clamp-2">{record.pendingReason}</span>
                  )}
                </div>
              </div>

              <div className="shrink-0 p-4 flex flex-col items-end justify-between gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_TEXT_COLORS[record.status]}`}>
                  {STATUS_ICONS[record.status]}
                  {STATUS_LABELS[record.status]}
                </span>
                <div className="text-right">
                  <div className="text-xs text-gray-400">{record.createdAt}</div>
                  <div className="text-xs text-gray-400">{record.createdBy}</div>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">暂无记录</div>
          )}
        </div>
      </div>
    </div>
  );
}
