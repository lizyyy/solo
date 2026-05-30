import React, { useState } from 'react';
import { Clock, Edit2, Save, X, ChevronDown, ChevronUp, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBadge } from '@/components/reports/ErrorBadge';
import { NoteEditor } from '@/components/reports/NoteEditor';
import type { ExperimentRecord, PhysicsParams } from '@/types';
import { RESULT_LABELS } from '@/types';

interface RecordDetailProps {
  record: ExperimentRecord;
  onUpdateCorrectedParams: (id: string, params: PhysicsParams) => void;
  onAddNote: (id: string, content: string) => void;
}

export const RecordDetail: React.FC<RecordDetailProps> = ({
  record,
  onUpdateCorrectedParams,
  onAddNote,
}) => {
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [showNoteHistory, setShowNoteHistory] = useState(false);
  const [editedParams, setEditedParams] = useState<PhysicsParams>(record.corrected.physicsParams);

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleString('zh-CN');

  const handleSaveParams = () => {
    onUpdateCorrectedParams(record.id, editedParams);
    setIsEditingParams(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-200 font-mono">
            实验记录详情
          </h3>
          <p className="text-xs text-gray-500 font-mono">
            ID: {record.id}
          </p>
        </div>
        <span
          className={cn(
            'px-3 py-1 rounded-full text-xs font-mono font-bold',
            record.conclusion.result === 'escape' && 'bg-green-500/20 text-green-400 border border-green-500/40',
            record.conclusion.result === 'collide' && 'bg-red-500/20 text-red-400 border border-red-500/40',
            record.conclusion.result === 'orbit' && 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
            record.conclusion.result === 'chaos' && 'bg-purple-500/20 text-purple-400 border border-purple-500/40',
            record.conclusion.result === 'timeout' && 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
          )}
        >
          {RESULT_LABELS[record.conclusion.result]}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
        <div className="flex items-center gap-1">
          <Clock size={12} />
          创建: {formatDate(record.createdAt)}
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          更新: {formatDate(record.updatedAt)}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="p-4 bg-gray-800/50 rounded-lg border-2 border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-300 font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              原始参数
              <span className="text-[10px] text-gray-600 ml-2">(发射时记录，不可修改)</span>
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span className="text-gray-500">发射角度: </span>
              <span className="text-gray-300">{record.raw.launchAngle.toFixed(1)}°</span>
            </div>
            <div>
              <span className="text-gray-500">发射速度: </span>
              <span className="text-gray-300">{record.raw.launchSpeed.toFixed(1)} px/s</span>
            </div>
            <div>
              <span className="text-gray-500">引力常数: </span>
              <span className="text-gray-300">{record.raw.physicsParams.gravitationalConstant.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-gray-500">时间步长: </span>
              <span className="text-gray-300">{record.raw.physicsParams.timeStep.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-gray-500">初始位置: </span>
              <span className="text-gray-300">
                ({record.raw.initialPosition.x.toFixed(1)}, {record.raw.initialPosition.y.toFixed(1)})
              </span>
            </div>
            <div>
              <span className="text-gray-500">初始速度: </span>
              <span className="text-gray-300">
                ({record.raw.initialVelocity.x.toFixed(1)}, {record.raw.initialVelocity.y.toFixed(1)})
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-500/5 rounded-lg border-2 border-blue-500/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-blue-400 font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              修正参数
              <span className="text-[10px] text-blue-600 ml-2">(可编辑)</span>
            </h4>
            {!isEditingParams ? (
              <button
                onClick={() => setIsEditingParams(true)}
                className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Edit2 size={14} />
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={handleSaveParams}
                  className="p-1 text-green-400 hover:text-green-300 transition-colors"
                >
                  <Save size={14} />
                </button>
                <button
                  onClick={() => {
                    setIsEditingParams(false);
                    setEditedParams(record.corrected.physicsParams);
                  }}
                  className="p-1 text-red-400 hover:text-red-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {isEditingParams ? (
              <>
                <div className="space-y-1">
                  <span className="text-gray-500">引力常数</span>
                  <input
                    type="number"
                    value={editedParams.gravitationalConstant}
                    onChange={(e) =>
                      setEditedParams({
                        ...editedParams,
                        gravitationalConstant: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-gray-300"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500">时间步长</span>
                  <input
                    type="number"
                    step={0.001}
                    value={editedParams.timeStep}
                    onChange={(e) =>
                      setEditedParams({
                        ...editedParams,
                        timeStep: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-gray-300"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-gray-500">引力常数: </span>
                  <span className="text-blue-300">
                    {record.corrected.physicsParams.gravitationalConstant.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">时间步长: </span>
                  <span className="text-blue-300">
                    {record.corrected.physicsParams.timeStep.toFixed(4)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 bg-green-500/5 rounded-lg border-2 border-green-500/30">
          <h4 className="text-sm font-bold text-green-400 font-mono flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            最终结论
          </h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <span className="text-gray-500">模拟时长: </span>
                <span className="text-green-300">{record.conclusion.duration.toFixed(3)}s</span>
              </div>
              <div>
                <span className="text-gray-500">总能量: </span>
                <span
                  className={cn(
                    'font-bold',
                    record.conclusion.finalEnergy.total > 0 ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {record.conclusion.finalEnergy.total.toFixed(2)}
                </span>
              </div>
            </div>

            {record.conclusion.errorMarks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-500 font-mono">异常标记</div>
                <div className="flex flex-wrap gap-1">
                  {record.conclusion.errorMarks.map((error) => (
                    <ErrorBadge key={error.id} type={error.type} size="sm" />
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-gray-800/50 rounded">
              <p className="text-sm text-gray-300 leading-relaxed">
                {record.conclusion.summary}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-300 font-mono flex items-center gap-2">
              <History size={14} className="text-purple-400" />
              备注版本
              <span className="text-[10px] text-gray-600">
                (共 {record.noteVersions.length} 个版本)
              </span>
            </h4>
            <button
              onClick={() => setShowNoteHistory(!showNoteHistory)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showNoteHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          <NoteEditor
            currentNote={record.corrected.notes}
            onSave={(content) => onAddNote(record.id, content)}
          />

          {showNoteHistory && record.noteVersions.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-gray-700 pt-4">
              {record.noteVersions
                .slice()
                .reverse()
                .map((version) => (
                  <div
                    key={version.version}
                    className="p-3 bg-gray-900/50 rounded border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-purple-400 font-mono">
                        版本 v{version.version}
                      </span>
                      <span className="text-[10px] text-gray-600 font-mono">
                        {formatDate(version.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{version.content}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
