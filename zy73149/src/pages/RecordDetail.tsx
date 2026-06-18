import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Database, AlertCircle, MessageSquare, ChevronRight } from 'lucide-react';
import { getRecordsByVersion, mockVersions } from '@/data/mockData';
import { SourceBadge, SedimentLevelBadge, AnomalyBadge } from '@/components/Badges';
import { formatLatLng, detectCoordinateFormat } from '@/utils/coordinate';
import { formatDepth, getSedimentLevelLabel } from '@/utils/sediment';
import { useReportStore } from '@/store/reportStore';
import { useMemo } from 'react';

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCurrentVersion } = useReportStore();
  const currentVersion = getCurrentVersion();

  const record = useMemo(() => {
    const allRecords: ReturnType<typeof getRecordsByVersion> = [];
    for (const v of mockVersions) {
      const recs = getRecordsByVersion(v.id);
      allRecords.push(...recs);
    }
    return allRecords.find((r) => r.id === id);
  }, [id]);

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <p className="text-gray-500">未找到该记录</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-ocean-600 hover:underline"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const detectedFormat = detectCoordinateFormat(record.rawLatitude);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-ocean-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-ocean-200 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            返回汇总
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <MapPin size={20} className="text-ocean-600" />
                  记录详情
                </h1>
                <p className="text-sm text-gray-500 mt-1 font-mono">
                  ID: {record.id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SourceBadge source={record.source} />
                <SedimentLevelBadge level={record.sedimentLevel} />
                {record.anomalyType !== 'none' && <AnomalyBadge type={record.anomalyType} />}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                基本信息
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex">
                  <span className="w-24 text-gray-500 text-right pr-4">采集时间:</span>
                  <span className="text-gray-800 font-mono">{record.timestamp}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-gray-500 text-right pr-4">数据来源:</span>
                  <span className="text-gray-800">{record.source === 'buoy' ? '浮标监测' : '遥感影像'}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-gray-500 text-right pr-4">淤积深度:</span>
                  <span className="text-gray-800 font-mono font-medium">
                    {formatDepth(record.sedimentDepth, currentVersion?.params.depthUnit)}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-24 text-gray-500 text-right pr-4">淤积等级:</span>
                  <span className="text-gray-800">{getSedimentLevelLabel(record.sedimentLevel)}</span>
                </div>
                {record.measuredDepth !== undefined && (
                  <div className="flex">
                    <span className="w-24 text-gray-500 text-right pr-4">实测水深:</span>
                    <span className="text-gray-800 font-mono">
                      {formatDepth(record.measuredDepth, currentVersion?.params.depthUnit)}
                    </span>
                  </div>
                )}
                {record.baselineDepth !== undefined && (
                  <div className="flex">
                    <span className="w-24 text-gray-500 text-right pr-4">基准水深:</span>
                    <span className="text-gray-800 font-mono">
                      {formatDepth(record.baselineDepth, currentVersion?.params.depthUnit)}
                    </span>
                  </div>
                )}
                {record.cloudCoverRate !== undefined && (
                  <div className="flex">
                    <span className="w-24 text-gray-500 text-right pr-4">云覆盖率:</span>
                    <span className={`font-mono ${record.cloudCoverRate > 0.5 ? 'text-warning-600' : 'text-gray-800'}`}>
                      {(record.cloudCoverRate * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Database size={16} className="text-gray-400" />
                经纬度清洗对比
              </h3>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  <div className="bg-white border border-gray-200 rounded p-4">
                    <p className="text-xs text-gray-500 mb-2">原始数据</p>
                    <p className="text-sm font-mono text-gray-700 break-all">
                      {record.rawLatitude}
                    </p>
                    <p className="text-sm font-mono text-gray-700 break-all mt-1">
                      {record.rawLongitude}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      检测格式: {detectedFormat === 'dms' ? '度分秒' : detectedFormat === 'dm' ? '度分' : '十进制度'}
                    </p>
                  </div>

                  <div className="flex flex-col items-center text-ocean-500">
                    <ChevronRight size={24} />
                    <span className="text-xs mt-1">清洗</span>
                  </div>

                  <div className="bg-ocean-50 border border-ocean-200 rounded p-4">
                    <p className="text-xs text-ocean-600 mb-2">标准化后</p>
                    <p className="text-sm font-mono text-ocean-800 font-medium">
                      {record.latitude.toFixed(6)}°
                    </p>
                    <p className="text-sm font-mono text-ocean-800 font-medium mt-1">
                      {record.longitude.toFixed(6)}°
                    </p>
                    <p className="text-xs text-ocean-500 mt-2">
                      格式: 十进制度 (Decimal)
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">当前输出格式预览</p>
                  <p className="text-sm font-mono text-gray-700">
                    {formatLatLng(record.latitude, record.longitude, currentVersion?.params.coordinateFormat || 'decimal')}
                  </p>
                </div>
              </div>
            </div>

            {record.anomalyType !== 'none' && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-warning-500" />
                  异常信息
                </h3>
                <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AnomalyBadge type={record.anomalyType} />
                    <span className="text-sm text-warning-800">
                      {record.anomalyDetail || '该记录存在数据异常，建议谨慎使用'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <MessageSquare size={16} className="text-gray-400" />
                备注说明
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                {record.remark ? (
                  <p className="text-sm text-gray-700">{record.remark}</p>
                ) : (
                  <p className="text-sm text-gray-400">暂无备注</p>
                )}
              </div>
              <div className="mt-3 text-xs text-gray-400">
                所属版本: {mockVersions.find((v) => v.id === record.versionId)?.name || '-'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
