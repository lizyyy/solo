import { useNavigate } from 'react-router-dom';
import { useRecordStore } from '../store/useRecordStore';
import { Timeline } from '../components/timeline/Timeline';
import { StatusBadge } from '../components/record/StatusBadge';
import { ChangeLogTable } from '../components/record/ChangeLogTable';
import { AnomalyCard } from '../components/record/AnomalyCard';
import { severityConfig, cn } from '../utils/status';
import { Cloud, User, Camera, MapPin, Clock, ChevronRight } from 'lucide-react';
import type { RecordStatus } from '../types';

const filterOptions: { type: 'all' | RecordStatus; label: string }[] = [
  { type: 'all', label: '全部' },
  { type: 'confirmed', label: '已确认' },
  { type: 'pending', label: '待补' },
  { type: 'modified', label: '人工改过' },
];

export function Overview() {
  const navigate = useNavigate();
  const {
    getSelectedRecord,
    getStatusCounts,
    statusFilter,
    setStatusFilter,
  } = useRecordStore();
  const record = getSelectedRecord();
  const counts = getStatusCounts();

  const handleViewDetail = () => {
    if (record) {
      navigate(`/record/${record.id}`);
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <div className="w-[360px] border-r border-mono-200 flex flex-col">
        <div className="p-4 border-b border-mono-200">
          <h2 className="font-bold text-mono-800 mb-3">飞行记录筛选</h2>
          <div className="flex gap-2 flex-wrap">
            {filterOptions.map((opt) => {
              const count = opt.type === 'all' 
                ? counts.confirmed + counts.pending + counts.modified
                : counts[opt.type];
              const isActive = statusFilter === opt.type;
              return (
                <button
                  key={opt.type}
                  onClick={() => setStatusFilter(opt.type)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium transition-colors',
                    isActive
                      ? opt.type === 'all'
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : opt.type === 'confirmed'
                        ? 'bg-status-confirmed border-status-confirmed text-white'
                        : opt.type === 'pending'
                        ? 'bg-status-pending border-status-pending text-white'
                        : 'bg-status-modified border-status-modified text-white'
                      : 'bg-white border-mono-300 text-mono-600 hover:border-mono-400'
                  )}
                >
                  {opt.label}
                  <span className={cn(
                    'px-1.5 py-0.5 text-[10px]',
                    isActive ? 'bg-white/20' : 'bg-mono-100'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-medium text-mono-500 mb-3 uppercase tracking-wide">
            飞行架次时间轴
          </h3>
          <Timeline />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {record ? (
          <>
            <div className="p-4 border-b border-mono-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="font-mono font-bold text-lg text-mono-800">
                    {record.flightNo}
                  </h2>
                  <p className="text-sm text-mono-500">{record.location}</p>
                </div>
                <StatusBadge status={record.status} />
              </div>
              <button
                onClick={handleViewDetail}
                className="flex items-center gap-1 px-3 py-1.5 border border-primary-500 bg-primary-50 text-primary-600 text-sm font-medium hover:bg-primary-100 transition-colors"
              >
                查看完整详情
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-mono-800 mb-3">飞行基本信息</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-mono-200 p-3">
                    <div className="flex items-center gap-2 text-xs text-mono-500 mb-1">
                      <MapPin size={12} />
                      作业区域
                    </div>
                    <p className="text-sm font-medium text-mono-800">{record.location}</p>
                  </div>
                  <div className="border border-mono-200 p-3">
                    <div className="flex items-center gap-2 text-xs text-mono-500 mb-1">
                      <Clock size={12} />
                      飞行时段
                    </div>
                    <p className="text-sm font-medium text-mono-800 font-mono">
                      {record.pilotNote.flightStartTime} ~ {record.pilotNote.flightEndTime}
                    </p>
                  </div>
                  <div className="border border-mono-200 p-3">
                    <div className="text-xs text-mono-500 mb-1">返航点状态</div>
                    <p className={cn(
                      'text-sm font-medium',
                      record.hasReturnPoint ? 'text-farm-600' : 'text-status-modified'
                    )}>
                      {record.hasReturnPoint ? '● 正常' : '● 丢失'}
                    </p>
                  </div>
                  <div className="border border-mono-200 p-3">
                    <div className="text-xs text-mono-500 mb-1">飞手</div>
                    <p className="text-sm font-medium text-mono-800">{record.pilotNote.pilotName}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-mono-800 mb-3">
                  <Cloud size={14} className="inline mr-1.5" />
                  气象数据
                </h3>
                <div className="border border-mono-200 p-4">
                  <div className="flex gap-4 items-start">
                    <img
                      src={record.weatherData.screenshotUrl}
                      alt="气象截图"
                      className="w-24 h-24 object-cover border border-mono-200"
                    />
                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-mono-500">温度</p>
                        <p className="font-mono text-lg font-bold text-mono-800">{record.weatherData.temperature}°C</p>
                      </div>
                      <div>
                        <p className="text-xs text-mono-500">湿度</p>
                        <p className="font-mono text-lg font-bold text-mono-800">{record.weatherData.humidity}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-mono-500">风速</p>
                        <p className="font-mono text-lg font-bold text-mono-800">{record.weatherData.windSpeed}m/s</p>
                      </div>
                      <div>
                        <p className="text-xs text-mono-500">降水</p>
                        <p className="font-mono text-lg font-bold text-mono-800">{record.weatherData.rainfall}mm</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-mono-100 flex items-center justify-between text-xs">
                    <span className="text-mono-500">上传时间：{record.weatherData.uploadTime}</span>
                    {record.weatherData.isSupplement && (
                      <span className="text-status-pending font-medium">● 气象补录</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-mono-800 mb-3">
                  <User size={14} className="inline mr-1.5" />
                  飞手备注
                </h3>
                <div className={cn(
                  'border p-4',
                  record.pilotNote.isSupplement ? 'border-status-pending bg-amber-50/30' : 'border-mono-200'
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-mono-800">{record.pilotNote.pilotName}</span>
                      <span className="text-xs text-mono-400 ml-2">{record.pilotNote.noteTime}</span>
                    </div>
                    {record.pilotNote.isSupplement && (
                      <span className="text-status-pending text-xs font-medium">
                        补录 · 延迟{record.pilotNote.delayHours}小时
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-mono-700 leading-relaxed">{record.pilotNote.content}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-mono-800 mb-3">
                  <Camera size={14} className="inline mr-1.5" />
                  巡检照片
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {record.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className={cn(
                        'border overflow-hidden',
                        photo.isManuallyModified ? 'border-status-modified' : 'border-mono-200'
                      )}
                    >
                      <img
                        src={photo.photoUrl}
                        alt="巡检照片"
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-2">
                        <p className="text-[10px] text-mono-400 font-mono">{photo.locationTag}</p>
                        {photo.pestType && (
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-mono-700">{photo.pestType}</span>
                            {photo.severity && (
                              <span className={cn('text-[10px] font-medium', severityConfig[photo.severity].color)}>
                                ({severityConfig[photo.severity].label})
                              </span>
                            )}
                          </div>
                        )}
                        {photo.isManuallyModified && (
                          <p className="text-[10px] text-status-modified mt-1">
                            ● 手工改动
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {record.anomalies.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-mono-800 mb-3">异常解释</h3>
                  <div className="space-y-3">
                    {record.anomalies.map((anomaly) => (
                      <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-mono-800 mb-3">状态回看 · 变更日志</h3>
                <ChangeLogTable logs={record.changeLogs} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-mono-400">
            请从左侧选择一条飞行记录
          </div>
        )}
      </div>
    </div>
  );
}
