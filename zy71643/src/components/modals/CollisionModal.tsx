import { X, AlertTriangle, MapPin, Ruler, GitBranch, Clock } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useCollisionStore } from '../../stores/collisionStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import {
  collisionTypeLabels,
  statusLabels,
  collisionColors,
  pipelineTypeLabels,
} from '../../data/config';
import { cn } from '../../lib/utils';

export function CollisionModal() {
  const show = useUIStore((state) => state.showCollisionModal);
  const setShow = useUIStore((state) => state.setShowCollisionModal);
  const selectedCollision = useCollisionStore((state) => state.selectedCollision);
  const getRecordsByCollision = useWorkflowStore((state) => state.getRecordsByCollision);
  const setRightPanelTab = useUIStore((state) => state.setRightPanelTab);
  const setShowCollisionModal = useUIStore((state) => state.setShowCollisionModal);

  if (!show || !selectedCollision) return null;

  const records = getRecordsByCollision(selectedCollision.id);

  const handleGoToWorkflow = () => {
    setShowCollisionModal(false);
    setRightPanelTab('workflow');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: collisionColors[selectedCollision.severity] + '30' }}
            >
              <AlertTriangle size={18} style={{ color: collisionColors[selectedCollision.severity] }} />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">
                {collisionTypeLabels[selectedCollision.type]}
              </h2>
              <p className="text-slate-400 text-xs">
                {selectedCollision.severity === 'critical' ? '严重问题' : selectedCollision.severity === 'warning' ? '警告问题' : '提示问题'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShow(false)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(85vh-130px)]">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={14} className="text-blue-400" />
                <span className="text-xs text-slate-400">碰撞位置</span>
              </div>
              <p className="text-white font-mono text-sm">{selectedCollision.pileNo || '未知桩号'}</p>
              <p className="text-slate-500 text-xs mt-1">
                ({selectedCollision.position.x.toFixed(1)}, {selectedCollision.position.y.toFixed(1)}, {selectedCollision.position.z.toFixed(1)})
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Ruler size={14} className="text-cyan-400" />
                <span className="text-xs text-slate-400">净距分析</span>
              </div>
              <p className="text-white font-mono text-sm">
                <span className={cn(
                  selectedCollision.calculatedDistance < 0 ? 'text-red-400' :
                  selectedCollision.calculatedDistance < selectedCollision.requiredDistance ? 'text-orange-400' : 'text-green-400'
                )}>
                  {selectedCollision.calculatedDistance.toFixed(3)}m
                </span>
                <span className="text-slate-500"> / ≥{selectedCollision.requiredDistance}m</span>
              </p>
              <p className="text-slate-500 text-xs mt-1">
                差值: {(selectedCollision.calculatedDistance - selectedCollision.requiredDistance).toFixed(3)}m
              </p>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
              <GitBranch size={14} className="text-purple-400" />
              涉及管段
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[selectedCollision.segmentA, selectedCollision.segmentB].map((segment, idx) => (
                <div key={segment.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">管段 {idx + 1}</span>
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded font-medium',
                      segment.type === 'water' && 'bg-blue-500/20 text-blue-400',
                      segment.type === 'electric' && 'bg-yellow-500/20 text-yellow-400',
                      segment.type === 'gas' && 'bg-orange-500/20 text-orange-400'
                    )}>
                      {pipelineTypeLabels[segment.type]}
                    </span>
                  </div>
                  <p className="text-white text-sm font-medium mb-1">{segment.pipelineName}</p>
                  <p className="text-slate-400 text-xs">管径: {segment.diameter}{segment.unit}</p>
                  <p className="text-slate-400 text-xs">桩号: {segment.startPileNo} ~ {segment.endPileNo}</p>
                  <p className="text-slate-500 text-[10px] mt-1 font-mono">
                    ({segment.startPoint.x.toFixed(0)}, {segment.startPoint.y.toFixed(2)}, {segment.startPoint.z.toFixed(0)})
                    →
                    ({segment.endPoint.x.toFixed(0)}, {segment.endPoint.y.toFixed(2)}, {segment.endPoint.z.toFixed(0)})
                  </p>
                  {segment.hasWarning && (
                    <div className="mt-2 px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] text-yellow-400">
                      {segment.warningMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {selectedCollision.dataIssues.length > 0 && (
            <div className="mb-5">
              <h3 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-yellow-400" />
                关联数据异常 ({selectedCollision.dataIssues.length}处)
              </h3>
              <div className="space-y-2">
                {selectedCollision.dataIssues.map((issue, idx) => (
                  <div key={idx} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-400 font-mono text-xs mt-0.5">#{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-yellow-300 text-xs font-medium">{issue.description}</p>
                        <p className="text-slate-400 text-xs mt-1">
                          <span className="text-slate-500">影响: </span>{issue.impact}
                        </p>
                        {issue.correctedValue !== undefined && (
                          <p className="text-green-400 text-xs mt-1 font-mono">
                            已修正: {JSON.stringify(issue.originalValue)} → {JSON.stringify(issue.correctedValue)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {records.length > 0 && (
            <div>
              <h3 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                处理记录
              </h3>
              <div className="space-y-3">
                {records.map((record) => (
                  <div key={record.id} className="relative pl-4 pb-3 border-l border-slate-700 last:pb-0">
                    <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-slate-600 border-2 border-slate-900" />
                    <div className="text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-slate-300 font-medium">{record.handler}</span>
                        <span className="text-slate-500">
                          {statusLabels[record.fromStatus]} → {statusLabels[record.toStatus]}
                        </span>
                      </div>
                      <p className="text-slate-400 mb-1">{record.remark}</p>
                      <p className="text-slate-500 text-[10px]">
                        {new Date(record.timestamp).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-700 bg-slate-800/30">
          <button
            onClick={() => setShow(false)}
            className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            关闭
          </button>
          <button
            onClick={handleGoToWorkflow}
            className="px-4 py-2 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <GitBranch size={12} />
            去处理
          </button>
        </div>
      </div>
    </div>
  );
}
