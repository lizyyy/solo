import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { STATUS_COLORS, STATUS_LABELS, CONFLICT_TYPE_LABELS } from '@/types';
import { Check, X, AlertTriangle, ChevronDown, ChevronRight, Camera, MapPin } from 'lucide-react';

export function DeviceTable() {
  const { devices, conflicts, decisions, addDecision, params, selectedDeviceId, setSelectedDevice } = useAppStore((state) => ({
    devices: state.devices,
    conflicts: state.conflicts,
    decisions: state.decisions,
    addDecision: state.addDecision,
    params: state.params,
    selectedDeviceId: state.view.selectedDeviceId,
    setSelectedDevice: state.setSelectedDevice,
  }));

  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedDevices);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedDevices(newExpanded);
  };

  const filteredDevices = filterStatus === 'all' 
    ? devices 
    : devices.filter(d => d.status === filterStatus);

  const getDeviceConflicts = (deviceId: string) => {
    return conflicts.filter(c => c.deviceIds.includes(deviceId));
  };

  const getDeviceDecisions = (deviceId: string) => {
    return decisions.filter(d => d.deviceId === deviceId);
  };

  const handleDecision = (deviceId: string, type: 'accept' | 'reject' | 'manual_check', reason: string) => {
    addDecision({
      deviceId,
      type,
      reason,
      operator: '阿乔',
      paramsSnapshot: params,
    });
  };

  const statusCounts = {
    all: devices.length,
    normal: devices.filter(d => d.status === 'normal').length,
    warning: devices.filter(d => d.status === 'warning').length,
    error: devices.filter(d => d.status === 'error').length,
    pending: devices.filter(d => d.status === 'pending').length,
  };

  return (
    <div className="h-full bg-bg-secondary border-l border-border-subtle flex flex-col">
      <div className="p-4 border-b border-border-subtle">
        <h2 className="font-semibold text-text-primary mb-3">设备明细</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'normal', label: '正常' },
            { key: 'warning', label: '待确认' },
            { key: 'error', label: '异常' },
            { key: 'pending', label: '未处理' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterStatus === key
                  ? 'bg-accent-blue text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-border-subtle'
              }`}
            >
              {label} ({statusCounts[key as keyof typeof statusCounts]})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredDevices.map((device) => {
          const isExpanded = expandedDevices.has(device.id);
          const isSelected = selectedDeviceId === device.id;
          const deviceConflicts = getDeviceConflicts(device.id);
          const deviceDecisions = getDeviceDecisions(device.id);

          return (
            <div
              key={device.id}
              className={`border-b border-border-subtle cursor-pointer transition-colors ${
                isSelected ? 'bg-accent-blue/10' : 'hover:bg-bg-tertiary/50'
              }`}
              onClick={() => setSelectedDevice(device.id)}
            >
              <div className="p-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleExpand(device.id); }}
                    className="mt-1 text-text-muted hover:text-text-primary"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[device.status] }}
                      />
                      <span className="font-medium text-text-primary truncate">
                        {device.name}
                      </span>
                      {!device.hasPhoto && (
                        <Camera className="w-3 h-3 text-accent-red flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {device.floor}
                      </span>
                      <span className="font-mono">({device.x}, {device.y})</span>
                      <span className="px-1.5 py-0.5 bg-bg-tertiary rounded">
                        {device.type === 'camera' ? '摄像头' : device.type === 'sensor' ? '传感器' : '指示灯'}
                      </span>
                      {device.score !== undefined && (
                        <span className="font-mono">{device.score}分</span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-1 text-xs rounded flex-shrink-0 ${
                      device.status === 'normal'
                        ? 'bg-accent-green/20 text-accent-green'
                        : device.status === 'warning'
                        ? 'bg-accent-yellow/20 text-accent-yellow'
                        : device.status === 'error'
                        ? 'bg-accent-red/20 text-accent-red'
                        : 'bg-text-muted/20 text-text-muted'
                    }`}
                  >
                    {STATUS_LABELS[device.status]}
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-3 pl-7 space-y-3">
                    {device.reasons && device.reasons.length > 0 && (
                      <div className="p-3 bg-bg-tertiary rounded">
                        <div className="text-xs font-medium text-text-secondary mb-2">检测结果</div>
                        <ul className="space-y-1">
                          {device.reasons.map((reason, i) => (
                            <li key={i} className="text-xs text-text-primary flex items-start gap-2">
                              <span className="text-accent-blue">•</span>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {deviceConflicts.length > 0 && (
                      <div className="p-3 bg-bg-tertiary rounded">
                        <div className="text-xs font-medium text-text-secondary mb-2">
                          关联冲突 ({deviceConflicts.length})
                        </div>
                        <div className="space-y-2">
                          {deviceConflicts.map((conflict) => (
                            <div
                              key={conflict.id}
                              className={`p-2 rounded border ${
                                conflict.resolved
                                  ? 'border-accent-green/30 bg-accent-green/5'
                                  : 'border-accent-yellow/30 bg-accent-yellow/5'
                              }`}
                            >
                              <div className="flex items-center gap-2 text-xs">
                                <AlertTriangle className={`w-3 h-3 ${conflict.resolved ? 'text-accent-green' : 'text-accent-yellow'}`} />
                                <span className="font-medium text-text-primary">
                                  {CONFLICT_TYPE_LABELS[conflict.type]}
                                </span>
                                <span className="text-text-muted">
                                  {conflict.resolved ? '已解决' : '待处理'}
                                </span>
                              </div>
                              <p className="text-xs text-text-muted mt-1">{conflict.suggestion}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {deviceDecisions.length > 0 && (
                      <div className="p-3 bg-bg-tertiary rounded">
                        <div className="text-xs font-medium text-text-secondary mb-2">
                          判定记录 ({deviceDecisions.length})
                        </div>
                        <div className="space-y-2">
                          {deviceDecisions.map((decision) => (
                            <div key={decision.id} className="text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-text-muted">
                                  {new Date(decision.timestamp).toLocaleString('zh-CN')}
                                </span>
                                <span className="font-medium text-text-primary">{decision.operator}</span>
                                <span className={`px-1.5 py-0.5 rounded ${
                                  decision.type === 'accept'
                                    ? 'bg-accent-green/20 text-accent-green'
                                    : decision.type === 'reject'
                                    ? 'bg-accent-red/20 text-accent-red'
                                    : 'bg-accent-yellow/20 text-accent-yellow'
                                }`}>
                                  {decision.type === 'accept' ? '通过' : decision.type === 'reject' ? '驳回' : '人工确认'}
                                </span>
                              </div>
                              <p className="text-text-muted mt-1">{decision.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDecision(device.id, 'accept', '数据核对无误')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-accent-green/20 text-accent-green hover:bg-accent-green/30 rounded text-xs transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        通过
                      </button>
                      <button
                        onClick={() => handleDecision(device.id, 'manual_check', '需进一步确认')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-accent-yellow/20 text-accent-yellow hover:bg-accent-yellow/30 rounded text-xs transition-colors"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        待确认
                      </button>
                      <button
                        onClick={() => handleDecision(device.id, 'reject', '数据存在问题')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-accent-red/20 text-accent-red hover:bg-accent-red/30 rounded text-xs transition-colors"
                      >
                        <X className="w-3 h-3" />
                        驳回
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
