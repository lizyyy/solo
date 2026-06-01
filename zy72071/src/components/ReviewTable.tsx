import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ImageOff, Plus, Save } from 'lucide-react';
import type { Project, Point } from '../types';
import { useProjectStore } from '../store/projectStore';

const anomalyColors: Record<string, string> = {
  coordinate_offset: 'bg-yellow-500',
  duplicate_name: 'bg-purple-500',
  missing_photo: 'bg-red-500',
  cross_floor: 'bg-orange-500',
};

const anomalyShortLabels: Record<string, string> = {
  coordinate_offset: '偏',
  duplicate_name: '重',
  missing_photo: '缺',
  cross_floor: '跨',
};

interface ReviewTableProps {
  project: Project;
}

export function ReviewTable({ project }: ReviewTableProps) {
  const { selectPoint, selectedPointId, addReviewNote, addJudgmentTrace } = useProjectStore();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [editingPointId, setEditingPointId] = useState<string | null>(null);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAddNote = (pointId: string) => {
    if (!newNote.trim()) return;

    addReviewNote({
      projectId: project.id,
      pointId,
      content: newNote,
      operator: '当前用户',
      isSupplementary: true,
      originalContent: '补录备注',
    });

    addJudgmentTrace({
      pointId,
      action: 'supplement_note',
      operator: '当前用户',
      remark: newNote,
      diff: `新增备注: ${newNote.substring(0, 20)}${newNote.length > 20 ? '...' : ''}`,
    });

    setNewNote('');
    setEditingPointId(null);
  };

  const getCoordColor = (coordId: string) => {
    const coord = project.coordinateSystems.find((c) => c.id === coordId);
    return coord?.color || '#6b7280';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-bold text-gray-800">方案评审表</h3>
        <p className="text-xs text-gray-500 mt-1">
          原始备注完整保留，不做清洗处理
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8"></th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">点位名称</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">设备编号</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-16">坐标系</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-12">楼层</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-12">照片</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-20">异常</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">原始备注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {project.points.map((point, index) => (
              <tr
                key={point.id}
                className={`
                  ${point.anomalies.length > 0 ? 'bg-red-50/30' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  ${selectedPointId === point.id ? 'ring-2 ring-inset ring-primary-500' : ''}
                  hover:bg-primary-50/50 cursor-pointer transition-colors
                `}
                onClick={() => selectPoint(point.id)}
              >
                <td className="px-3 py-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedRow(expandedRow === point.id ? null : point.id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    {expandedRow === point.id ? (
                      <ChevronDown size={14} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-500" />
                    )}
                  </button>
                </td>
                <td className="px-3 py-2 font-medium text-gray-800">{point.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{point.deviceId}</td>
                <td className="px-3 py-2 text-center">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: getCoordColor(point.coordinateSystemId) }}
                    title={project.coordinateSystems.find((c) => c.id === point.coordinateSystemId)?.name}
                  />
                </td>
                <td className="px-3 py-2 text-center text-gray-600">{point.floor}F</td>
                <td className="px-3 py-2 text-center">
                  {point.hasPhoto ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <ImageOff size={14} className="mx-auto text-red-500" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 justify-center">
                    {point.anomalies.length > 0 ? (
                      point.anomalies.map((a) => (
                        <span
                          key={a.id}
                          className={`${anomalyColors[a.type]} text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold`}
                          title={a.description}
                        >
                          {anomalyShortLabels[a.type]}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate">
                  {point.originalData.remark ? String(point.originalData.remark) : (
                    <span className="text-gray-400 italic">无备注</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {expandedRow && (
          <div className="bg-gray-50 border-t border-gray-200 p-4">
            {(() => {
              const point = project.points.find((p) => p.id === expandedRow);
              if (!point) return null;

              const pointNotes = project.reviewNotes.filter(
                (n) => n.pointId === point.id
              );

              return (
                <div className="space-y-4">
                  {point.anomalies.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                        <AlertTriangle size={12} className="text-yellow-500" /> 异常详情
                      </div>
                      <div className="space-y-2">
                        {point.anomalies.map((anomaly) => (
                          <div
                            key={anomaly.id}
                            className="bg-white border border-gray-200 rounded p-3 text-sm"
                          >
                            <span
                              className={`${anomalyColors[anomaly.type]} text-white text-xs px-2 py-0.5 rounded mr-2`}
                            >
                              {anomalyShortLabels[anomaly.type]}
                            </span>
                            <span className="text-gray-700">{anomaly.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pointNotes.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-2">评审备注历史</div>
                      <div className="space-y-2">
                        {pointNotes.map((note) => (
                          <div
                            key={note.id}
                            className={`bg-white border rounded p-3 ${
                              note.isSupplementary ? 'border-yellow-300 bg-yellow-50/50' : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700">
                                {note.operator}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatTime(note.createdAt)}
                                {note.isSupplementary && (
                                  <span className="ml-2 text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                                    补录
                                  </span>
                                )}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{note.content}</p>
                            {note.originalContent && (
                              <p className="text-xs text-gray-400 mt-1 italic">
                                原始: {note.originalContent}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingPointId === point.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="输入补录备注..."
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        rows={2}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNote(point.id);
                          }}
                          className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 flex items-center gap-1"
                        >
                          <Save size={14} /> 保存备注
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPointId(null);
                            setNewNote('');
                          }}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPointId(point.id);
                      }}
                      className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                    >
                      <Plus size={14} /> 补录备注
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
