import { useState } from 'react';
import {
  Camera,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  Layers,
  MapPin,
  RefreshCw,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from 'lucide-react';
import type { CollisionPoint, BimNote, BimComponent } from '../types';
import StatusBadge from './StatusBadge';
import BimSceneViewer from './BimSceneViewer';

interface CollisionsProps {
  collisions: CollisionPoint[];
  bimNotes: BimNote[];
  bimComponents: BimComponent[];
  selectedCollisionId?: string | null;
  onSelectCollision?: (id: string | null) => void;
  onConfirmDuplicate?: (collisionId: string, isDuplicate: boolean) => void;
}

export default function Collisions({
  collisions,
  bimNotes,
  bimComponents,
  selectedCollisionId,
  onSelectCollision,
  onConfirmDuplicate,
}: CollisionsProps) {
  const [filter, setFilter] = useState<'all' | 'duplicate' | 'pending'>('all');
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'scene' | 'screenshot'>('scene');

  const selectedId = selectedCollisionId ?? internalSelected;
  const selected = collisions.find((c) => c.id === selectedId);

  const handleSelect = (id: string) => {
    setInternalSelected(id);
    onSelectCollision?.(id);
  };

  const filteredCollisions = collisions.filter((c) => {
    if (filter === 'duplicate') return c.isDuplicate;
    if (filter === 'pending') return c.needsManualReview || c.status === 'pending';
    return true;
  });

  const getBimNote = (id: string) => bimNotes.find((n) => n.id === id);
  const getDuplicateOf = (id: string) => collisions.find((c) => c.id === id);

  const duplicateCount = collisions.filter((c) => c.isDuplicate).length;
  const pendingReview = collisions.filter((c) => c.needsManualReview).length;

  const relatedComponents = selected
    ? bimComponents.filter((c) => selected.componentIds.includes(c.id))
    : [];

  return (
    <div className="h-full flex">
      <div className="w-96 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3">碰撞点列表</h3>
          <div className="flex gap-2">
            <FilterButton
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              label="全部"
              count={collisions.length}
            />
            <FilterButton
              active={filter === 'duplicate'}
              onClick={() => setFilter('duplicate')}
              label="重复"
              count={duplicateCount}
              alert
            />
            <FilterButton
              active={filter === 'pending'}
              onClick={() => setFilter('pending')}
              label="待复核"
              count={pendingReview}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredCollisions.map((collision) => (
            <button
              key={collision.id}
              onClick={() => handleSelect(collision.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedId === collision.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-white border border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    collision.isDuplicate
                      ? 'bg-amber-100 text-amber-600'
                      : collision.needsManualReview
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {collision.name}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {collision.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <StatusBadge status={collision.status} />
                    {collision.isDuplicate && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                        <Copy size={10} />
                        重复
                      </span>
                    )}
                    {collision.needsManualReview && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                        <Eye size={10} />
                        需人工
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selected ? (
          <>
            <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-slate-800">
                    {selected.name}
                  </h2>
                  <StatusBadge status={selected.status} />
                </div>
                <p className="text-sm text-slate-500">{selected.description}</p>
              </div>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('scene')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    viewMode === 'scene'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Layers size={14} className="inline mr-1" />
                  3D场景
                </button>
                <button
                  onClick={() => setViewMode('screenshot')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    viewMode === 'screenshot'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Camera size={14} className="inline mr-1" />
                  截图
                </button>
              </div>
            </div>

            {selected.isDuplicate && selected.needsManualReview && (
              <div className="mx-4 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-800">疑似重复碰撞点，需人工确认</p>
                    <p className="text-sm text-amber-700 mt-1">{selected.duplicateReason}</p>
                    {selected.duplicateOf && getDuplicateOf(selected.duplicateOf) && (
                      <p className="text-sm text-amber-600 mt-2">
                        重复目标：{getDuplicateOf(selected.duplicateOf)?.name}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => onConfirmDuplicate?.(selected.id, true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                      >
                        <ThumbsUp size={14} />
                        确认重复
                      </button>
                      <button
                        onClick={() => onConfirmDuplicate?.(selected.id, false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                      >
                        <ThumbsDown size={14} />
                        不是重复
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {viewMode === 'scene' ? (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <Layers size={16} />
                    BIM 场景视图
                  </h4>
                  <BimSceneViewer
                    components={bimComponents}
                    collisions={collisions}
                    selectedCollisionId={selectedId}
                    height={320}
                  />
                  {relatedComponents.length > 0 && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs font-medium text-slate-600 mb-2">涉及构件</p>
                      <div className="flex flex-wrap gap-2">
                        {relatedComponents.map((comp) => (
                          <span
                            key={comp.id}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: comp.color }}
                            />
                            {comp.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <Camera size={16} />
                    碰撞截图
                  </h4>
                  <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
                    <img
                      src={selected.screenshotUrl}
                      alt={selected.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <button
                        onClick={() => {
                          const view = selected.cameraView;
                          alert(
                            `视角已还原：\n位置: (${view.position.x}, ${view.position.y}, ${view.position.z})\n旋转: (${view.rotation.x}, ${view.rotation.y}, ${view.rotation.z})\n缩放: ${view.zoom}x`
                          );
                        }}
                        className="px-3 py-1.5 text-xs bg-white/90 text-slate-700 rounded-lg flex items-center gap-1.5 hover:bg-white transition-colors"
                      >
                        <RefreshCw size={12} />
                        还原视角
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <MapPin size={16} />
                  视角参数
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">相机位置</p>
                    <p className="text-sm font-mono text-slate-700">
                      X: {selected.cameraView.position.x.toFixed(1)}
                      <br />
                      Y: {selected.cameraView.position.y.toFixed(1)}
                      <br />
                      Z: {selected.cameraView.position.z.toFixed(1)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">旋转角度</p>
                    <p className="text-sm font-mono text-slate-700">
                      X: {selected.cameraView.rotation.x.toFixed(1)}°
                      <br />
                      Y: {selected.cameraView.rotation.y.toFixed(1)}°
                      <br />
                      Z: {selected.cameraView.rotation.z.toFixed(1)}°
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">缩放比例</p>
                    <p className="text-2xl font-bold text-slate-700 mt-2">
                      {selected.cameraView.zoom.toFixed(1)}x
                    </p>
                  </div>
                </div>
              </div>

              {selected.duplicateEvidence && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <Copy size={16} />
                    重复依据
                  </h4>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">空间距离</span>
                      <span className="text-sm font-medium text-amber-700">
                        {selected.duplicateEvidence.spatialDistance.toFixed(2)}m
                        <span className="text-xs text-amber-500 ml-1">（小于3m）</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">共享构件</span>
                      <span className="text-sm font-medium text-amber-700">
                        {selected.duplicateEvidence.componentIds.length} 个
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">同一BIM备注</span>
                      <span className="text-sm font-medium">
                        {selected.duplicateEvidence.sameBimNote ? (
                          <Check size={16} className="text-green-600" />
                        ) : (
                          <XCircle size={16} className="text-slate-400" />
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">相似视角</span>
                      <span className="text-sm font-medium">
                        {selected.duplicateEvidence.similarCameraAngle ? (
                          <Check size={16} className="text-green-600" />
                        ) : (
                          <XCircle size={16} className="text-slate-400" />
                        )}
                      </span>
                    </div>
                    {selected.affectedItems && selected.affectedItems.length > 0 && (
                      <div className="pt-3 border-t border-amber-200">
                        <p className="text-xs font-medium text-amber-700 mb-2">会影响哪些记录</p>
                        <ul className="space-y-1">
                          {selected.affectedItems.map((item, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-amber-700 flex items-center gap-2"
                            >
                              <AlertTriangle size={12} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Eye size={16} />
                  关联信息
                </h4>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">来源BIM备注</p>
                    {getBimNote(selected.bimNoteId) && (
                      <p className="text-sm text-slate-700 font-medium">
                        {getBimNote(selected.bimNoteId)?.title}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      {selected.bimNoteId}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">创建时间</p>
                      <p className="text-sm text-slate-700">
                        {new Date(selected.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">更新时间</p>
                      <p className="text-sm text-slate-700">
                        {new Date(selected.updatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Camera size={48} className="mx-auto mb-3 opacity-50" />
              <p>选择一个碰撞点查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, label, count, alert }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 text-xs rounded-md transition-colors flex items-center justify-center gap-1.5 ${
        active
          ? alert
            ? 'bg-amber-100 text-amber-700'
            : 'bg-blue-100 text-blue-700'
          : 'bg-white text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
      <span
        className={`px-1.5 py-0.5 text-xs rounded-full ${
          active ? 'bg-white/50' : 'bg-slate-100'
        }`}
      >
        {count}
      </span>
    </button>
  );
}
