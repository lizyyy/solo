import { useEffect, useState } from 'react';
import { X, Table, Camera, Image, FileText, PenTool, Edit3, History, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { SourceType } from '@/types';
import { cn } from '@/lib/utils';

const sourceIcons: Record<SourceType, React.ReactNode> = {
  point_table: <Table size={14} />,
  photo: <Camera size={14} />,
  meeting_screenshot: <Image size={14} />,
  plan_note: <FileText size={14} />,
  manual_coordinate: <PenTool size={14} />,
};

const severityLabel: Record<string, { text: string; color: string }> = {
  critical: { text: '严重', color: 'text-red-400' },
  warning: { text: '警告', color: 'text-yellow-400' },
  normal: { text: '正常', color: 'text-green-400' },
};

export default function DetailPanel() {
  const { selectedRecord, selectRecord, sourcesByRecord, fetchSources, conflicts, resolveConflict, setCorrectionPanelOpen, snapshotsByRecord, fetchSnapshots } = useStore();
  const [snapshotHistoryOpen, setSnapshotHistoryOpen] = useState<boolean>(false);

  useEffect(() => {
    if (selectedRecord) {
      fetchSources(selectedRecord.id);
      fetchSnapshots(selectedRecord.id);
    }
  }, [selectedRecord, fetchSources, fetchSnapshots]);

  if (!selectedRecord) return null;

  const sources = sourcesByRecord[selectedRecord.id] || [];
  const recordConflicts = conflicts.filter((c) => c.recordId === selectedRecord.id);
  const snapshots = snapshotsByRecord[selectedRecord.id] || [];
  const latestSnapshot = snapshots.length > 0
    ? [...snapshots].sort((a, b) => new Date(b.correctedAt).getTime() - new Date(a.correctedAt).getTime())[0]
    : null;

  const fieldLabels: Record<string, string> = {
    temperature: '温度',
    name: '名称',
    coordinateX: 'X坐标',
    coordinateY: 'Y坐标',
  };

  return (
    <div className="flex h-[260px] items-start gap-4 border-t border-gray-700 bg-[#1a1a2e] p-4">
      <button
        onClick={() => selectRecord(null)}
        className="absolute right-3 top-3 text-gray-500 hover:text-gray-300"
      >
        <X size={16} />
      </button>

      <div className="flex w-52 shrink-0 flex-col gap-1 text-xs">
        <div className="text-sm font-semibold text-gray-200">{selectedRecord.name}</div>
        <div className="text-gray-400">
          坐标: ({selectedRecord.coordinateX}, {selectedRecord.coordinateY})
        </div>
        <div className="text-gray-400">
          温度: <span className="text-amber-400 font-medium">{selectedRecord.temperature.toFixed(1)}°C</span>
        </div>
        <div className="text-gray-400">
          坐标系: <span className="text-gray-200">{selectedRecord.coordinateSystem}</span>
        </div>
        <div className="text-gray-400">
          严重程度:{' '}
          <span className={cn(severityLabel[selectedRecord.severity]?.color, 'font-medium')}>
            {severityLabel[selectedRecord.severity]?.text}
          </span>
        </div>
        <div className="text-gray-400">
          状态: <span className="text-gray-200">{selectedRecord.status}</span>
        </div>
        <button
          onClick={() => setCorrectionPanelOpen(true)}
          className="mt-2 flex items-center gap-1 rounded bg-amber-500 px-2 py-1 text-[10px] font-medium text-gray-900 hover:bg-amber-400 transition-colors"
        >
          <Edit3 size={12} />
          补录
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
        <div className="text-xs font-medium text-gray-300 mb-1">来源列表</div>
        {sources.length === 0 && (
          <div className="text-[10px] text-gray-500">暂无来源</div>
        )}
        {sources.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-xs text-gray-400">
            <span className="text-amber-400">{sourceIcons[s.sourceType]}</span>
            <span className="text-gray-200 truncate">{s.sourceName}</span>
            <span className="text-gray-500 truncate">{s.sourceRef}</span>
            <span className="text-gray-600 shrink-0">
              {new Date(s.importedAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        ))}
      </div>

      <div className="w-56 shrink-0 flex flex-col gap-2 overflow-y-auto">
        {latestSnapshot && (
          <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2">
            <div className="text-[10px] font-medium text-amber-400 mb-1">最新补录</div>
            <div className="text-[10px] text-gray-300">
              {fieldLabels[latestSnapshot.fieldName] || latestSnapshot.fieldName}:{' '}
              <span className="text-gray-500 line-through">{latestSnapshot.oldValue}</span>{' '}
              → <span className="text-amber-400 font-medium">{latestSnapshot.newValue}</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1 truncate" title={latestSnapshot.reason}>
              原因: {latestSnapshot.reason}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {latestSnapshot.correctedBy} · {new Date(latestSnapshot.correctedAt).toLocaleString('zh-CN')}
            </div>
          </div>
        )}

        {snapshots.length > 0 && (
          <div>
            <button
              onClick={() => setSnapshotHistoryOpen(!snapshotHistoryOpen)}
              className="flex w-full items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200"
            >
              {snapshotHistoryOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <History size={12} className="mr-0.5" />
              历史补录 ({snapshots.length})
            </button>
            {snapshotHistoryOpen && (
              <div className="mt-1.5 flex flex-col gap-1.5 max-h-28 overflow-y-auto">
                {snapshots.sort((a, b) => new Date(b.correctedAt).getTime() - new Date(a.correctedAt).getTime()).map((snapshot) => (
                  <div key={snapshot.id} className="relative pl-3 border-l-2 border-gray-700 pb-1.5">
                    <div className="absolute -left-1 top-0 h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <div className="text-[10px] text-gray-300">
                      {fieldLabels[snapshot.fieldName] || snapshot.fieldName}
                    </div>
                    <div className="text-[9px] text-gray-400">
                      {snapshot.oldValue} → <span className="text-amber-400">{snapshot.newValue}</span>
                    </div>
                    <div className="text-[9px] text-gray-500 mt-0.5 truncate">{snapshot.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {recordConflicts.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-medium text-gray-300">冲突信息</div>
            {recordConflicts.map((c) => (
              <div key={c.id} className="rounded bg-gray-800/60 p-2 text-xs">
                <div className="text-red-400 mb-1">{c.conflictType}</div>
                <div className="text-gray-400 mb-2">{c.suggestion}</div>
                {!c.resolvedAt && (
                  <button
                    onClick={() => resolveConflict(c.id, 'accepted', '许姐')}
                    className="rounded bg-blue-600 px-2 py-1 text-[10px] text-white hover:bg-blue-500"
                  >
                    解决
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
