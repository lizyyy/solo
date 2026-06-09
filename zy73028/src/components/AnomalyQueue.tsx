import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListTodo, ChevronDown, ChevronUp, CheckCircle, CircleAlert } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import {
  AnomalyType,
  ANOMALY_LABEL,
  ANOMALY_CHIP_CLASS,
  TempControlRecord,
} from '@/types';

const QUEUE_TYPES: AnomalyType[] = [
  'weight_unit_mixed',
  'duplicate_pet',
  'temp_out_of_range',
  'missing_data',
  'wechat_note_flag',
];

const MIN_WIDTH = 280;
const MAX_WIDTH = 480;

type GroupedRecords = Record<AnomalyType, TempControlRecord[]>;

export default function AnomalyQueue() {
  const anomalyQueue = useAppStore((s) => s.anomalyQueue);
  const records = useAppStore((s) => s.records);
  const queueWidth = useAppStore((s) => s.ui.queueWidth);
  const setQueueWidth = useAppStore((s) => s.setQueueWidth);
  const setOpenDetail = useAppStore((s) => s.setOpenDetail);
  const setDrillDown = useAppStore((s) => s.setDrillDown);
  const openDetailId = useAppStore((s) => s.ui.openDetailId);

  const [expandedGroups, setExpandedGroups] = useState<Record<AnomalyType, boolean>>({
    weight_unit_mixed: true,
    duplicate_pet: true,
    temp_out_of_range: true,
    missing_data: true,
    wechat_note_flag: true,
  });

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = queueWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [queueWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta));
      setQueueWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setQueueWidth]);

  const recordMap = new Map(records.map((r) => [r.id, r]));

  const grouped: GroupedRecords = QUEUE_TYPES.reduce((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as GroupedRecords);

  for (const item of anomalyQueue) {
    const record = recordMap.get(item.recordId);
    if (!record) continue;
    for (const type of item.anomalyTypes) {
      if (QUEUE_TYPES.includes(type)) {
        if (!grouped[type].find((r) => r.id === record.id)) {
          grouped[type].push(record);
        }
      }
    }
  }

  const unresolvedGrouped: GroupedRecords = QUEUE_TYPES.reduce((acc, type) => {
    acc[type] = grouped[type].filter((r) => r.status !== 'confirmed');
    return acc;
  }, {} as GroupedRecords);

  const toggleGroup = (type: AnomalyType) => {
    setExpandedGroups((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleItemClick = (recordId: string, type: AnomalyType) => {
    setOpenDetail(recordId);
    setDrillDown({
      type,
      recordIds: grouped[type].map((r) => r.id),
      openedRecordId: recordId,
      highlightAt: Date.now(),
    });
  };

  return (
    <aside
      className="relative h-full bg-white border-l border-ink-200 flex flex-col flex-shrink-0"
      style={{ width: queueWidth }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[2px] cursor-col-resize hover:bg-clinic-400 transition-colors z-10 group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-[8px] h-16 rounded-full bg-ink-200 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-200 bg-ink-50/50">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-clinic-600" />
          <h2 className="text-sm font-semibold text-ink-800">异常队列</h2>
          <span className="chip chip-anom-wechat">
            {anomalyQueue.filter((q) => !q.resolved).length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {QUEUE_TYPES.map((type) => {
          const groupRecords = unresolvedGrouped[type];
          const totalCount = grouped[type].length;
          const unresolvedCount = groupRecords.length;
          const expanded = expandedGroups[type];

          return (
            <div
              key={type}
              className={cn(
                'rounded-lg ring-1 overflow-hidden transition-all',
                expanded ? 'ring-ink-200' : 'ring-ink-100'
              )}
            >
              <button
                onClick={() => toggleGroup(type)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-ink-50/60 hover:bg-ink-100/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={cn('chip', ANOMALY_CHIP_CLASS[type])}>
                    {unresolvedCount}
                  </span>
                  <span className="text-xs font-medium text-ink-700">
                    {ANOMALY_LABEL[type]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-ink-400">
                    共{totalCount}条
                  </span>
                  {expanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-ink-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-ink-500" />
                  )}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="p-2 space-y-1.5 bg-white">
                      {groupRecords.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-ink-400 flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          本组全部处理完成
                        </div>
                      ) : (
                        groupRecords.map((record, idx) => {
                          const isHighlighted = openDetailId === record.id;
                          return (
                            <motion.button
                              key={record.id}
                              initial={{ x: 10, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: idx * 0.03, duration: 0.2 }}
                              onClick={() => handleItemClick(record.id, type)}
                              className={cn(
                                'w-full text-left p-2.5 rounded-md transition-all group',
                                'ring-1 hover:shadow-sm',
                                isHighlighted
                                  ? 'bg-clinic-50 ring-clinic-300 shadow-sm'
                                  : 'bg-white ring-ink-100 hover:bg-ink-50 hover:ring-ink-200'
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={cn(
                                        'text-sm font-medium truncate',
                                        isHighlighted
                                          ? 'text-clinic-700'
                                          : 'text-ink-700'
                                      )}
                                    >
                                      {record.petName}
                                    </span>
                                    <span
                                      className={cn(
                                        'chip !text-[10px] !py-0 !px-1.5',
                                        ANOMALY_CHIP_CLASS[type]
                                      )}
                                    >
                                      {ANOMALY_LABEL[type].slice(0, 4)}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <span className="text-[10px] text-ink-400 truncate">
                                      {record.ownerName} · {record.species}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  {record.status === 'confirmed' ? (
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <CircleAlert className="w-4 h-4 text-amber-500" />
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-ink-200 bg-ink-50/50">
        <div className="flex items-center justify-between text-[10px] text-ink-400">
          <span>
            待处理 {anomalyQueue.filter((q) => !q.resolved).length} / 总异常{' '}
            {anomalyQueue.length}
          </span>
          <span>宽度 {queueWidth}px</span>
        </div>
      </div>
    </aside>
  );
}
