import { useState } from 'react';
import {
  X,
  Building2,
  MapPin,
  Layers,
  Sun,
  Camera,
  Database,
  AlertTriangle,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  useSelectedBuilding,
  useSandboxStore,
  useUserMarker,
  useBuildings,
} from '../../store/useSandboxStore';
import {
  ANOMALY_LABELS,
  ANOMALY_COLORS,
  SUNLIGHT_STANDARD,
  type AnomalyType,
} from '../../data/types';
import { getBuildingStatus } from '../../utils/filter';
import { detectDuplicates, getBuildingById } from '../../data/mockBuildings';

export function SidePanel() {
  const selected = useSelectedBuilding();
  const setSelected = useSandboxStore(s => s.setSelectedBuilding);
  const toggleAnomaly = useSandboxStore(s => s.toggleBuildingAnomaly);
  const confirmBuilding = useSandboxStore(s => s.confirmBuilding);
  const [anomalyNote, setAnomalyNote] = useState('');
  const allBuildings = useBuildings();

  const marker = useUserMarker(selected?.id);

  if (!selected) {
    return (
      <div className="w-80 bg-[#0a1628] border-l border-[#1a2a4a] flex flex-col">
        <div className="p-4 border-b border-[#1a2a4a]">
          <h3 className="text-[#ffb347] font-medium flex items-center gap-2">
            <Building2 size={16} />
            建筑详情
          </h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-[#5a6a80] p-6">
          <Building2 size={48} className="mb-4 opacity-30" />
          <p className="text-sm text-center">
            点击沙盘上的建筑
            <br />
            查看详细信息
          </p>
        </div>
        <div className="p-4 border-t border-[#1a2a4a]">
          <div className="text-xs text-[#5a6a80] space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#4a90a0]" />
              <span>正常</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#ffb347]" />
              <span>低于标准 / 坐标偏移</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#ff6b6b]" />
              <span>跨楼层异常</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#ffd93d]" />
              <span>待确认 / 边界值</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#5a6a7a]" />
              <span>待测算 / 缺照片</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#9b59b6]" />
              <span>旧GIS口径</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const status = getBuildingStatus(selected);
  const duplicates = detectDuplicates(allBuildings);

  const relatedDuplicates: string[] = [];
  selected.deviceNames.forEach(name => {
    const normalized = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
    if (duplicates.has(normalized)) {
      duplicates.get(normalized)!.forEach(b => {
        if (b.id !== selected.id && !relatedDuplicates.includes(b.id)) {
          relatedDuplicates.push(b.id);
        }
      });
    }
  });

  const handleToggleAnomaly = () => {
    toggleAnomaly(selected.id, anomalyNote);
    setAnomalyNote('');
  };

  const handleConfirm = () => {
    confirmBuilding(selected.id);
  };

  return (
    <div className="w-80 bg-[#0a1628] border-l border-[#1a2a4a] flex flex-col overflow-hidden">
      <div className="p-4 border-b border-[#1a2a4a] flex items-center justify-between">
        <h3 className="text-[#ffb347] font-medium flex items-center gap-2">
          <Building2 size={16} />
          建筑详情
        </h3>
        <button
          onClick={() => setSelected(null)}
          className="p-1 text-[#5a6a80] hover:text-white transition-colors"
          data-testid="close-panel-btn"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div data-testid="building-header">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-white font-medium text-lg" data-testid="building-name">
              {selected.name}
            </h4>
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${status.color}20`, color: status.color }}
              data-testid="building-status"
            >
              {status.label}
            </span>
          </div>
          <div className="text-xs text-[#5a6a80] font-mono" data-testid="building-id">
            ID: {selected.id}
          </div>
        </div>

        <div className="space-y-2" data-testid="building-info">
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={14} className="text-[#4a90d9]" />
            <span className="text-[#8a9ab0] w-16">区域</span>
            <span className="text-white" data-testid="building-district">
              {selected.district}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Layers size={14} className="text-[#4a90d9]" />
            <span className="text-[#8a9ab0] w-16">楼层</span>
            <span className="text-white" data-testid="building-floors">
              {selected.floors} 层
            </span>
            {selected.crossFloors && (
              <span
                className="text-[#ff6b6b] text-xs flex items-center gap-1"
                data-testid="cross-floor-badge"
              >
                <AlertTriangle size={12} />
                跨楼层
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Sun size={14} className="text-[#ffd93d]" />
            <span className="text-[#8a9ab0] w-16">日照</span>
            {selected.sunlightHours !== null ? (
              <>
                <span
                  className="text-white font-mono"
                  data-testid="building-sunlight"
                >
                  {selected.sunlightHours.toFixed(1)} h
                </span>
                {selected.boundaryCase && (
                  <span
                    className="text-[#ffd93d] text-xs flex items-center gap-1"
                    data-testid="boundary-badge"
                  >
                    <AlertCircle size={12} />
                    边界值
                  </span>
                )}
                {selected.sunlightHours < SUNLIGHT_STANDARD && (
                  <span className="text-[#ffb347] text-xs" data-testid="below-standard">
                    &lt; {SUNLIGHT_STANDARD}h 标准
                  </span>
                )}
              </>
            ) : (
              <span
                className="text-[#95a5a6] flex items-center gap-1"
                data-testid="pending-sunlight"
              >
                <Clock size={12} />
                待测算
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Camera size={14} className="text-[#4a90d9]" />
            <span className="text-[#8a9ab0] w-16">照片</span>
            {selected.hasPhoto ? (
              <span className="text-[#2ecc71]" data-testid="photo-status">
                已上传
              </span>
            ) : (
              <span
                className="text-[#95a5a6] flex items-center gap-1"
                data-testid="photo-missing"
              >
                <XCircle size={12} />
                缺失
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Database size={14} className="text-[#4a90d9]" />
            <span className="text-[#8a9ab0] w-16">GIS口径</span>
            <span
              className={selected.gisSource === '2020' ? 'text-[#9b59b6]' : 'text-white'}
              data-testid="gis-source"
            >
              {selected.gisSource} 版
              {selected.gisSource === '2020' && (
                <span className="text-xs ml-1">旧口径</span>
              )}
            </span>
          </div>
        </div>

        {selected.coordinateOffset && (
          <div
            className="bg-[#1a140a] border border-[#5a4a2a] rounded p-3"
            data-testid="coordinate-offset"
          >
            <div className="flex items-center gap-2 text-[#ffb347] text-sm mb-1">
              <AlertTriangle size={14} />
              坐标偏移
            </div>
            <div className="text-xs text-[#c4d4e8] font-mono">
              偏移量: X: {selected.coordinateOffset[0]}m, Y:{' '}
              {selected.coordinateOffset[1]}m
            </div>
            <div className="text-xs text-[#8a9ab0] mt-1">
              建议关联 GIS 底图复核
            </div>
          </div>
        )}

        {selected.anomalies.length > 0 && (
          <div
            className="bg-[#0f1a1a] border border-[#2a5a5a] rounded p-3"
            data-testid="anomaly-tags"
          >
            <div className="flex items-center gap-2 text-[#c4d4e8] text-sm mb-2">
              <FileText size={14} />
              数据异常标记
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selected.anomalies.map(a => (
                <span
                  key={a}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: `${ANOMALY_COLORS[a as AnomalyType]}20`,
                    color: ANOMALY_COLORS[a as AnomalyType],
                  }}
                  data-testid={`anomaly-${a}`}
                >
                  {ANOMALY_LABELS[a as AnomalyType]}
                </span>
              ))}
            </div>
          </div>
        )}

        {selected.deviceNames.length > 0 && (
          <div data-testid="device-list">
            <div className="text-sm text-[#8a9ab0] mb-2">关联设备</div>
            <div className="space-y-1.5">
              {selected.deviceNames.map((name, i) => {
                const normalized = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
                const isDuplicate = duplicates.has(normalized);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded ${
                      isDuplicate
                        ? 'bg-[#1a1a0f] border border-[#5a5a2a]'
                        : 'bg-[#0f1f3a]'
                    }`}
                    data-testid={`device-${i}`}
                  >
                    <span className="text-white">{name}</span>
                    {isDuplicate && (
                      <span
                        className="text-[#ffd93d] text-xs flex items-center gap-1"
                        data-testid={`duplicate-${i}`}
                      >
                        <AlertCircle size={12} />
                        重名
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {relatedDuplicates.length > 0 && (
          <div
            className="bg-[#1a1a0f] border border-[#5a5a2a] rounded p-3"
            data-testid="related-buildings"
          >
            <div className="flex items-center gap-2 text-[#ffd93d] text-sm mb-2">
              <AlertCircle size={14} />
              重名设备关联建筑
            </div>
            <div className="space-y-1">
              {relatedDuplicates.map(id => {
                const b = getBuildingById(id);
                if (!b) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between text-sm cursor-pointer hover:bg-[#2a2a1f] px-2 py-1 rounded"
                    onClick={() => setSelected(id)}
                    data-testid={`related-${id}`}
                  >
                    <span className="text-[#c4d4e8]">{b.name}</span>
                    <ChevronRight size={14} className="text-[#5a6a80]" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-[#1a2a4a] pt-4" data-testid="user-marker-section">
          <div className="text-sm text-[#8a9ab0] mb-2">用户标记</div>
          {marker && (
            <div className="space-y-2 mb-3" data-testid="marker-display">
              {marker.isAnomaly && (
                <div
                  className="flex items-center gap-2 text-[#ff6b6b] text-sm"
                  data-testid="marker-anomaly"
                >
                  <AlertTriangle size={14} />
                  <span>已标记为异常</span>
                </div>
              )}
              {marker.anomalyNote && (
                <div
                  className="text-xs text-[#c4d4e8] bg-[#1a2a4a] p-2 rounded"
                  data-testid="marker-note"
                >
                  备注: {marker.anomalyNote}
                </div>
              )}
              {marker.confirmed && (
                <div
                  className="flex items-center gap-2 text-[#2ecc71] text-sm"
                  data-testid="marker-confirmed"
                >
                  <CheckCircle size={14} />
                  <span>已人工确认</span>
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <textarea
              value={anomalyNote}
              onChange={e => setAnomalyNote(e.target.value)}
              placeholder="输入异常备注..."
              className="w-full bg-[#0f1f3a] border border-[#2a3a5a] rounded p-2 text-sm text-[#c4d4e8] resize-none h-16 focus:border-[#ffb347] outline-none"
              data-testid="anomaly-note-input"
            />
            <div className="flex gap-2">
              <button
                onClick={handleToggleAnomaly}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  marker?.isAnomaly
                    ? 'bg-[#2a3a5a] text-[#8a9ab0] hover:bg-[#3a4a6a]'
                    : 'bg-[#ff6b6b] text-white hover:bg-[#ff8888]'
                }`}
                data-testid="toggle-anomaly-btn"
              >
                <AlertTriangle size={14} />
                {marker?.isAnomaly ? '取消异常' : '标记异常'}
              </button>
              {(selected.anomalies.includes('needs_confirmation') ||
                selected.boundaryCase) && (
                <button
                  onClick={handleConfirm}
                  disabled={marker?.confirmed}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    marker?.confirmed
                      ? 'bg-[#2a5a3a] text-[#2ecc71] cursor-not-allowed'
                      : 'bg-[#ffd93d] text-[#0a1628] hover:bg-[#ffe566]'
                  }`}
                  data-testid="confirm-btn"
                >
                  {marker?.confirmed ? (
                    <>
                      <CheckCircle size={14} />
                      已确认
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      人工确认
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
