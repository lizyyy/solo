import { useRef, useEffect, useCallback } from 'react';
import type { TestRecord, UnitEntry, TerrainRule, Anomaly, TimelineData } from '@/types';
import { useAppStore } from '@/store';
import { SourceBadge } from './SourceBadge';
import { AnomalyBadge } from './AnomalyBadge';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { FileText, Users, MapPin } from 'lucide-react';

interface TimelineTrackProps {
  data: TimelineData;
  onSyncScroll: (scrollLeft: number) => void;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  trackType: 'records' | 'units' | 'terrain';
}

const TRACK_LABELS = {
  records: { label: '测试记录', icon: FileText, color: 'border-blue-500/30' },
  units: { label: '单位表', icon: Users, color: 'border-green-500/30' },
  terrain: { label: '地形规则', icon: MapPin, color: 'border-amber-500/30' },
};

const CARD_WIDTH = 320;
const CARD_GAP = 16;
const ROUND_HEADER_WIDTH = 60;

export const TimelineTrack = ({ data, onSyncScroll, scrollRef, trackType }: TimelineTrackProps) => {
  const { highlight, selectedRecordId, selectRecord, setHighlight } = useAppStore();
  const localScrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollLeft !== scrollRef.current?.scrollLeft) {
      onSyncScroll(target.scrollLeft);
    }
  }, [onSyncScroll, scrollRef]);

  useEffect(() => {
    if (scrollRef.current && localScrollRef.current) {
      localScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }, [scrollRef]);

  const handleCardHover = (round: number, recordId?: string) => {
    setHighlight({ round, recordId: recordId || null });
  };

  const handleCardLeave = () => {
    setHighlight({ round: null, recordId: null });
  };

  const config = TRACK_LABELS[trackType];
  const Icon = config.icon;

  const getItemsForRound = (round: number) => {
    if (trackType === 'records') {
      return data.testRecords.filter(r => r.round === round);
    }
    if (trackType === 'units') {
      return data.unitEntries.filter(u => u.effectiveRound === round);
    }
    return data.terrainRules.filter(t => t.effectiveRound === round);
  };

  const rounds = Array.from(new Set([
    ...data.testRecords.map(r => r.round),
    ...data.unitEntries.map(u => u.effectiveRound),
    ...data.terrainRules.map(t => t.effectiveRound),
  ])).sort((a, b) => a - b);

  if (rounds.length === 0) {
    return (
      <div className={`card border-l-4 ${config.color}`}>
        <div className="card-header flex items-center gap-2">
          <Icon size={16} />
          {config.label}
        </div>
        <div className="card-body text-sm text-text-muted">
          暂无数据，请先导入材料包
        </div>
      </div>
    );
  }

  return (
    <div className={`card border-l-4 ${config.color}`}>
      <div className="card-header flex items-center gap-2 sticky top-0 bg-bg-secondary z-10">
        <Icon size={16} />
        {config.label}
        <span className="ml-auto text-xs text-text-muted">
          共 {rounds.length} 个回合
        </span>
      </div>
      <div
        ref={(el) => {
          (localScrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (scrollRef) {
            (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }
        }}
        className="scroll-sync-container p-4"
        onScroll={handleScroll}
      >
        <div
          className="flex gap-4"
          style={{
            width: `${rounds.length * (ROUND_HEADER_WIDTH + CARD_WIDTH + CARD_GAP) + 64}px`,
          }}
        >
          {rounds.map((round) => {
            const items = getItemsForRound(round);
            const isHighlighted = highlight.round === round;
            const roundAnomalies = data.anomalies.filter(
              a => data.testRecords.find(r => r.id === a.recordId)?.round === round
            );

            return (
              <div
                key={round}
                className={`flex gap-4 transition-all duration-200 ${
                  isHighlighted ? 'opacity-100' : 'opacity-90'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-[${ROUND_HEADER_WIDTH}px] flex flex-col items-center justify-start pt-2 ${
                    isHighlighted ? 'bg-accent-military/10' : ''
                  }`}
                  style={{ width: ROUND_HEADER_WIDTH }}
                >
                  <div className={`text-xl font-mono font-bold ${
                    roundAnomalies.length > 0 ? 'text-accent-warning-light' : 'text-text-primary'
                  }`}>
                    {round}
                  </div>
                  <div className="text-xs text-text-muted">回合</div>
                  {roundAnomalies.length > 0 && (
                    <div className="mt-1 w-2 h-2 rounded-full bg-accent-warning animate-pulse" />
                  )}
                </div>

                <div
                  className="flex flex-col gap-3 flex-shrink-0"
                  style={{ width: CARD_WIDTH }}
                >
                  {items.length === 0 ? (
                    <div className="bg-bg-tertiary/30 border border-dashed border-border-default p-4 text-center text-xs text-text-muted">
                      无{config.label}
                    </div>
                  ) : (
                    items.map((item) => {
                      const itemId = 'id' in item ? (item as any).id : '';
                      const isSelected = selectedRecordId === itemId;
                      const hasAnomaly = trackType === 'records' &&
                        (item as TestRecord).anomalies?.length > 0;

                      return (
                        <div
                          key={itemId}
                          className={`bg-bg-tertiary border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'border-accent-military ring-1 ring-accent-military/50'
                              : hasAnomaly
                              ? 'border-accent-warning hover:border-accent-warning-light'
                              : 'border-border-default hover:border-text-muted'
                          } ${
                            highlight.recordId === itemId ? 'ring-2 ring-accent-military/30' : ''
                          }`}
                          onClick={() => trackType === 'records' && selectRecord(itemId)}
                          onMouseEnter={() => handleCardHover(round, itemId)}
                          onMouseLeave={handleCardLeave}
                        >
                          {trackType === 'records' && (
                            <RecordCard item={item as TestRecord} anomalies={data.anomalies} />
                          )}
                          {trackType === 'units' && (
                            <UnitCard item={item as UnitEntry} />
                          )}
                          {trackType === 'terrain' && (
                            <TerrainCard item={item as TerrainRule} />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const RecordCard = ({ item, anomalies }: { item: TestRecord; anomalies: Anomaly[] }) => {
  const recordAnomalies = anomalies.filter(a => item.anomalies.includes(a.id));

  return (
    <div className="p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <SourceBadge type={item.sourceType} />
        <span className="text-xs text-text-muted font-mono">
          {format(item.timestamp, 'HH:mm', { locale: zhCN })}
        </span>
      </div>
      <div className="text-sm text-text-primary mb-2 leading-relaxed">
        {item.content}
      </div>
      {item.status === 'duplicate' && item.duplicateOfId && (
        <div className="text-xs text-text-muted mb-2">
          重复项 · 来源: {item.originalFile}
        </div>
      )}
      {recordAnomalies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {recordAnomalies.map(a => (
            <AnomalyBadge key={a.id} type={a.type} status={a.status} severity={a.severity} />
          ))}
        </div>
      )}
      {item.sourceType !== 'duplicate' && (
        <div className="text-xs text-text-muted mt-2 font-mono">
          {item.originalFile}
        </div>
      )}
    </div>
  );
};

const UnitCard = ({ item }: { item: UnitEntry }) => {
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-mono font-semibold text-accent-military-light">
          {item.unitCode}
        </span>
        {item.isManualCorrection && (
          <span className="badge badge-manual text-[10px]">人工修正</span>
        )}
      </div>
      <div className="text-sm text-text-primary font-medium mb-2">{item.unitName}</div>
      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
        {Object.entries(item.stats).slice(0, 6).map(([key, value]) => (
          <div key={key} className="bg-bg-secondary/50 p-1.5">
            <div className="text-text-muted text-[10px] uppercase">{key}</div>
            <div className="text-text-primary font-mono">{value}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-text-muted font-mono">
        来源: {item.source}
      </div>
    </div>
  );
};

const TerrainCard = ({ item }: { item: TerrainRule }) => {
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-mono font-semibold text-amber-400">
          {item.gridPosition}
        </span>
        <span className={`badge ${
          item.passable ? 'badge-normal' : 'badge-pending'
        } text-[10px]`}>
          {item.passable ? '可通行' : '不可通行'}
        </span>
      </div>
      <div className="text-xs text-text-secondary mb-1">
        类型: {item.ruleType === 'movement' ? '移动' : item.ruleType === 'combat' ? '战斗' : '补给'}
      </div>
      <div className="text-sm text-text-primary mb-2">{item.description}</div>
      {item.movementCost !== undefined && (
        <div className="text-xs text-text-muted mb-1">
          移动消耗: {item.movementCost}
        </div>
      )}
      <div className="text-xs text-text-muted font-mono">
        来源: {item.source}
      </div>
    </div>
  );
};
