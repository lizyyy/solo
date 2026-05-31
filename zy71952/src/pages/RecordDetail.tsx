import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useRecordStore } from '../store/useRecordStore';
import { StatusBadge } from '../components/record/StatusBadge';
import { ChangeLogTable } from '../components/record/ChangeLogTable';
import { AnomalyCard } from '../components/record/AnomalyCard';
import { severityConfig, cn } from '../utils/status';
import { Cloud, User, Camera, MapPin, Clock } from 'lucide-react';

export function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { records } = useRecordStore();
  const record = records.find(r => r.id === id);

  if (!record) {
    return (
      <div className="p-8">
        <p className="text-mono-500">未找到该记录</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-primary-600 hover:underline"
        >
          返回总览
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b border-mono-200 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-mono-500 hover:text-mono-700 transition-colors"
          >
            <ArrowLeft size={16} />
            返回总览
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <h1 className="font-mono font-bold text-xl text-mono-800">{record.flightNo}</h1>
            <StatusBadge status={record.status} />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        <div>
          <h2 className="text-sm font-bold text-mono-800 mb-4 uppercase tracking-wide">飞行基本信息</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="border border-mono-200 p-4">
              <div className="flex items-center gap-2 text-xs text-mono-500 mb-2">
                <MapPin size={12} />
                作业区域
              </div>
              <p className="text-base font-medium text-mono-800">{record.location}</p>
            </div>
            <div className="border border-mono-200 p-4">
              <div className="flex items-center gap-2 text-xs text-mono-500 mb-2">
                <Clock size={12} />
                飞行日期
              </div>
              <p className="text-base font-medium text-mono-800 font-mono">{record.flightDate}</p>
            </div>
            <div className="border border-mono-200 p-4">
              <div className="text-xs text-mono-500 mb-2">返航点状态</div>
              <p className={cn(
                'text-base font-medium',
                record.hasReturnPoint ? 'text-farm-600' : 'text-status-modified'
              )}>
                {record.hasReturnPoint ? '● 正常' : '● 丢失'}
              </p>
            </div>
            <div className="border border-mono-200 p-4">
              <div className="text-xs text-mono-500 mb-2">飞手</div>
              <p className="text-base font-medium text-mono-800">{record.pilotNote.pilotName}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-mono-800 mb-4 uppercase tracking-wide">
            <Cloud size={14} className="inline mr-1.5" />
            气象数据
          </h2>
          <div className="border border-mono-200 p-6">
            <div className="flex gap-6 items-start">
              <img
                src={record.weatherData.screenshotUrl}
                alt="气象截图"
                className="w-40 h-40 object-cover border-2 border-mono-200"
              />
              <div className="flex-1">
                <div className="grid grid-cols-4 gap-6 mb-4">
                  <div>
                    <p className="text-xs text-mono-500 mb-1">温度</p>
                    <p className="font-mono text-2xl font-bold text-mono-800">{record.weatherData.temperature}°C</p>
                  </div>
                  <div>
                    <p className="text-xs text-mono-500 mb-1">湿度</p>
                    <p className="font-mono text-2xl font-bold text-mono-800">{record.weatherData.humidity}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-mono-500 mb-1">风速</p>
                    <p className="font-mono text-2xl font-bold text-mono-800">{record.weatherData.windSpeed}m/s</p>
                  </div>
                  <div>
                    <p className="text-xs text-mono-500 mb-1">降水</p>
                    <p className="font-mono text-2xl font-bold text-mono-800">{record.weatherData.rainfall}mm</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-mono-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-mono-500">上传时间：</span>
                    <span className="text-sm font-mono text-mono-700">{record.weatherData.uploadTime}</span>
                  </div>
                  {record.weatherData.isSupplement && (
                    <span className="text-status-pending text-sm font-medium px-2 py-1 bg-amber-50 border border-status-pending">
                      ● 气象补录
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-mono-800 mb-4 uppercase tracking-wide">
            <User size={14} className="inline mr-1.5" />
            飞手备注
          </h2>
          <div className={cn(
            'border-2 p-6',
            record.pilotNote.isSupplement ? 'border-status-pending bg-amber-50/30' : 'border-mono-200'
          )}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="text-base font-medium text-mono-800">{record.pilotNote.pilotName}</span>
                <span className="text-sm text-mono-400 ml-3 font-mono">{record.pilotNote.noteTime}</span>
              </div>
              {record.pilotNote.isSupplement && (
                <span className="text-status-pending text-sm font-medium px-3 py-1 border border-status-pending bg-white">
                  补录 · 延迟{record.pilotNote.delayHours}小时
                </span>
              )}
            </div>
            <div className="mb-4 text-sm text-mono-500">
              飞行时段：<span className="font-mono text-mono-700">{record.pilotNote.flightStartTime} ~ {record.pilotNote.flightEndTime}</span>
            </div>
            <p className="text-base text-mono-700 leading-relaxed">{record.pilotNote.content}</p>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-mono-800 mb-4 uppercase tracking-wide">
            <Camera size={14} className="inline mr-1.5" />
            巡检照片
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {record.photos.map((photo) => (
              <div
                key={photo.id}
                className={cn(
                  'border-2 overflow-hidden',
                  photo.isManuallyModified ? 'border-status-modified' : 'border-mono-200'
                )}
              >
                <img
                  src={photo.photoUrl}
                  alt="巡检照片"
                  className="w-full h-48 object-cover"
                />
                <div className="p-3">
                  <p className="text-xs text-mono-400 font-mono mb-2">{photo.locationTag}</p>
                  {photo.pestType && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-mono-700 font-medium">{photo.pestType}</span>
                      {photo.severity && (
                        <span className={cn('text-xs font-medium px-1.5 py-0.5', 
                          severityConfig[photo.severity].color,
                          photo.severity === 'low' ? 'bg-farm-50' : 
                          photo.severity === 'medium' ? 'bg-amber-50' : 'bg-red-50'
                        )}>
                          {severityConfig[photo.severity].label}度
                        </span>
                      )}
                    </div>
                  )}
                  {photo.isManuallyModified && (
                    <div className="mt-3 pt-3 border-t border-mono-100">
                      <p className="text-xs text-status-modified font-medium mb-1">● 手工改动</p>
                      {photo.modifyReason && (
                        <p className="text-xs text-mono-600">{photo.modifyReason}</p>
                      )}
                      {photo.modifiedBy && photo.modifiedTime && (
                        <p className="text-xs text-mono-400 mt-1">
                          修改人：{photo.modifiedBy} · {photo.modifiedTime}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {record.anomalies.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-mono-800 mb-4 uppercase tracking-wide">异常解释与处理口径</h2>
            <div className="space-y-4">
              {record.anomalies.map((anomaly) => (
                <AnomalyCard key={anomaly.id} anomaly={anomaly} />
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-bold text-mono-800 mb-4 uppercase tracking-wide">状态回看 · 完整变更日志</h2>
          <ChangeLogTable logs={record.changeLogs} />
        </div>
      </div>
    </div>
  );
}
