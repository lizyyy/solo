import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Copy,
  Check,
  MapPin,
  FileText,
  History,
  AlertTriangle,
  Link2,
  Save,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { useFormationStore } from '@/store/formationStore';
import { useUIStore } from '@/store/uiStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SourceBadge } from '@/components/common/SourceBadge';
import { SOURCE_LABELS, STATUS_LABELS, type StatusType } from '@/types';

const statusOptions: StatusType[] = ['NORMAL', 'WARNING', 'CONFIRM', 'HISTORY', 'ERROR'];

export function DetailPanel() {
  const { rightPanelCollapsed, toggleRightPanel } = useUIStore();
  const { drones, selectedDroneId, getSelectedDrone, updateDroneNote, updateDroneStatus, focusDrone } = useFormationStore();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showRawData, setShowRawData] = useState(false);

  const selectedDrone = getSelectedDrone();

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getDistanceStatus = (distance: number) => {
    if (distance < 0) return { text: '无效', color: 'text-red-400' };
    if (distance < 3) return { text: '危险', color: 'text-red-400' };
    if (distance < 5) return { text: '预警', color: 'text-orange-400' };
    return { text: '安全', color: 'text-green-400' };
  };

  if (rightPanelCollapsed) {
    return (
      <div className="w-10 bg-[#0f1e36] border-l border-white/10 flex flex-col items-center py-4">
        <button
          onClick={toggleRightPanel}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="展开详情"
        >
          <ChevronLeft size={18} />
        </button>
        {selectedDrone && (
          <div className="mt-4 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        )}
      </div>
    );
  }

  if (!selectedDrone) {
    return (
      <div className="w-80 bg-[#0f1e36] border-l border-white/10 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Eye size={16} className="text-blue-400" />
            对象详情
          </h2>
          <button
            onClick={toggleRightPanel}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="收起面板"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <MapPin size={28} className="opacity-50" />
          </div>
          <p className="text-sm text-center">点击3D场景或左侧列表中的无人机查看详情</p>
          <p className="text-xs text-center mt-2 text-gray-600">双击可聚焦到目标位置</p>
        </div>
      </div>
    );
  }

  const distanceStatus = getDistanceStatus(selectedDrone.obstacleDistance);

  return (
    <div className="w-80 bg-[#0f1e36] border-l border-white/10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Eye size={16} className="text-blue-400" />
          对象详情
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => focusDrone(selectedDrone.id)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="聚焦到此对象"
          >
            <MapPin size={14} />
          </button>
          <button
            onClick={toggleRightPanel}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="收起面板"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-white font-mono">{selectedDrone.id}</h3>
              <p className="text-sm text-gray-400 mt-0.5">{selectedDrone.name}</p>
            </div>
            <StatusBadge status={selectedDrone.status} pulse />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">X 坐标</p>
              <p className="text-sm font-mono text-white mt-1">{selectedDrone.position.x.toFixed(2)}</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Y 坐标</p>
              <p className="text-sm font-mono text-white mt-1">{selectedDrone.position.y.toFixed(2)}</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Z 坐标</p>
              <p className="text-sm font-mono text-white mt-1">{selectedDrone.position.z.toFixed(2)}</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">避障距离</p>
              <p className={`text-sm font-mono font-medium mt-1 ${distanceStatus.color}`}>
                {selectedDrone.obstacleDistance >= 0 ? `${selectedDrone.obstacleDistance.toFixed(2)}m` : '无效'}
              </p>
              <p className={`text-[10px] mt-0.5 ${distanceStatus.color}`}>{distanceStatus.text}</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={14} className="text-blue-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">来源追溯</h4>
          </div>

          <div className="bg-black/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <SourceBadge type={selectedDrone.source.type} />
              <button
                onClick={() => copyToClipboard(selectedDrone.source.reference, 'sourceRef')}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="复制引用"
              >
                {copiedField === 'sourceRef' ? (
                  <Check size={12} className="text-green-400" />
                ) : (
                  <Copy size={12} className="text-gray-500" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-300 font-medium">{selectedDrone.source.name}</p>
            <p className="text-[10px] text-gray-500 mt-1 font-mono">{selectedDrone.source.reference}</p>

            {selectedDrone.source.rawData && (
              <div className="mt-3">
                <button
                  onClick={() => setShowRawData(!showRawData)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <FileText size={10} />
                  {showRawData ? '隐藏原始数据' : '查看原始数据'}
                </button>
                {showRawData && (
                  <div className="mt-2 p-2 bg-[#0a1628] rounded border border-white/10">
                    <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all">
                      {selectedDrone.source.rawData}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-orange-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">状态标记</h4>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => updateDroneStatus(selectedDrone.id, status)}
                className={`px-2 py-1 text-[10px] rounded transition-all ${
                  selectedDrone.status === status
                    ? 'ring-2 ring-offset-2 ring-offset-[#0f1e36]'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundColor:
                    selectedDrone.status === status
                      ? `${STATUS_LABELS[status] === '正常' ? '#43A047' : STATUS_LABELS[status] === '预警' ? '#FB8C00' : STATUS_LABELS[status] === '待人工确认' ? '#FF9800' : STATUS_LABELS[status] === '历史口径' ? '#78909C' : '#E53935'}30`
                      : 'transparent',
                  borderColor:
                    selectedDrone.status === status
                      ? `${STATUS_LABELS[status] === '正常' ? '#43A047' : STATUS_LABELS[status] === '预警' ? '#FB8C00' : STATUS_LABELS[status] === '待人工确认' ? '#FF9800' : STATUS_LABELS[status] === '历史口径' ? '#78909C' : '#E53935'}60`
                      : '#ffffff20',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color:
                    STATUS_LABELS[status] === '正常' ? '#43A047' : STATUS_LABELS[status] === '预警' ? '#FB8C00' : STATUS_LABELS[status] === '待人工确认' ? '#FF9800' : STATUS_LABELS[status] === '历史口径' ? '#78909C' : '#E53935',
                  '--tw-ring-color':
                    STATUS_LABELS[status] === '正常' ? '#43A047' : STATUS_LABELS[status] === '预警' ? '#FB8C00' : STATUS_LABELS[status] === '待人工确认' ? '#FF9800' : STATUS_LABELS[status] === '历史口径' ? '#78909C' : '#E53935',
                } as React.CSSProperties}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-green-400" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">处理备注</h4>
            </div>
            <Save size={12} className="text-gray-500" />
          </div>

          <textarea
            value={selectedDrone.currentNote}
            onChange={(e) => updateDroneNote(selectedDrone.id, e.target.value)}
            placeholder="输入本次处理的备注说明，说明判定原因..."
            className="w-full h-24 px-3 py-2 bg-black/20 border border-white/10 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none transition-colors"
          />
          <p className="text-[10px] text-gray-500 mt-1.5">
            此备注将随报告一起导出，请清晰说明"无人机编队避障舱"的判定原因
          </p>
        </div>

        {selectedDrone.historyNotes && selectedDrone.historyNotes.length > 0 && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-purple-400" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">历史口径</h4>
            </div>

            <div className="space-y-3">
              {selectedDrone.historyNotes.map((note, index) => (
                <div
                  key={note.id}
                  className="relative pl-4 pb-3 border-l-2 border-purple-500/30 last:pb-0"
                >
                  <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-purple-500" />
                  <div className="bg-black/20 rounded-lg p-3 -mt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-medium text-purple-400">{note.author}</span>
                      <span className="text-[10px] text-gray-500">{note.date}</span>
                    </div>
                    <p className="text-xs text-gray-300">{note.content}</p>
                    <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
                      <Link2 size={10} />
                      {note.source}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-t border-white/10 bg-[#0a1628]">
          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
            <div>
              <span className="text-gray-600">创建时间:</span>
              <p className="text-gray-400 mt-0.5">{formatDate(selectedDrone.createdAt)}</p>
            </div>
            <div>
              <span className="text-gray-600">更新时间:</span>
              <p className="text-gray-400 mt-0.5">{formatDate(selectedDrone.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
