import { useState } from 'react';
import { Camera, AlertTriangle, Copy, Check, Eye, Layers, MapPin, RefreshCw } from 'lucide-react';
import type { CollisionPoint, BimNote } from '../types';
import StatusBadge from './StatusBadge';

interface CollisionsProps {
  collisions: CollisionPoint[];
  bimNotes: BimNote[];
}

export default function Collisions({ collisions, bimNotes }: CollisionsProps) {
  const [selectedCollision, setSelectedCollision] = useState<CollisionPoint | null>(null);
  const [filter, setFilter] = useState<'all' | 'duplicate' | 'pending'>('all');

  const filteredCollisions = collisions.filter((c) => {
    if (filter === 'duplicate') return c.isDuplicate;
    if (filter === 'pending') return c.needsManualReview || c.status === 'pending';
    return true;
  });

  const getBimNote = (id: string) => bimNotes.find((n) => n.id === id);
  const getDuplicateOf = (id: string) => collisions.find((c) => c.id === id);

  const duplicateCount = collisions.filter((c) => c.isDuplicate).length;
  const pendingReview = collisions.filter((c) => c.needsManualReview).length;

  return (
    <div className="h-full flex">
      <div className="w-96 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3">碰撞点列表</h3>
          <div className="flex gap-2">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="全部" count={collisions.length} />
            <FilterButton active={filter === 'duplicate'} onClick={() => setFilter('duplicate')} label="重复" count={duplicateCount} alert />
            <FilterButton active={filter === 'pending'} onClick={() => setFilter('pending')} label="待复核" count={pendingReview} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredCollisions.map((collision) => (
            <button
              key={collision.id}
              onClick={() => setSelectedCollision(collision)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedCollision?.id === collision.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-white border border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  collision.isDuplicate ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                }`}>
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{collision.name}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{collision.description}</p>
                  <div className="flex items-center gap-2 mt-2">
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

      <div className="flex-1 flex flex-col bg-white">
        {selectedCollision ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{selectedCollision.name}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedCollision.description}</p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={selectedCollision.status} />
                </div>
              </div>
              {selectedCollision.isDuplicate && selectedCollision.duplicateReason && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">重复碰撞点</p>
                      <p className="mt-1">{selectedCollision.duplicateReason}</p>
                      {selectedCollision.duplicateOf && getDuplicateOf(selectedCollision.duplicateOf) && (
                        <p className="mt-2 text-amber-700">
                          重复目标：{getDuplicateOf(selectedCollision.duplicateOf)?.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {selectedCollision.needsManualReview && selectedCollision.affectedItems && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">影响条目</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {selectedCollision.affectedItems.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check size={14} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Camera size={16} />
                  碰撞截图
                </h4>
                <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video">
                  <img
                    src={selectedCollision.screenshotUrl}
                    alt={selectedCollision.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    <button
                      onClick={() => {
                        const view = selectedCollision.cameraView;
                        alert(`视角已还原：\n位置: (${view.position.x}, ${view.position.y}, ${view.position.z})\n旋转: (${view.rotation.x}, ${view.rotation.y}, ${view.rotation.z})\n缩放: ${view.zoom}`);
                      }}
                      className="px-3 py-1.5 text-xs bg-white/90 text-slate-700 rounded-lg flex items-center gap-1.5 hover:bg-white transition-colors"
                    >
                      <RefreshCw size={12} />
                      还原视角
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <MapPin size={16} />
                  视角参数
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">相机位置</p>
                    <p className="text-sm font-mono text-slate-700">
                      X: {selectedCollision.cameraView.position.x.toFixed(1)}<br />
                      Y: {selectedCollision.cameraView.position.y.toFixed(1)}<br />
                      Z: {selectedCollision.cameraView.position.z.toFixed(1)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">旋转角度</p>
                    <p className="text-sm font-mono text-slate-700">
                      X: {selectedCollision.cameraView.rotation.x.toFixed(1)}°<br />
                      Y: {selectedCollision.cameraView.rotation.y.toFixed(1)}°<br />
                      Z: {selectedCollision.cameraView.rotation.z.toFixed(1)}°
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">缩放比例</p>
                    <p className="text-2xl font-bold text-slate-700 mt-2">
                      {selectedCollision.cameraView.zoom.toFixed(1)}x
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Layers size={16} />
                  关联信息
                </h4>
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">来源BIM备注</p>
                    {getBimNote(selectedCollision.bimNoteId) && (
                      <p className="text-sm text-slate-700 font-medium">
                        {getBimNote(selectedCollision.bimNoteId)?.title}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1 font-mono">{selectedCollision.bimNoteId}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">创建时间</p>
                      <p className="text-sm text-slate-700">
                        {new Date(selectedCollision.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">更新时间</p>
                      <p className="text-sm text-slate-700">
                        {new Date(selectedCollision.updatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
      <span className={`px-1.5 py-0.5 text-xs rounded-full ${
        active ? 'bg-white/50' : 'bg-slate-100'
      }`}>
        {count}
      </span>
    </button>
  );
}
