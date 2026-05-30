import React, { useRef, useState } from 'react';
import type { Material, CuePoint, Issue, TimelineAlignment } from '@/types';
import { MATERIAL_TYPE_LABELS, MATERIAL_TYPE_COLORS, type MaterialType } from '@/types';
import { formatTimecode } from '@/utils/timecode';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, StickyNote } from 'lucide-react';

interface TimelineViewProps {
  materials: Material[];
  alignments: TimelineAlignment[];
  issues: Issue[];
  onTimecodeClick?: (timecode: number) => void;
  highlightedTimecode?: number | null;
}

const TRACK_HEIGHT = 60;
const PIXELS_PER_SECOND = 8;
const TRACK_TYPES: MaterialType[] = ['timeline', 'dialog', 'music', 'cue'];

export const TimelineView: React.FC<TimelineViewProps> = ({
  materials,
  alignments,
  issues,
  onTimecodeClick,
  highlightedTimecode,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredCue, setHoveredCue] = useState<{ type: MaterialType; cue: CuePoint } | null>(null);

  const allCuePoints: Array<{ type: MaterialType; cue: CuePoint }> = [];
  for (const mat of materials) {
    if (mat.parsedData?.cuePoints && TRACK_TYPES.includes(mat.type)) {
      mat.parsedData.cuePoints.forEach(cue => {
        allCuePoints.push({ type: mat.type as MaterialType, cue });
      });
    }
  }

  const noteMaterial = materials.find(m => m.type === 'note');
  const notes: Array<{ timecode: string; content: string }> = [];
  if (noteMaterial?.parsedData?.rawData?.notes) {
    const rawNotes = noteMaterial.parsedData.rawData.notes as Array<{ timecode?: string; content: string }>;
    rawNotes.forEach(n => {
      if (n.timecode) {
        notes.push({ timecode: n.timecode, content: n.content });
      }
    });
  }

  const maxTime = Math.max(
    ...allCuePoints.map(cp => cp.cue.endTime.totalSeconds),
    ...alignments.map(a => a.timecode),
    60
  );

  const totalWidth = Math.max(maxTime * PIXELS_PER_SECOND + 200, 1200);
  const totalHeight = TRACK_HEIGHT * (TRACK_TYPES.length + 1) + 80;

  const timeMarkers: number[] = [];
  const interval = maxTime > 600 ? 60 : maxTime > 300 ? 30 : maxTime > 120 ? 15 : 10;
  for (let t = 0; t <= maxTime; t += interval) {
    timeMarkers.push(t);
  }

  const getIssueAtTime = (timecode: number): Issue | undefined => {
    return issues.find(i =>
      i.timecode !== undefined &&
      Math.abs(i.timecode - timecode) < 1
    );
  };

  const parseNoteTimecode = (tc: string): number => {
    const parts = tc.split(':').map(Number);
    if (parts.length >= 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  return (
    <div className="bg-bg-secondary rounded-lg overflow-hidden">
      <div className="p-4 border-b border-bg-tertiary flex items-center justify-between">
        <h3 className="font-semibold">时间轴对齐视图</h3>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          {TRACK_TYPES.map(type => (
            <div key={type} className="flex items-center gap-2">
              <div className={cn('w-3 h-3 rounded', MATERIAL_TYPE_COLORS[type])} />
              <span>{MATERIAL_TYPE_LABELS[type]}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-auto scrollbar-thin"
        style={{ maxHeight: '500px' }}
      >
        <div style={{ width: totalWidth, height: totalHeight }} className="relative">
          <div className="sticky top-0 left-0 bg-bg-secondary z-10 h-8 border-b border-bg-tertiary flex">
            <div className="w-24 flex-shrink-0 border-r border-bg-tertiary" />
            <div className="flex-1 relative">
              {timeMarkers.map(t => (
                <div
                  key={t}
                  className="absolute top-0 text-xs text-text-muted transform -translate-x-1/2"
                  style={{ left: t * PIXELS_PER_SECOND + 80 }}
                >
                  {formatTimecode({
                    hours: Math.floor(t / 3600),
                    minutes: Math.floor((t % 3600) / 60),
                    seconds: Math.floor(t % 60),
                    totalSeconds: t,
                    originalFormat: 'seconds',
                  })}
                </div>
              ))}
            </div>
          </div>

          {TRACK_TYPES.map((type, trackIndex) => {
            const typeCues = allCuePoints.filter(cp => cp.type === type);
            const y = 40 + trackIndex * TRACK_HEIGHT;

            return (
              <div key={type} className="flex" style={{ height: TRACK_HEIGHT }}>
                <div
                  className="w-24 flex-shrink-0 border-r border-bg-tertiary flex items-center px-3 text-sm font-medium"
                  style={{ height: TRACK_HEIGHT }}
                >
                  {MATERIAL_TYPE_LABELS[type]}
                </div>
                <div className="flex-1 relative" style={{ height: TRACK_HEIGHT }}>
                  <div
                    className="absolute inset-0 border-b border-bg-tertiary/50"
                    style={{ top: 0 }}
                  />

                  {timeMarkers.map(t => (
                    <div
                      key={t}
                      className="absolute top-0 bottom-0 border-l border-bg-tertiary/30"
                      style={{ left: t * PIXELS_PER_SECOND + 80 }}
                    />
                  ))}

                  {typeCues.map(({ cue }) => {
                    const left = cue.startTime.totalSeconds * PIXELS_PER_SECOND + 80;
                    const width = Math.max(
                      (cue.endTime.totalSeconds - cue.startTime.totalSeconds) * PIXELS_PER_SECOND,
                      40
                    );
                    const hasIssue = getIssueAtTime(cue.startTime.totalSeconds);
                    const isHighlighted = highlightedTimecode !== null &&
                      Math.abs(cue.startTime.totalSeconds - highlightedTimecode) < 1;

                    return (
                      <div
                        key={cue.id}
                        className={cn(
                          'absolute top-2 bottom-2 rounded cursor-pointer transition-all',
                          MATERIAL_TYPE_COLORS[type],
                          'opacity-90 hover:opacity-100',
                          isHighlighted && 'ring-2 ring-white ring-offset-2 ring-offset-bg-secondary'
                        )}
                        style={{ left, width }}
                        onMouseEnter={() => setHoveredCue({ type, cue })}
                        onMouseLeave={() => setHoveredCue(null)}
                        onClick={() => onTimecodeClick?.(cue.startTime.totalSeconds)}
                      >
                        <div className="h-full flex items-center px-2 overflow-hidden">
                          <span className="text-xs text-white truncate font-medium">
                            {cue.number} {cue.name}
                          </span>
                          {hasIssue && (
                            <AlertTriangle
                              className={cn(
                                'ml-1 flex-shrink-0',
                                hasIssue.severity === 'error' ? 'text-accent-error' : 'text-accent-warning'
                              )}
                              size={14}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="flex" style={{ height: TRACK_HEIGHT }}>
            <div
              className="w-24 flex-shrink-0 border-r border-bg-tertiary flex items-center px-3 text-sm font-medium"
              style={{ height: TRACK_HEIGHT }}
            >
              导演备注
            </div>
            <div className="flex-1 relative" style={{ height: TRACK_HEIGHT }}>
              {notes.map((note, idx) => {
                const tc = parseNoteTimecode(note.timecode);
                const left = tc * PIXELS_PER_SECOND + 80;

                return (
                  <div
                    key={idx}
                    className="absolute top-2 bg-track-note/80 text-white text-xs rounded px-2 py-1 cursor-help max-w-[150px] truncate"
                    style={{ left }}
                    title={note.content}
                  >
                    <div className="flex items-center gap-1">
                      <StickyNote size={10} />
                      <span className="truncate">{note.content}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {alignments.map(alignment => {
            if (alignment.isAligned) return null;
            const x = alignment.timecode * PIXELS_PER_SECOND + 80;

            return (
              <div
                key={alignment.id}
                className="absolute top-0 bottom-0 border-l-2 border-accent-error/50 pointer-events-none z-10"
                style={{ left: x }}
              >
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 -translate-y-full bg-accent-error text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                  {alignment.issues[0]}
                </div>
              </div>
            );
          })}

          {hoveredCue && (
            <div className="fixed z-50 bg-bg-tertiary border border-bg-secondary rounded-lg p-3 shadow-xl pointer-events-none animate-slide-in">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-3 h-3 rounded', MATERIAL_TYPE_COLORS[hoveredCue.type])} />
                <span className="text-xs text-text-muted">
                  {MATERIAL_TYPE_LABELS[hoveredCue.type]}
                </span>
              </div>
              <p className="font-medium">{hoveredCue.cue.name}</p>
              <div className="text-sm text-text-muted mt-1 space-y-0.5">
                <p><span className="timecode">{formatTimecode(hoveredCue.cue.startTime)}</span> → <span className="timecode">{formatTimecode(hoveredCue.cue.endTime)}</span></p>
                <p>时长：<span className="timecode">{formatTimecode(hoveredCue.cue.duration)}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-bg-tertiary flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-text-muted">
          <CheckCircle2 className="text-accent-success" size={16} />
          <span>对齐：{alignments.filter(a => a.isAligned).length} / {alignments.length}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-text-muted">
            总时长：<span className="timecode text-text-primary">{formatTimecode({
              hours: Math.floor(maxTime / 3600),
              minutes: Math.floor((maxTime % 3600) / 60),
              seconds: Math.floor(maxTime % 60),
              totalSeconds: maxTime,
              originalFormat: 'seconds',
            })}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
