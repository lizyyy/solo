import { useMemo, useState } from 'react';
import { Grid3X3, AlertTriangle, User, Music } from 'lucide-react';
import { useAppStore, useSelectedBatch } from '../../store/useAppStore';
import { getDeviationColor, getDeviationOpacity } from '../../utils/calculations';
import { getCategoryLabel, getAnomalyTypeLabel } from '../../utils/classification';
import type { HeatmapCellData } from '../../types';

export function Heatmap() {
  const { deviations, students, voiceParts, filters, setSelectedDeviationId } = useAppStore();
  const selectedBatch = useSelectedBatch();
  const [hoveredCell, setHoveredCell] = useState<HeatmapCellData | null>(null);

  const heatmapData = useMemo(() => {
    if (!selectedBatch) return [];

    const filteredStudents = filters.voicePartId
      ? students.filter(s => s.voicePartId === filters.voicePartId)
      : students;

    const batchDeviations = deviations.filter(d => d.batchId === selectedBatch.id);

    const cells: HeatmapCellData[] = [];

    filteredStudents.forEach(student => {
      for (let measure = 1; measure <= selectedBatch.totalMeasures; measure++) {
        const deviation = batchDeviations.find(
          d => d.studentId === student.id && d.measure === measure
        );

        if (!deviation) continue;

        if (filters.showAnomaliesOnly && !deviation.isAnomaly) return;
        if (filters.category && deviation.category !== filters.category) return;

        cells.push({
          studentId: student.id,
          studentName: student.name,
          measure,
          deviationCents: deviation.deviationCents,
          isAnomaly: deviation.isAnomaly,
          anomalyType: deviation.anomalyType,
          category: deviation.category,
          reviewed: deviation.reviewed,
          deviationId: deviation.id,
        });
      }
    });

    return cells;
  }, [selectedBatch, deviations, students, filters]);

  const groupedByVoicePart = useMemo(() => {
    const groups: Record<string, HeatmapCellData[]> = {};
    
    voiceParts.forEach(vp => {
      const partStudentIds = students
        .filter(s => s.voicePartId === vp.id)
        .map(s => s.id);
      
      groups[vp.id] = heatmapData.filter(c => partStudentIds.includes(c.studentId));
    });

    return groups;
  }, [heatmapData, voiceParts, students]);

  const uniqueStudents = useMemo(() => {
    const ids = new Set(heatmapData.map(c => c.studentId));
    return students.filter(s => ids.has(s.id));
  }, [heatmapData, students]);

  const measures = useMemo(() => {
    if (!selectedBatch) return [];
    return Array.from({ length: selectedBatch.totalMeasures }, (_, i) => i + 1);
  }, [selectedBatch]);

  if (!selectedBatch) {
    return (
      <div className="card p-8 text-center">
        <Music className="w-12 h-12 text-primary-300 mx-auto mb-4" />
        <p className="text-primary-500">请选择一个排练批次查看音准热力图</p>
      </div>
    );
  }

  const getCellForStudentMeasure = (studentId: string, measure: number) => {
    return heatmapData.find(c => c.studentId === studentId && c.measure === measure);
  };

  return (
    <div className="card p-5 animate-slide-up animate-stagger-3" id="report-content">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-semibold text-primary flex items-center gap-2">
          <span className="w-1 h-5 bg-accent rounded-full" />
          音准偏差热力图
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-primary-500">
            <Grid3X3 className="w-4 h-4" />
            <span>行 = 学生，列 = 小节</span>
          </div>
          <div className="flex items-center gap-2">
            {[
              { color: '#27ae60', label: '正常' },
              { color: '#e67e22', label: '轻微' },
              { color: '#c0392b', label: '严重' },
              { color: '#95a5a6', label: '异常' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-primary-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-max">
          <div className="flex">
            <div className="w-24 flex-shrink-0" />
            <div className="flex">
              {measures.map(m => (
                <div
                  key={m}
                  className="w-8 h-8 flex items-center justify-center text-[10px] text-primary-400 font-mono border-b border-cream-200"
                >
                  {m}
                </div>
              ))}
            </div>
          </div>

          {voiceParts.map(vp => {
            const partStudents = uniqueStudents.filter(s => s.voicePartId === vp.id);
            if (partStudents.length === 0) return null;

            return (
              <div key={vp.id} className="mt-2">
                <div 
                  className="flex items-center gap-2 py-1 px-2 rounded-t"
                  style={{ backgroundColor: `${vp.color}10` }}
                >
                  <div 
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: vp.color }}
                  />
                  <span className="text-xs font-medium" style={{ color: vp.color }}>
                    {vp.displayName}
                  </span>
                </div>

                {partStudents.map(student => (
                  <div key={student.id} className="flex items-center">
                    <div className="w-24 h-7 flex-shrink-0 flex items-center gap-1.5 px-2 border-r border-cream-200">
                      <User className="w-3 h-3 text-primary-300" />
                      <span className="text-xs text-primary-600 truncate font-medium">
                        {student.name}
                      </span>
                    </div>
                    <div className="flex">
                      {measures.map(m => {
                        const cell = getCellForStudentMeasure(student.id, m);
                        
                        if (!cell) {
                          return (
                            <div
                              key={m}
                              className="w-8 h-7 border border-cream-100 bg-cream-50/50"
                            />
                          );
                        }

                        const bgColor = getDeviationColor(cell.deviationCents, cell.isAnomaly, cell.reviewed);
                        const opacity = getDeviationOpacity(cell.deviationCents, cell.isAnomaly);

                        return (
                          <div
                            key={m}
                            className="heatmap-cell w-8 h-7 rounded-sm relative"
                            style={{ 
                              backgroundColor: bgColor,
                              opacity: cell.isAnomaly ? 0.4 : opacity,
                            }}
                            onClick={() => setSelectedDeviationId(cell.deviationId)}
                            onMouseEnter={() => setHoveredCell(cell)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {cell.isAnomaly && (
                              <AlertTriangle className="w-3 h-3 text-white absolute top-0.5 right-0.5" />
                            )}
                            {!cell.reviewed && Math.abs(cell.deviationCents) > 30 && !cell.isAnomaly && (
                              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full border border-white" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {hoveredCell && (
        <div className="fixed z-50 pointer-events-none bg-white shadow-card border border-cream-200 rounded-lg p-3 text-xs"
          style={{
            left: '50%',
            bottom: '20px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="font-medium text-primary">{hoveredCell.studentName}</span>
            <span className="text-primary-400">|</span>
            <span className="text-primary-600">第 {hoveredCell.measure} 小节</span>
            <span className="text-primary-400">|</span>
            <span className={`font-mono font-medium ${
              Math.abs(hoveredCell.deviationCents) > 50 ? 'text-deviation-severe' :
              Math.abs(hoveredCell.deviationCents) > 30 ? 'text-deviation-mild' :
              'text-deviation-normal'
            }`}>
              {hoveredCell.deviationCents > 0 ? '+' : ''}{hoveredCell.deviationCents} 音分
            </span>
            {hoveredCell.isAnomaly && (
              <>
                <span className="text-primary-400">|</span>
                <span className="text-orange-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {getAnomalyTypeLabel(hoveredCell.anomalyType)}
                </span>
              </>
            )}
            {hoveredCell.category && hoveredCell.category !== 'normal' && (
              <>
                <span className="text-primary-400">|</span>
                <span className="text-primary-600">{getCategoryLabel(hoveredCell.category)}</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-cream-200 flex items-center justify-between text-xs text-primary-500">
        <div className="flex items-center gap-4">
          <span>共 {uniqueStudents.length} 名学生</span>
          <span>{selectedBatch.totalMeasures} 个小节</span>
          <span>{heatmapData.filter(c => c.isAnomaly).length} 个异常数据点（不计入统计）</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400" />
          <span>待复核标记</span>
        </div>
      </div>
    </div>
  );
}
