import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Download, FileText, MapPin, CheckCircle, XCircle, Clock, BarChart3, RefreshCw, GitCompare, StickyNote, MessageSquare, Camera, Edit3, History, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import 'leaflet/dist/leaflet.css';

const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function PublicExportPage() {
  const { points, diffs, exportToCSV, setCurrentStep } = useApp();
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'stats' | 'diff' | 'detail'>('map');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const confirmedPoints = points.filter((p) => p.status === 'confirmed');
  const rejectedPoints = points.filter((p) => p.status === 'rejected');
  const pendingPoints = points.filter((p) => p.status === 'pending' || p.status === 'merged');

  const resolvedDiffs = diffs.filter((d) => d.status === 'resolved');
  const pendingDiffs = diffs.filter((d) => d.status === 'pending');
  const skippedDiffs = diffs.filter((d) => d.status === 'skipped');

  const selectedPoint = points.find((p) => p.id === selectedPointId) || null;

  const handleExportCSV = () => {
    const csv = exportToCSV();
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `社区养老助餐配送点位清单_${new Date().toLocaleDateString('zh-CN')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const mapCenter: [number, number] = points.length > 0
    ? [
        points.reduce((sum, p) => sum + p.lat, 0) / points.length,
        points.reduce((sum, p) => sum + p.lng, 0) / points.length,
      ]
    : [31.23, 121.47];

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      review: '需人工确认',
      legacy: '旧口径数据',
      boundary: '边界点位',
      empty: '空值记录',
      duplicate: '重复项',
      smooth: '顺利记录',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-700">公示导出</h1>
          <p className="mt-1 text-sm text-gray-500">地图可视化展示点位数据，导出公示清单，查看完整字段与追溯记录</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            disabled={points.length === 0}
            className="inline-flex items-center px-4 py-2 bg-warm-500 text-white rounded-lg hover:bg-warm-600 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 mr-2" />
            导出公示清单
          </button>
          <button
            onClick={() => setCurrentStep('import')}
            className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            重新开始
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">总点位</p>
              <p className="text-2xl font-bold text-primary-700">{points.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已确认</p>
              <p className="text-2xl font-bold text-green-600">{confirmedPoints.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已作废</p>
              <p className="text-2xl font-bold text-red-600">{rejectedPoints.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待处理</p>
              <p className="text-2xl font-bold text-amber-600">{pendingPoints.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'map'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <MapPin className="w-4 h-4 inline mr-2" />
              地图视图
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'list'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              点位清单
            </button>
            <button
              onClick={() => setActiveTab('detail')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'detail'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Edit3 className="w-4 h-4 inline mr-2" />
              点位详情
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'stats'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              统计分析
            </button>
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'diff'
                  ? 'border-primary-600 text-primary-600 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <GitCompare className="w-4 h-4 inline mr-2" />
              补录差异核对
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'map' && (
            <div className="space-y-4">
              {points.length > 0 ? (
                <div className="h-[500px] rounded-lg overflow-hidden border border-gray-200">
                  <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {points.map((point) => (
                      <Marker
                        key={point.id}
                        position={[point.lat, point.lng]}
                        icon={customIcon}
                        eventHandlers={{
                          click: () => {
                            setSelectedPointId(point.id);
                          },
                        }}
                      >
                        <Popup>
                          <div className="text-sm min-w-[240px]">
                            <h4 className="font-semibold text-gray-900 mb-1">
                              {point.name || '(未命名)'}
                            </h4>
                            <p className="text-gray-600 mb-2">{point.address}</p>
                            <div className="flex flex-wrap gap-1 mb-2">
                              <StatusBadge type="source" value={point.source} />
                              <StatusBadge type="status" value={point.status} />
                              <StatusBadge type="pointType" value={point.type} />
                            </div>
                            {point.zhoujieNote && (
                              <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-amber-100">
                                📌周姐备注：{point.zhoujieNote}
                              </p>
                            )}
                            {point.feedback && (
                              <p className="text-xs text-blue-700 mt-1">
                                💬反馈：{point.feedback}
                              </p>
                            )}
                            {point.photoNotes && (
                              <p className="text-xs text-green-700 mt-1">
                                📷照片：{point.photoNotes}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-2 pt-2 border-t">
                              来源：{point.fileName || '未知'} L{point.sourceRowNumber}
                            </p>
                            {point.originalValues && Object.keys(point.originalValues).length > 0 && (
                              <p className="text-xs text-indigo-600 mt-1">
                                ✋含人工处理值
                              </p>
                            )}
                            <button
                              onClick={() => {
                                setSelectedPointId(point.id);
                                setActiveTab('detail');
                              }}
                              className="mt-2 w-full text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center justify-center"
                            >
                              查看详情 <ChevronRight className="w-3 h-3 ml-1" />
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-center">
                    <MapPin className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">暂无点位数据</p>
                    <button
                      onClick={() => setCurrentStep('import')}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      前往数据导入
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">点位名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">地址</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">坐标</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-amber-700 uppercase">周姐备注</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-blue-700 uppercase">居民反馈</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-green-700 uppercase">照片说明</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase">人工处理</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {points.map((point) => (
                    <tr key={point.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {point.name || '(未命名)'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{point.address}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="source" value={point.source} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="status" value={point.status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="pointType" value={point.type} />
                      </td>
                      <td className="px-4 py-3 text-amber-700 text-xs max-w-[140px] truncate">
                        {point.zhoujieNote ? (
                          <span className="inline-flex items-center"><StickyNote className="w-3 h-3 mr-1" />{point.zhoujieNote}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-blue-700 text-xs max-w-[140px] truncate">
                        {point.feedback ? (
                          <span className="inline-flex items-center"><MessageSquare className="w-3 h-3 mr-1" />{point.feedback}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-green-700 text-xs max-w-[140px] truncate">
                        {point.photoNotes ? (
                          <span className="inline-flex items-center"><Camera className="w-3 h-3 mr-1" />{point.photoNotes}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-indigo-700 text-xs">
                        {point.manualResolveHistory && point.manualResolveHistory.length > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
                            <Edit3 className="w-3 h-3 mr-1" />{point.manualResolveHistory.length}项
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setSelectedPointId(point.id);
                            setActiveTab('detail');
                          }}
                          className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {points.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">暂无数据</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'detail' && (
            <div className="space-y-4">
            {points.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-500 mb-4">暂无点位数据</p>
                <button
                  onClick={() => setCurrentStep('import')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  前往数据导入
                </button>
              </div>
            )}
            {points.length > 0 && !selectedPoint && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">选择要查看详情的点位：</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto p-2">
                  {points.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPointId(p.id)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        selectedPointId === p.id
                          ? 'bg-primary-50 border-primary-300'
                          : 'bg-white border-gray-200 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      <p className="font-medium text-sm text-gray-900 truncate">{p.name || '(未命名)'}</p>
                      <p className="text-xs text-gray-500 truncate">{p.address}</p>
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        <StatusBadge type="status" value={p.status} />
                        {(p.manualResolveHistory && p.manualResolveHistory.length > 0) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-indigo-100 text-indigo-700">人工处理</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selectedPoint && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedPointId(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  ← 返回列表
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-primary-600" />点位正文（当前采用值）
                  </h3>
                  <div className="bg-gradient-to-br from-primary-50 to-white border border-primary-100 rounded-xl p-5 space-y-3">
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">点位名称</span>
                      <p className="text-base font-semibold text-gray-900">
                        {selectedPoint.name || '(空)'}
                        {selectedPoint.originalValues?.name && selectedPoint.originalValues.name !== selectedPoint.name && (
                          <span className="ml-2 text-xs line-through text-gray-400 font-normal">
                            原：{selectedPoint.originalValues.name}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">详细地址</span>
                      <p className="text-base text-gray-900">
                        {selectedPoint.address}
                        {selectedPoint.originalValues?.address && selectedPoint.originalValues.address !== selectedPoint.address && (
                          <span className="ml-2 text-xs line-through text-gray-400">
                            原：{selectedPoint.originalValues.address}</span>
                        )}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">坐标</span>
                        <p className="text-sm text-gray-900">{selectedPoint.lat.toFixed(6)}, {selectedPoint.lng.toFixed(6)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">类型</span>
                        <p className="text-sm text-gray-900 flex items-center">
                          {getTypeLabel(selectedPoint.type)}
                          {selectedPoint.originalValues?.type && selectedPoint.originalValues.type !== selectedPoint.type && (
                            <span className="ml-2 text-xs line-through text-gray-400">
                              原：{getTypeLabel(selectedPoint.originalValues.type)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><span className="text-xs text-gray-500 block mb-1">来源</span>
                        <StatusBadge type="source" value={selectedPoint.source} />
                      </div>
                      <div><span className="text-xs text-gray-500 block mb-1">状态</span>
                        <StatusBadge type="status" value={selectedPoint.status} />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      {selectedPoint.zhoujieNote && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                          <p className="text-xs font-medium text-amber-800 flex items-center">
                            <StickyNote className="w-3.5 h-3.5 mr-1.5" />周姐备注
                          </p>
                          <p className="text-sm text-amber-900 mt-1">{selectedPoint.zhoujieNote}</p>
                        </div>
                      )}
                      {selectedPoint.feedback && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-xs font-medium text-blue-800 flex items-center">
                            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />居民反馈
                          </p>
                          <p className="text-sm text-blue-900 mt-1">{selectedPoint.feedback}</p>
                        </div>
                      )}
                      {selectedPoint.photoNotes && (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                          <p className="text-xs font-medium text-green-800 flex items-center">
                            <Camera className="w-3.5 h-3.5 mr-1.5" />巡检照片说明
                          </p>
                          <p className="text-sm text-green-900 mt-1">{selectedPoint.photoNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <History className="w-5 h-5 mr-2 text-indigo-600" />完整审核与处理历史
                  </h3>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
                    {selectedPoint.auditTrail.map((r, idx) => (
                      <div key={r.id} className={`p-3 rounded-lg border text-xs ${
                        r.action === 'manualResolve'
                          ? 'bg-indigo-50 border-indigo-200'
                          : r.action === 'confirm'
                          ? 'bg-green-50 border-green-200'
                          : r.action === 'reject'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-800">
                          {r.action === 'manualResolve' ? '✋ 手动处理' :
                            r.action === 'confirm' ? '✅ 确认通过' :
                            r.action === 'reject' ? '❌ 作废' :
                            r.action === 'note' ? '📝 添加备注' :
                            r.action === 'merge' ? '🔗 合并' :
                            r.action === 'diffResolve' ? '🔍 差异处理' :
                            r.action === 'import' ? '📥 导入' : r.action}
                          </span>
                          <span className="text-gray-500">#{selectedPoint.auditTrail.length - idx}</span>
                        </div>
                        <p className="text-gray-700">{r.remark}</p>
                        <div className="mt-1 text-gray-500 text-[11px]">{r.operator} · {new Date(r.timestamp).toLocaleString('zh-CN')}</div>
                      </div>
                    ))}
                  </div>
                  {selectedPoint.manualResolveHistory && selectedPoint.manualResolveHistory.length > 0 && (
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                      <p className="text-xs font-semibold text-indigo-800 mb-2">人工处理字段变更明细</p>
                      <div className="space-y-1">
                        {selectedPoint.manualResolveHistory.map((s, i) => (
                          <div key={i} className="text-xs text-indigo-900 flex items-center gap-2">
                            <span className="text-indigo-600 font-medium">{s.field}:</span>
                            <span className="line-through text-gray-500">{s.originalValue}</span>
                            <span>→</span>
                            <span className="font-medium bg-white px-1.5 py-0.5 rounded border border-indigo-200">{s.resolvedValue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                  <span>来源文件：{selectedPoint.fileName || '未知'}</span>
                  <span>原始行号：第{selectedPoint.sourceRowNumber}行</span>
                  <span>创建时间：{new Date(selectedPoint.createdAt).toLocaleString('zh-CN')}</span>
                  <span>最后更新：{new Date(selectedPoint.updatedAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            </div>
            )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-700 mb-4">数据来源分布</h3>
                <div className="space-y-3">
                  {['GIS', 'feedback', 'inspection', 'street'].map((source) => {
                    const count = points.filter((p) => p.source === source).length;
                    const percent = points.length > 0 ? (count / points.length) * 100 : 0;
                    return (
                      <div key={source}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">
                            {source === 'GIS' ? 'GIS点位' :
                             source === 'feedback' ? '居民反馈' :
                             source === 'inspection' ? '巡检记录' : '街道备注'}
                          </span>
                          <span className="text-gray-900 font-medium">{count} 条 ({percent.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-700 mb-4">点位类型分布</h3>
                <div className="space-y-3">
                  {['smooth', 'review', 'legacy', 'boundary', 'duplicate', 'empty'].map((type) => {
                    const count = points.filter((p) => p.type === type).length;
                    const percent = points.length > 0 ? (count / points.length) * 100 : 0;
                    if (count === 0) return null;
                    return (
                      <div key={type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">
                            {type === 'smooth' ? '顺利记录' :
                             type === 'review' ? '待人工确认' :
                             type === 'legacy' ? '旧口径数据' :
                             type === 'boundary' ? '边界点位' :
                             type === 'duplicate' ? '重复项' : '空值记录'}
                          </span>
                          <span className="text-gray-900 font-medium">{count} 条 ({percent.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              type === 'smooth' ? 'bg-emerald-500' :
                              type === 'review' ? 'bg-amber-500' :
                              type === 'legacy' ? 'bg-slate-500' :
                              type === 'boundary' ? 'bg-orange-500' :
                              type === 'duplicate' ? 'bg-purple-500' : 'bg-rose-500'
                            } transition-all`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 md:col-span-2">
                <h3 className="font-semibold text-gray-700 mb-4">处理流程统计</h3>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary-600">{points.length}</p>
                    <p className="text-sm text-gray-500 mt-1">导入点位</p>
                  </div>
                  <div className="flex-1 h-1 bg-gray-200 mx-4 rounded" />
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{confirmedPoints.length}</p>
                    <p className="text-sm text-gray-500 mt-1">确认公示</p>
                  </div>
                  <div className="flex-1 h-1 bg-gray-200 mx-4 rounded" />
                  <div className="text-center">
                    <p className="text-3xl font-bold text-red-600">{rejectedPoints.length}</p>
                    <p className="text-sm text-gray-500 mt-1">作废排除</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'diff' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-amber-700">待处理差异</p>
                      <p className="text-2xl font-bold text-amber-700">{pendingDiffs.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-green-700">已处理</p>
                      <p className="text-2xl font-bold text-green-700">{resolvedDiffs.length}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">已跳过</p>
                      <p className="text-2xl font-bold text-gray-600">{skippedDiffs.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {diffs.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700">补录差异核对明细（报告内容核对）</h3>
                    <span className="text-sm text-gray-500">共 {diffs.length} 组差异，已处理 {resolvedDiffs.length} 组</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">状态</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">点位A</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">来源A</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">点位B</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">来源B</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">差异字段</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">确认取值</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">备注</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {diffs.map((d) => {
                          const pa = points.find((p) => p.id === d.pointIds[0]);
                          const pb = points.find((p) => p.id === d.pointIds[1]);
                          return (
                            <tr key={d.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  d.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                  d.status === 'skipped' ? 'bg-gray-100 text-gray-600' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {d.status === 'resolved' ? '已处理' : d.status === 'skipped' ? '已跳过' : '待处理'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-800 font-medium">{pa?.name || '-'}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">
                                {pa?.fileName || '-'} L{pa?.sourceRowNumber || '-'}
                              </td>
                              <td className="px-4 py-3 text-gray-800 font-medium">{pb?.name || '-'}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs">
                                {pb?.fileName || '-'} L{pb?.sourceRowNumber || '-'}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {d.diffFields.map((f) => f.field).join('、')}
                              </td>
                              <td className="px-4 py-3 text-gray-700 text-xs">
                                {d.status === 'resolved'
                                  ? d.diffFields.filter((f) => f.chosen).map((f) =>
                                      `${f.field}=${f.chosen === 'A' ? 'A值' : f.chosen === 'B' ? 'B值' : '自定义:' + (f.customValue || '')}`
                                    ).join(', ')
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                                {d.resolvedNote || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <GitCompare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">暂无补录差异记录</p>
                  <p className="text-xs text-gray-400 mt-1">导入多来源台账后将自动检测同点位字段差异</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {points.length > 0 && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">数据已本地保存</h3>
              <p className="text-primary-200 text-sm">
                刷新页面后，所有点位数据、人工备注、周姐备注、反馈、照片说明和决策记录都会保留
              </p>
            </div>
            <div className="flex gap-2 text-xs text-primary-200 flex-wrap">
              <span>已确认: {confirmedPoints.length}</span>
              <span>·</span>
              <span>人工处理: {points.filter((p) => p.manualResolveHistory && p.manualResolveHistory.length > 0).length}</span>
              <span>·</span>
              <span>带周姐备注: {points.filter((p) => p.zhoujieNote).length}</span>
              <span>·</span>
              <span>带反馈: {points.filter((p) => p.feedback).length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
