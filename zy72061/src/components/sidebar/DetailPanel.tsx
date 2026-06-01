import { useState } from 'react';
import {
  X,
  Info,
  Database,
  FileText,
  AlertTriangle,
  MessageSquare,
  Clock,
  User,
  Edit3,
  Check,
  Tag,
} from 'lucide-react';
import { useGaitStore } from '../../store/useGaitStore';
import {
  BONE_GROUP_LABELS,
  DATA_SOURCE_LABELS,
  ANOMALY_TYPE_LABELS,
  ANOMALY_TYPE_SUGGESTIONS,
  AnomalyType,
} from '../../types';

export default function DetailPanel() {
  const { selectedPointId, setSelectedPointId, getSelectedPoint, togglePointAnomaly, addNoteToPoint } = useGaitStore();
  const selectedPoint = getSelectedPoint();
  const [newNote, setNewNote] = useState('');
  const [authorName, setAuthorName] = useState('阿乔');
  const [showAnomalyDialog, setShowAnomalyDialog] = useState(false);
  const [selectedAnomalyType, setSelectedAnomalyType] = useState<AnomalyType>('coordinate_error');
  const [anomalyNote, setAnomalyNote] = useState('');

  if (!selectedPointId || !selectedPoint) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Info size={20} className="text-blue-600" />
            点位详情
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-gray-500">
            <Info size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-sm">点击3D视图中的点位</p>
            <p className="text-sm">查看详细信息</p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNoteToPoint(selectedPointId, newNote.trim(), authorName);
      setNewNote('');
    }
  };

  const handleToggleAnomaly = () => {
    if (selectedPoint.isAnomaly) {
      togglePointAnomaly(selectedPointId);
    } else {
      setShowAnomalyDialog(true);
    }
  };

  const handleConfirmAnomaly = () => {
    togglePointAnomaly(selectedPointId, selectedAnomalyType, anomalyNote);
    setShowAnomalyDialog(false);
    setAnomalyNote('');
  };

  const getSuggestion = () => {
    if (!selectedPoint.anomalyType) return '';
    const template = ANOMALY_TYPE_SUGGESTIONS[selectedPoint.anomalyType];
    return template.replace('{row}', selectedPoint.sourceRow?.toString() || 'N');
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Info size={20} className="text-blue-600" />
          点位详情
        </h2>
        <button
          onClick={() => setSelectedPointId(null)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-bold text-gray-900">{selectedPoint.nameCn}</h3>
            {selectedPoint.isAnomaly && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full flex items-center gap-1">
                <AlertTriangle size={12} />
                异常
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 font-mono">{selectedPoint.name}</p>
        </div>

        <div className="p-4 border-b border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Tag size={14} className="text-gray-400" />
            坐标信息
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500">X</div>
              <div className="text-sm font-mono font-semibold text-gray-800">
                {selectedPoint.x.toFixed(4)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500">Y</div>
              <div className="text-sm font-mono font-semibold text-gray-800">
                {selectedPoint.y.toFixed(4)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500">Z</div>
              <div className="text-sm font-mono font-semibold text-gray-800">
                {selectedPoint.z.toFixed(4)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
              {BONE_GROUP_LABELS[selectedPoint.boneGroup]}
            </span>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Database size={14} className="text-gray-400" />
            数据来源
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">来源类型</span>
              <span className="font-medium text-gray-800">
                {DATA_SOURCE_LABELS[selectedPoint.source]}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">源文件</span>
              <span className="font-mono text-gray-800">{selectedPoint.sourceFile || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">原始行号</span>
              <span className="font-mono text-gray-800">第 {selectedPoint.sourceRow || '-'} 行</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">处理人</span>
              <span className="text-gray-800 flex items-center gap-1">
                <User size={12} className="text-gray-400" />
                {selectedPoint.processedBy || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">创建时间</span>
              <span className="text-gray-800 text-xs">{formatDate(selectedPoint.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">更新时间</span>
              <span className="text-gray-800 text-xs">{formatDate(selectedPoint.updatedAt)}</span>
            </div>
          </div>
        </div>

        {selectedPoint.isAnomaly && (
          <div className="p-4 border-b border-gray-100 bg-orange-50">
            <h4 className="text-sm font-medium text-orange-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange-500" />
              异常信息
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-orange-600">异常类型</span>
                <span className="font-medium text-orange-800">
                  {selectedPoint.anomalyType ? ANOMALY_TYPE_LABELS[selectedPoint.anomalyType] : '-'}
                </span>
              </div>
              {selectedPoint.anomalyNote && (
                <div className="mt-2 p-2 bg-white rounded border border-orange-200">
                  <p className="text-orange-700 text-xs">{selectedPoint.anomalyNote}</p>
                </div>
              )}
              <div className="mt-3 p-3 bg-white rounded-lg border border-orange-200">
                <p className="text-xs text-orange-700 font-medium mb-1">处理建议：</p>
                <p className="text-xs text-orange-600">{getSuggestion()}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <MessageSquare size={14} className="text-gray-400" />
            处理备注 ({selectedPoint.notes.length})
          </h4>

          {selectedPoint.notes.length > 0 ? (
            <div className="space-y-3 mb-4">
              {selectedPoint.notes.map((note, index) => (
                <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      <User size={12} className="text-gray-400" />
                      {note.author}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(note.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{note.content}</p>
                  {note.diff && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs">
                      <span className="text-gray-500">差异：</span>
                      <span className="text-red-500">
                        ({note.diff.previous?.x?.toFixed(2)}, {note.diff.previous?.y?.toFixed(2)}, {note.diff.previous?.z?.toFixed(2)})
                      </span>
                      <span className="mx-1">→</span>
                      <span className="text-green-500">
                        ({note.diff.current?.x?.toFixed(2)}, {note.diff.current?.y?.toFixed(2)}, {note.diff.current?.z?.toFixed(2)})
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">暂无处理备注</p>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="您的名字"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="添加备注..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={handleToggleAnomaly}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            selectedPoint.isAnomaly
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
          }`}
        >
          {selectedPoint.isAnomaly ? (
            <>
              <Check size={16} />
              标记为正常
            </>
          ) : (
            <>
              <AlertTriangle size={16} />
              标记为异常
            </>
          )}
        </button>
      </div>

      {showAnomalyDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">标记异常</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">异常类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ANOMALY_TYPE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedAnomalyType(key as AnomalyType)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedAnomalyType === key
                          ? 'bg-orange-100 text-orange-700 border-2 border-orange-400'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">异常说明（可选）</label>
                <textarea
                  value={anomalyNote}
                  onChange={(e) => setAnomalyNote(e.target.value)}
                  placeholder="描述异常情况..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={3}
                />
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-orange-700">
                  <strong>建议：</strong>
                  {ANOMALY_TYPE_SUGGESTIONS[selectedAnomalyType].replace('{row}', selectedPoint.sourceRow?.toString() || 'N')}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAnomalyDialog(false)}
                className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmAnomaly}
                className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                确认标记
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
