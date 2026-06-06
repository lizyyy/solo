import { useState, useMemo } from 'react';
import { ShortageRecord, ChangeLog, RecordStatus } from '@/types';
import { StatusBadge } from './StatusBadge';
import { EvidencePanel } from './EvidencePanel';
import { useStore } from '@/store/useStore';
import { canUserConfirm } from '@/utils/boundaryRules';
import {
  ChevronDown,
  ChevronUp,
  Music,
  Hash,
  MessageSquare,
  CheckCircle,
  Eye,
  AlertTriangle,
  Edit3
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface RecordCardProps {
  record: ShortageRecord;
}

export function RecordCard({ record }: RecordCardProps) {
  const [expanded, setExpanded] = useState(false);
  const allLogs = useStore(state => state.changeLogs);
  const matchAliasForRecord = useStore(state => state.matchAliasForRecord);
  const updateRecordStatus = useStore(state => state.updateRecordStatus);
  const currentUser = useStore(state => state.currentUser);
  const aliases = useStore(state => state.aliases);

  const logs = useMemo(() => {
    return allLogs
      .filter(l => l.recordId === record.id)
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  }, [allLogs, record.id]);

  const canConfirm = canUserConfirm(record.status, currentUser.role);
  const needsAlias = !record.standardTrackName && record.status === 'pending';

  const handleMatchAlias = () => {
    const matched = aliases.find(a => a.aliasName === record.trackName || a.standardName === record.trackName);
    const standardName = matched ? matched.standardName : record.trackName;
    matchAliasForRecord(record.id, standardName, currentUser.name);
  };

  const handleConfirm = () => {
    if (record.status === 'review_needed') {
      updateRecordStatus(record.id, 'reviewed', currentUser.name, '巡演统筹复核通过');
    } else {
      updateRecordStatus(record.id, 'confirmed', currentUser.name, '音乐老师确认');
    }
  };

  return (
    <div className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${
      record.isBoundaryCase
        ? 'border-red-200 shadow-sm hover:border-red-300 hover:shadow'
        : 'border-stone-200 shadow-sm hover:border-amber-300 hover:shadow'
    }`}>
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={record.status} size="sm" />
              {record.isBoundaryCase && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  边界场景
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Music className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <h3 className="font-medium text-stone-800 truncate">
                {record.standardTrackName || record.trackName}
              </h3>
              {record.standardTrackName && record.standardTrackName !== record.trackName && (
                <span className="text-xs text-stone-500">（别名：{record.trackName}）</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
              <div className="flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" />
                原始行号: {record.originalLineNumber}
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-amber-700">{record.shortageQuantity} 张</span>
                <span className="text-stone-500">缺货</span>
              </div>
            </div>

            {record.currentNote && (
              <div className="mt-2 flex items-start gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-stone-600 line-clamp-2">{record.currentNote}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/record/${record.id}`}
              onClick={(e) => e.stopPropagation()}
              className="p-2 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="查看详情"
            >
              <Edit3 className="w-4 h-4" />
            </Link>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-stone-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-stone-400" />
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {needsAlias && currentUser.role === 'music_teacher' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleMatchAlias(); }}
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              <Music className="w-3.5 h-3.5" />
              补看曲目别名表
            </button>
          )}
          {canConfirm && (
            <button
              onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                record.status === 'review_needed'
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              {record.status === 'review_needed' ? (
                <><Eye className="w-3.5 h-3.5" /> 巡演统筹复核</>
              ) : (
                <><CheckCircle className="w-3.5 h-3.5" /> 确认</>
              )}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-stone-200 p-4 bg-stone-50">
          <EvidencePanel record={record} logs={logs} />
        </div>
      )}
    </div>
  );
}
