import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { InspectionMark } from '@/types';
import Badge from '@/components/ui/Badge';
import OriginalNoteDisplay from '@/components/ui/OriginalNoteDisplay';
import { getMaterialTypeLabel } from '@/utils/fileParser';

interface MarkTableProps {
  marks: InspectionMark[];
  selectedMarkId: string | null;
  onSelectMark: (markId: string | null) => void;
  showNotes?: boolean;
}

export default function MarkTable({ marks, selectedMarkId, onSelectMark, showNotes = true }: MarkTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const sortedMarks = [...marks].sort((a, b) => a.sequenceNo - b.sequenceNo);

  const getDiameterStatus = (diameter: string) => {
    if (!diameter) return 'default';
    if (diameter.includes('?') || diameter.includes('疑似') || diameter.includes('错')) return 'warning';
    return 'default';
  };

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="table-header w-16">序号</th>
            <th className="table-header">X坐标</th>
            <th className="table-header">Y坐标</th>
            <th className="table-header">Z坐标</th>
            <th className="table-header">管线类型</th>
            <th className="table-header">管径</th>
            <th className="table-header">障碍物</th>
            <th className="table-header">材料类型</th>
            <th className="table-header w-16">备注</th>
            <th className="table-header w-16">详情</th>
          </tr>
        </thead>
        <tbody>
          {sortedMarks.length === 0 ? (
            <tr>
              <td colSpan={10} className="table-cell text-center text-primary-400 py-8">
                暂无巡检标记数据
              </td>
            </tr>
          ) : (
            sortedMarks.map((mark) => {
              const isSelected = mark.id === selectedMarkId;
              const isExpanded = mark.id === expandedRow;
              const hasNotes = mark.originalNotes.length > 0;
              const hasAmbiguousNote = mark.originalNotes.some(n => n.isAmbiguous);

              return (
                <>
                  <tr
                    key={mark.id}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary-600/30' : 'hover:bg-primary-800/30'
                    }`}
                    onClick={() => onSelectMark(isSelected ? null : mark.id)}
                  >
                    <td className="table-cell font-mono font-semibold text-primary-200">
                      {mark.sequenceNo}
                    </td>
                    <td className="table-cell font-mono text-primary-300">
                      {mark.x.toFixed(2)}
                    </td>
                    <td className="table-cell font-mono text-primary-300">
                      {mark.y.toFixed(2)}
                    </td>
                    <td className="table-cell font-mono">
                      <span className={mark.z > 0 ? 'text-accent-warning' : 'text-primary-300'}>
                        {mark.z.toFixed(2)}
                      </span>
                      {mark.z > 0 && <AlertTriangle size={12} className="inline ml-1 text-accent-warning" />}
                    </td>
                    <td className="table-cell">{mark.pipelineType}</td>
                    <td className="table-cell">
                      <Badge variant={getDiameterStatus(mark.diameter)}>
                        {mark.diameter || '-'}
                      </Badge>
                    </td>
                    <td className="table-cell">
                      {mark.isObstacle ? (
                        <Badge variant="warning">{mark.obstacleType || '障碍物'}</Badge>
                      ) : (
                        <span className="text-primary-500">-</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <Badge
                        variant={mark.materialType === 'normal' ? 'default' : mark.materialType === 'wrong_diameter' ? 'warning' : 'info'}
                      >
                        {getMaterialTypeLabel(mark.materialType)}
                      </Badge>
                    </td>
                    <td className="table-cell text-center">
                      {hasNotes && (
                        <Badge variant={hasAmbiguousNote ? 'warning' : 'info'}>
                          {mark.originalNotes.length}
                        </Badge>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedRow(isExpanded ? null : mark.id);
                        }}
                        className="p-1 text-primary-400 hover:text-primary-200"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && showNotes && (
                    <tr>
                      <td colSpan={10} className="bg-primary-900/30 p-4">
                        <OriginalNoteDisplay notes={mark.originalNotes} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
