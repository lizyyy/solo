import { useState } from 'react';
import { X, MapPin, TrendingUp, Download, Plus, Send } from 'lucide-react';
import type { Point, PointStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { SourceRow } from './SourceRow';
import { JudgementTimeline } from './JudgementTimeline';
import { formatCoordinate, formatChangeRate } from '../../utils/coordinate';

interface PointDetailProps {
  point: Point | null;
  onClose: () => void;
  onExport: (point: Point) => void;
  onUpdateStatus: (id: string, status: PointStatus, isAnomaly: boolean) => void;
  onAddRemark: (pointId: string, content: string, author: string) => void;
}

type TabType = 'info' | 'source' | 'timeline';

export function PointDetail({
  point,
  onClose,
  onExport,
  onUpdateStatus,
  onAddRemark,
}: PointDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [newRemark, setNewRemark] = useState('');
  const [authorName, setAuthorName] = useState('');

  if (!point) return null;

  const tabs: { key: TabType; label: string }[] = [
    { key: 'info', label: '基本信息' },
    { key: 'source', label: '来源数据' },
    { key: 'timeline', label: '判定过程' },
  ];

  const statusOptions: { value: PointStatus; label: string; anomaly: boolean }[] = [
    { value: 'success', label: '顺利处理', anomaly: false },
    { value: 'pending', label: '待人工确认', anomaly: true },
    { value: 'legacy', label: '旧口径补录', anomaly: false },
  ];

  const handleAddRemark = () => {
    if (newRemark.trim() && authorName.trim()) {
      onAddRemark(point.id, newRemark.trim(), authorName.trim());
      setNewRemark('');
    }
  };

  return (
    <div
      className="absolute bottom-4 right-4 w-96 max-h-[calc(100vh-120px)] overflow-hidden rounded-2xl shadow-2xl animate-in slide-in-from-right-4 duration-300"
      style={{
        backgroundColor: 'rgba(15, 28, 54, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
          >
            <MapPin size={18} className="text-blue-400" />
          </div>
          <div>
            <h3
              className="text-base font-semibold text-white"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {point.name}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span>{formatCoordinate(point.lat, point.lng)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExport(point)}
            className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors"
            title="导出截图"
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}>
        <div className="flex items-center justify-between">
          <StatusBadge status={point.status} isAnomaly={point.isAnomaly} />
          <div className="flex items-center gap-2">
            <TrendingUp
              size={14}
              style={{ color: point.changeRate > 0 ? '#10b981' : '#ef4444' }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: point.changeRate > 0 ? '#10b981' : '#ef4444' }}
            >
              {formatChangeRate(point.changeRate)}
            </span>
            <span className="text-xs text-gray-400">{point.changeType}</span>
          </div>
        </div>
      </div>

      <div className="flex border-b px-5" style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-3 text-xs font-medium transition-colors relative"
            style={{
              color: activeTab === tab.key ? '#3b82f6' : '#94a3b8',
            }}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: '#3b82f6' }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                更新状态
              </label>
              <div className="flex gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onUpdateStatus(point.id, option.value, option.anomaly)}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: point.status === option.value
                        ? `${option.anomaly ? '#ef4444' : '#10b981'}20`
                        : 'rgba(255, 255, 255, 0.05)',
                      color: point.status === option.value
                        ? (option.anomaly ? '#ef4444' : '#10b981')
                        : '#94a3b8',
                      border: point.status === option.value
                        ? `1px solid ${option.anomaly ? '#ef4444' : '#10b981'}50`
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="p-4 rounded-xl"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
            >
              <div className="text-xs font-medium text-gray-400 mb-2">当前判定</div>
              <p className="text-sm text-white leading-relaxed">{point.judgement}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                添加备注
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="您的称呼..."
                className="w-full px-3 py-2 mb-2 rounded-lg text-sm text-white placeholder-gray-500 outline-none"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRemark()}
                  placeholder="输入备注内容..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 outline-none"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                />
                <button
                  onClick={handleAddRemark}
                  disabled={!newRemark.trim() || !authorName.trim()}
                  className="px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  <Plus size={16} className="hidden" />
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'source' && <SourceRow point={point} />}

        {activeTab === 'timeline' && <JudgementTimeline point={point} />}
      </div>
    </div>
  );
}
