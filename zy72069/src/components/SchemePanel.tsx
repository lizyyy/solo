import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { STATUS_LABELS, STATUS_COLORS } from '@/types';
import type { PointStatus, AnomalyRecord } from '@/types';

export default function SchemePanel() {
  const {
    schemes,
    currentSchemeId,
    setCurrentSchemeId,
    points,
    schemePoints,
    anomalies,
    addAnomaly,
    updatePointStatus,
    updateScheme,
    selectedPointId,
  } = useStore();

  const [editingSchemeNote, setEditingSchemeNote] = useState<string>('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheme' | 'detail'>('scheme');

  const currentScheme = schemes.find((s) => s.id === currentSchemeId);
  const currentSchemePts = schemePoints.filter((sp) => sp.schemeId === currentSchemeId);

  const selectedPoint = selectedPointId ? points.find((p) => p.id === selectedPointId) : null;
  const selectedAnomaly = selectedPointId ? anomalies.find((a) => a.pointId === selectedPointId) : null;
  const selectedSchemePt = selectedPointId
    ? currentSchemePts.find((sp) => sp.pointId === selectedPointId)
    : undefined;

  const handleSaveSchemeNote = () => {
    if (currentScheme) {
      updateScheme(currentScheme.id, { note: editingSchemeNote });
      setIsEditingNote(false);
    }
  };

  const handleStatusChange = (pointId: string, newStatus: PointStatus) => {
    const pt = points.find((p) => p.id === pointId);
    if (!pt) return;
    updatePointStatus(pointId, newStatus, pt.processNote);
  };

  const handleAddAnomalyNote = (pointId: string, note: string) => {
    if (!note.trim()) return;
    const existing = anomalies.find((a) => a.pointId === pointId);
    if (existing) {
      useStore.getState().updateAnomaly(existing.id, { processNote: note });
    } else {
      const newAnomaly: AnomalyRecord = {
        id: `anom-${Date.now()}`,
        pointId,
        type: '人工标注',
        description: note,
        sourceLine: points.find((p) => p.id === pointId)?.originalSource ?? '',
        processNote: note,
        processTime: new Date().toLocaleString('zh-CN'),
        resolved: false,
      };
      addAnomaly(newAnomaly);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-[#1a3a5c]">
        <button
          onClick={() => setActiveTab('scheme')}
          className={`flex-1 py-2 text-xs transition-colors ${
            activeTab === 'scheme' ? 'text-white border-b-2 border-[#4a90d9]' : 'text-[#666]'
          }`}
        >
          方案管理
        </button>
        <button
          onClick={() => setActiveTab('detail')}
          className={`flex-1 py-2 text-xs transition-colors ${
            activeTab === 'detail' ? 'text-white border-b-2 border-[#4a90d9]' : 'text-[#666]'
          }`}
        >
          点位详情
        </button>
      </div>

      {activeTab === 'scheme' && (
        <div className="flex-1 overflow-auto p-3 space-y-3">
          <div className="text-[10px] text-[#888]">方案切换</div>
          {schemes.map((scheme) => (
            <div
              key={scheme.id}
              onClick={() => setCurrentSchemeId(scheme.id)}
              className={`p-2 rounded cursor-pointer border transition-colors ${
                currentSchemeId === scheme.id
                  ? 'border-[#4a90d9] bg-[#0f3460]/30'
                  : 'border-[#222] hover:border-[#333]'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-white text-xs font-bold">{scheme.name}</span>
                <span className="text-[10px] text-[#666]">{scheme.version}</span>
              </div>
              <div className="text-[10px] text-[#888] mt-1">{scheme.note.slice(0, 60)}...</div>
              <div className="text-[9px] text-[#555] mt-1">
                更新: {scheme.updatedAt}
              </div>
            </div>
          ))}

          {currentScheme && (
            <div className="mt-3">
              <div className="text-[10px] text-[#888] mb-1">方案备注</div>
              {isEditingNote ? (
                <div className="space-y-1">
                  <textarea
                    value={editingSchemeNote}
                    onChange={(e) => setEditingSchemeNote(e.target.value)}
                    className="w-full h-20 bg-[#0a0a1a] border border-[#333] rounded p-2 text-xs text-white resize-none"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleSaveSchemeNote}
                      className="px-2 py-1 bg-[#0f3460] text-white text-[10px] rounded hover:bg-[#1a4a80]"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setIsEditingNote(false)}
                      className="px-2 py-1 bg-[#222] text-[#888] text-[10px] rounded hover:bg-[#333]"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    setEditingSchemeNote(currentScheme.note);
                    setIsEditingNote(true);
                  }}
                  className="p-2 bg-[#0a0a1a] border border-[#222] rounded text-xs text-[#aaa] cursor-pointer hover:border-[#333]"
                >
                  {currentScheme.note || '点击添加备注...'}
                </div>
              )}
            </div>
          )}

          {currentSchemePts.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] text-[#888] mb-1">方案内覆盖记录</div>
              {currentSchemePts.filter((sp) => sp.overrideNote || sp.overrideCoord).map((sp) => {
                const pt = points.find((p) => p.id === sp.pointId);
                return (
                  <div key={sp.pointId} className="p-1.5 bg-[#0a0a1a] rounded mb-1 text-[10px]">
                    <span className="text-[#4a90d9]">{sp.pointId}</span>
                    <span className="text-[#666]"> {pt?.name}</span>
                    {sp.overrideNote && <div className="text-[#f5a623] mt-0.5">备注: {sp.overrideNote}</div>}
                    {sp.overrideCoord && <div className="text-[#16c79a] mt-0.5">覆盖坐标: {sp.overrideCoord}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'detail' && (
        <div className="flex-1 overflow-auto p-3">
          {selectedPoint ? (
            <div className="space-y-3">
              <div>
                <div className="text-white text-sm font-bold">{selectedPoint.name}</div>
                <div className="text-[10px] text-[#666] font-mono">{selectedPoint.id}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-[#888]">坐标</span>
                  <div className="text-white font-mono">
                    ({selectedPoint.x}, {selectedPoint.y}, {selectedPoint.z})
                  </div>
                </div>
                <div>
                  <span className="text-[#888]">来源</span>
                  <div className="text-white">{selectedPoint.source}</div>
                </div>
                <div>
                  <span className="text-[#888]">来源明细</span>
                  <div className="text-[#4a90d9]">{selectedPoint.sourceDetail}</div>
                </div>
                <div>
                  <span className="text-[#888]">处理时间</span>
                  <div className="text-white font-mono">{selectedPoint.processTime}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#888] mb-1">状态</div>
                <div className="flex gap-1">
                  {(['pass', 'confirm', 'legacy'] as PointStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selectedPoint.id, s)}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                        selectedPoint.status === s ? 'border-transparent' : 'border-[#333]'
                      }`}
                      style={{
                        backgroundColor: selectedPoint.status === s ? STATUS_COLORS[s] + '33' : 'transparent',
                        color: STATUS_COLORS[s],
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {selectedPoint.gisNote && (
                <div className="p-2 bg-[#2a1a00] border border-[#553300] rounded">
                  <div className="text-[10px] text-[#f5a623] mb-0.5">GIS底图原始备注（保留原样）</div>
                  <div className="text-[#f5a623] text-xs">{selectedPoint.gisNote}</div>
                </div>
              )}

              <div>
                <div className="text-[10px] text-[#888] mb-1">处理备注</div>
                <div className="p-2 bg-[#0a0a1a] border border-[#222] rounded text-xs text-[#aaa]">
                  {selectedPoint.processNote || '无'}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#888] mb-1">原始来源</div>
                <div className="text-[#4a90d9] text-xs">{selectedPoint.originalSource}</div>
              </div>

              {selectedPoint.handModifiedCoord && (
                <div className="p-2 bg-[#001a2a] border border-[#003355] rounded">
                  <div className="text-[10px] text-[#16c79a] mb-0.5">同事手改坐标</div>
                  <div className="text-[#16c79a] text-xs">{selectedPoint.handModifiedCoord}</div>
                </div>
              )}

              {selectedPoint.photoRef && (
                <div>
                  <div className="text-[10px] text-[#888] mb-0.5">现场照片引用</div>
                  <div className="text-[#4a90d9] text-xs">{selectedPoint.photoRef}</div>
                </div>
              )}

              {selectedAnomaly && (
                <div className="p-2 bg-[#2a0a0a] border border-[#550000] rounded">
                  <div className="text-[10px] text-[#e94560] mb-0.5">异常记录</div>
                  <div className="text-[#e94560] text-xs">{selectedAnomaly.type}: {selectedAnomaly.description}</div>
                  <div className="text-[10px] text-[#888] mt-1">来源行: {selectedAnomaly.sourceLine}</div>
                  <div className="text-[10px] text-[#888]">处理备注: {selectedAnomaly.processNote}</div>
                  <div className="text-[10px] text-[#666]">处理时间: {selectedAnomaly.processTime}</div>
                </div>
              )}

              {selectedSchemePt && (selectedSchemePt.overrideNote || selectedSchemePt.overrideCoord) && (
                <div className="p-2 bg-[#0a1a2a] border border-[#003366] rounded">
                  <div className="text-[10px] text-[#4a90d9] mb-0.5">当前方案覆盖</div>
                  {selectedSchemePt.overrideNote && (
                    <div className="text-[#4a90d9] text-xs">备注: {selectedSchemePt.overrideNote}</div>
                  )}
                  {selectedSchemePt.overrideCoord && (
                    <div className="text-[#16c79a] text-xs">坐标: {selectedSchemePt.overrideCoord}</div>
                  )}
                </div>
              )}

              <div>
                <div className="text-[10px] text-[#888] mb-1">添加处理备注</div>
                <input
                  type="text"
                  placeholder="输入备注后回车..."
                  className="w-full bg-[#0a0a1a] border border-[#333] rounded p-1.5 text-xs text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      handleAddAnomalyNote(selectedPoint.id, e.currentTarget.value.trim());
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-[#555] text-xs text-center mt-10">
              点击3D场景中的点位或表格中的行查看详情
            </div>
          )}
        </div>
      )}
    </div>
  );
}
