import { useState } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  MapPin,
  Activity,
  Image,
  History,
  ChevronDown,
  ChevronUp,
  Ruler,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

export function DetailPanel() {
  const selectedObject = useAppStore((state) => state.selectedObject);
  const selectObject = useAppStore((state) => state.selectObject);
  const cracks = useAppStore((state) => state.cracks);
  const sensors = useAppStore((state) => state.sensors);
  const stressPoints = useAppStore((state) => state.stressPoints);
  const confirmObjectManually = useAppStore((state) => state.confirmObjectManually);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirmOperator, setConfirmOperator] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    history: true,
    photos: true,
    timeseries: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getSelectedData = () => {
    if (!selectedObject) return null;

    switch (selectedObject.type) {
      case 'crack':
        return cracks.find((c) => c.id === selectedObject.id);
      case 'sensor':
        return sensors.find((s) => s.id === selectedObject.id);
      case 'stress':
        return stressPoints.find((p) => p.id === selectedObject.id);
      default:
        return null;
    }
  };

  const data = getSelectedData();

  const handleManualConfirm = () => {
    if (selectedObject && confirmOperator && confirmNotes) {
      confirmObjectManually(
        selectedObject.type as 'crack' | 'sensor',
        selectedObject.id,
        confirmOperator,
        confirmNotes
      );
      setShowConfirmDialog(false);
      setConfirmNotes('');
      setConfirmOperator('');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-500/20';
      case 'warning':
        return 'text-orange-400 bg-orange-500/20';
      case 'normal':
        return 'text-green-400 bg-green-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '危急';
      case 'warning':
        return '预警';
      case 'normal':
        return '正常';
      default:
        return '未知';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'alarm':
        return 'text-red-400 bg-red-500/20';
      case 'warning':
        return 'text-orange-400 bg-orange-500/20';
      case 'normal':
        return 'text-green-400 bg-green-500/20';
      case 'offline':
        return 'text-gray-400 bg-gray-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'alarm':
        return '告警';
      case 'warning':
        return '预警';
      case 'normal':
        return '正常';
      case 'offline':
        return '离线';
      case 'active':
        return '活跃';
      case 'monitored':
        return '监测中';
      case 'repaired':
        return '已修复';
      default:
        return '未知';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (!selectedObject || !data) {
    return (
      <div className="w-80 bg-slate-900 border-l border-slate-700 h-full flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Activity size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">点击3D模型中的对象</p>
          <p className="text-sm">查看详细信息</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-700 h-full flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">
            {selectedObject.type === 'crack' && '裂缝详情'}
            {selectedObject.type === 'sensor' && '传感器详情'}
            {selectedObject.type === 'stress' && '应力点详情'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">{data.id}</p>
        </div>
        <button
          onClick={() => selectObject(null)}
          className="p-1.5 hover:bg-slate-700 rounded transition-colors"
        >
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('basic')}
            className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
          >
            <span className="text-sm font-medium">基本信息</span>
            {expandedSections.basic ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedSections.basic && (
            <div className="px-3 pb-3 space-y-3">
              <div>
                <label className="text-xs text-slate-400">名称</label>
                <p className="text-sm text-white mt-1">
                  {'name' in data ? data.name : data.id}
                </p>
              </div>

              {'severity' in data && (
                <div>
                  <label className="text-xs text-slate-400">严重程度</label>
                  <div className="mt-1">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                        getSeverityColor(data.severity)
                      )}
                    >
                      {getSeverityLabel(data.severity)}
                    </span>
                  </div>
                </div>
              )}

              {'status' in data && (
                <div>
                  <label className="text-xs text-slate-400">状态</label>
                  <div className="mt-1">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                        getStatusColor(data.status)
                      )}
                    >
                      {getStatusLabel(data.status)}
                    </span>
                  </div>
                </div>
              )}

              {'position' in data && (
                <div>
                  <label className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin size={12} />
                    坐标位置
                  </label>
                  <p className="text-sm text-white mt-1 font-mono">
                    [{data.position.map((v) => v.toFixed(2)).join(', ')}]
                  </p>
                </div>
              )}

              {'length' in data && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 flex items-center gap-1">
                      <Ruler size={12} />
                      长度
                    </label>
                    <p className="text-sm text-white mt-1">{data.length}m</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">宽度</label>
                    <p className="text-sm text-white mt-1">{data.width}mm</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">深度</label>
                    <p className="text-sm text-white mt-1">{data.depth}m</p>
                  </div>
                </div>
              )}

              {'currentValue' in data && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400">当前值</label>
                    <p className="text-lg text-white font-mono mt-1">
                      {data.currentValue.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">{data.unit}</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">阈值</label>
                    <p className="text-lg text-slate-400 font-mono mt-1">
                      {data.threshold.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">{data.unit}</p>
                  </div>
                </div>
              )}

              {'stressValue' in data && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400">应力值</label>
                    <p className="text-lg text-white font-mono mt-1">
                      {data.stressValue.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">MPa</p>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">应变值</label>
                    <p className="text-sm text-slate-400 font-mono mt-1">
                      {data.strainValue.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock size={12} />
                  更新时间
                </label>
                <p className="text-sm text-white mt-1">
                  {formatDate(
                    'updatedAt' in data
                      ? data.updatedAt
                      : 'lastReading' in data
                      ? data.lastReading
                      : data.measuredAt
                  )}
                </p>
              </div>

              {'hasBoundaryIssue' in data && data.hasBoundaryIssue && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <AlertTriangle size={14} />
                    <span>存在边界问题</span>
                  </div>
                  <p className="text-xs text-yellow-300/70 mt-1">
                    {data.boundaryType === 'coordinate_offset' && '坐标系统偏移'}
                    {data.boundaryType === 'duplicate' && '重复记录'}
                    {data.boundaryType === 'incomplete_data' && '数据不完整'}
                  </p>
                  {!data.manualConfirmed && (
                    <button
                      onClick={() => setShowConfirmDialog(true)}
                      className="mt-2 w-full px-3 py-1.5 bg-yellow-500 text-black text-xs font-medium rounded hover:bg-yellow-400 transition-colors"
                    >
                      人工确认处理
                    </button>
                  )}
                </div>
              )}

              {'hasBreakpoint' in data && data.hasBreakpoint && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <AlertTriangle size={14} />
                    <span>存在数据断点</span>
                  </div>
                  {data.breakpointRecords?.map((bp, i) => (
                    <p key={i} className="text-xs text-yellow-300/70 mt-1">
                      {bp.reason}
                    </p>
                  ))}
                  {!data.manualConfirmed && (
                    <button
                      onClick={() => setShowConfirmDialog(true)}
                      className="mt-2 w-full px-3 py-1.5 bg-yellow-500 text-black text-xs font-medium rounded hover:bg-yellow-400 transition-colors"
                    >
                      人工确认处理
                    </button>
                  )}
                </div>
              )}

              {'manualConfirmed' in data && data.manualConfirmed && (
                <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle size={14} />
                    <span>已人工确认</span>
                  </div>
                  <p className="text-xs text-green-300/70 mt-1">
                    <User size={10} className="inline mr-1" />
                    {data.manualConfirmed.operator}
                  </p>
                  <p className="text-xs text-green-300/70">
                    {formatDate(data.manualConfirmed.timestamp)}
                  </p>
                  <p className="text-xs text-green-300/70 mt-1">
                    {data.manualConfirmed.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {'historyRecords' in data && data.historyRecords && data.historyRecords.length > 0 && (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('history')}
              className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <History size={16} className="text-slate-400" />
                <span className="text-sm font-medium">历史记录</span>
              </div>
              {expandedSections.history ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.history && (
              <div className="px-3 pb-3 space-y-2">
                {data.historyRecords.map((record) => (
                  <div
                    key={record.id}
                    className="bg-slate-700/50 rounded p-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium">
                        {record.changeType === 'coordinate_correction' && '坐标修正'}
                        {record.changeType === 'duplicate_merge' && '重复合并'}
                        {record.changeType === 'status_update' && '状态更新'}
                        {record.changeType === 'manual_confirm' && '人工确认'}
                      </span>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-xs',
                          record.manualConfirmed
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        )}
                      >
                        {record.manualConfirmed ? '已确认' : '待确认'}
                      </span>
                    </div>
                    <p className="text-slate-400 mt-1">
                      {record.beforeValue} → {record.afterValue}
                    </p>
                    <p className="text-slate-500 mt-1">
                      {record.operator} · {formatDate(record.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {'photos' in data && data.photos && data.photos.length > 0 && (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('photos')}
              className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Image size={16} className="text-slate-400" />
                <span className="text-sm font-medium">巡检照片</span>
                <span className="text-xs text-slate-500">({data.photos.length})</span>
              </div>
              {expandedSections.photos ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.photos && (
              <div className="px-3 pb-3">
                <div className="grid grid-cols-2 gap-2">
                  {data.photos.map((photo, i) => (
                    <div
                      key={i}
                      className="aspect-square bg-slate-700 rounded overflow-hidden"
                    >
                      <img
                        src={photo}
                        alt={`巡检照片 ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {'timeSeriesData' in data && data.timeSeriesData && (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('timeseries')}
              className="w-full flex items-center justify-between p-3 text-white hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-slate-400" />
                <span className="text-sm font-medium">时序数据</span>
              </div>
              {expandedSections.timeseries ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expandedSections.timeseries && (
              <div className="px-3 pb-3">
                <div className="h-24 bg-slate-700/50 rounded p-2 flex items-end gap-0.5">
                  {data.timeSeriesData.slice(-20).map((point, i) => {
                    const maxVal = Math.max(...data.timeSeriesData.map((d) => d.value));
                    const height = (point.value / maxVal) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-blue-500/60 rounded-t transition-all hover:bg-blue-400"
                        style={{ height: `${Math.max(height, 5)}%` }}
                        title={`${formatDate(point.timestamp)}: ${point.value.toFixed(3)}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>20天前</span>
                  <span>最新</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showConfirmDialog && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-4 w-72 shadow-xl">
            <h4 className="text-white font-medium mb-3">人工确认处理</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">操作人</label>
                <input
                  type="text"
                  value={confirmOperator}
                  onChange={(e) => setConfirmOperator(e.target.value)}
                  placeholder="输入姓名"
                  className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">处理说明</label>
                <textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="描述处理方式..."
                  rows={3}
                  className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleManualConfirm}
                  disabled={!confirmOperator || !confirmNotes}
                  className="flex-1 px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
