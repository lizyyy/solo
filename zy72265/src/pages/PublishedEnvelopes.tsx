import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnvelopeStore } from '@/store/envelopeStore';
import { FileText, MapPin, Calendar, Eye, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { StatusBadge, CoordinateTypeBadge, RadiusSourceBadge } from '@/components/StatusBadge';
import { formatDate, formatCoordinate } from '../../shared/utils/formatters';
import type { CoordinatePoint } from '../../shared/types';

export default function PublishedEnvelopes() {
  const { envelopes, fetchEnvelopes, fetchEnvelopeDetail, currentEnvelope, currentPoints, exportEnvelope, loading, error } = useEnvelopeStore();
  const navigate = useNavigate();
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string | null>(null);

  useEffect(() => {
    fetchEnvelopes('PUBLISHED');
  }, [fetchEnvelopes]);

  useEffect(() => {
    if (selectedEnvelopeId) {
      fetchEnvelopeDetail(selectedEnvelopeId);
    }
  }, [selectedEnvelopeId, fetchEnvelopeDetail]);

  const publishedEnvelopes = envelopes.filter(e => e.status === 'PUBLISHED');

  if (loading && !selectedEnvelopeId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-8 h-8 text-emerald-600" />
            已发布安全包络说明
          </h1>
          <p className="text-slate-500 mt-1">
            现场班组请看这里，所有数据都是巡检组复核过的，放心用
          </p>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-emerald-800">现场班组注意</h3>
            <p className="text-emerald-700 text-sm mt-1">
              本页面展示的所有安全包络都已经过许工复核和巡检组确认，可以直接用于现场作业。
              如有疑问，不要自己猜，找巡检组问清楚。
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-slate-700">已发布列表</h2>
          {publishedEnvelopes.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无已发布的安全包络</p>
            </div>
          ) : (
            <div className="space-y-3">
              {publishedEnvelopes.map((env) => (
                <div
                  key={env.id}
                  onClick={() => setSelectedEnvelopeId(env.id)}
                  className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    selectedEnvelopeId === env.id
                      ? 'border-emerald-400 shadow-md'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-800">{env.robotArmId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(env.calculationDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          共 {env.totalPoints} 点
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          半径表 {env.safetyRadiusVersion}
                        </span>
                        <StatusBadge status={env.status} />
                      </div>
                    </div>
                    <Eye className={`w-5 h-5 ${
                      selectedEnvelopeId === env.id ? 'text-emerald-600' : 'text-slate-300'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {!selectedEnvelopeId ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <MapPin className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 mb-2">请从左侧选择一个已发布的安全包络</h3>
              <p className="text-slate-400">点击列表中的卡片查看详细的坐标点和安全区域</p>
            </div>
          ) : loading && selectedEnvelopeId ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : currentEnvelope ? (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 text-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">
                      {currentEnvelope.robotArmId} 安全包络
                    </h2>
                    <p className="text-slate-300 text-sm mt-1">
                      计算日期：{formatDate(currentEnvelope.calculationDate)} · 
                      安全半径表版本：{currentEnvelope.safetyRadiusVersion}
                    </p>
                  </div>
                  <button
                    onClick={() => exportEnvelope(currentEnvelope.id)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    导出CSV
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-slate-100">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-slate-800">{currentEnvelope.totalPoints}</div>
                    <div className="text-sm text-slate-500">总坐标点</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-emerald-600">
                      {currentPoints.filter(p => p.coordinateType === 'METRIC').length}
                    </div>
                    <div className="text-sm text-slate-500">米制坐标</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-600">
                      {currentPoints.filter(p => p.coordinateType === 'LAT_LNG').length}
                    </div>
                    <div className="text-sm text-slate-500">经纬度坐标</div>
                  </div>
                </div>
              </div>

              {currentPoints.some(p => p.isMixed) && (
                <div className="bg-amber-50 border-b border-amber-200 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-800">注意：包含巡检组特殊说明的记录</h4>
                      <p className="text-amber-700 text-sm mt-1">
                        以下记录经过巡检组特殊复核，作业时请特别注意。如有疑问，联系巡检组。
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4">
                <h3 className="font-semibold text-slate-700 mb-3">坐标点明细</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left font-medium text-slate-600">序号</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">原始行号</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">坐标类型</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">X值</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Y值</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">安全半径</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">半径来源</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">备注</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentPoints.map((point: CoordinatePoint, index: number) => (
                        <tr key={point.id} className={point.isMixed ? 'bg-amber-50' : ''}>
                          <td className="px-3 py-2 text-slate-600">{index + 1}</td>
                          <td className="px-3 py-2 font-mono text-slate-800">{point.originalLineNumber}</td>
                          <td className="px-3 py-2">
                            <CoordinateTypeBadge type={point.coordinateType} />
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {formatCoordinate(point.xValue, point.coordinateType)}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {formatCoordinate(point.yValue, point.coordinateType)}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {point.safetyRadius !== null 
                              ? `${point.safetyRadius.toFixed(3)}m` 
                              : '-'
                            }
                          </td>
                          <td className="px-3 py-2">
                            {point.radiusSource && (
                              <RadiusSourceBadge source={point.radiusSource} />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {point.isMixed ? (
                              <span className="text-amber-600 text-xs">巡检组复核</span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border-t border-slate-200">
                <div className="text-sm text-slate-500">
                  <p className="mb-1"><strong>发布时间：</strong>{formatDate(currentEnvelope.updatedAt)}</p>
                  <p className="mb-1"><strong>创建人：</strong>{currentEnvelope.createdBy}</p>
                  <p>
                    <strong>数据一致性说明：</strong>
                    本页面展示的数据与API接口、导出CSV读取自同一数据源，确保三者完全一致。
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-700 mb-3">📋 现场作业须知</h3>
        <ul className="space-y-2 text-slate-600 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">•</span>
            <span>作业前请确认机械臂编号与本页面显示的一致，不要搞错设备</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">•</span>
            <span>安全半径是硬性要求，任何情况下都不能小于表中数值</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">•</span>
            <span>标有"巡检组复核"的记录，作业前请再跟巡检组确认一次</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">•</span>
            <span>如发现坐标数据有问题，立即停止作业，联系许工或巡检组，不要自己改</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-500 mt-0.5">•</span>
            <span>需要纸质版的，点击"导出CSV"按钮下载打印</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
