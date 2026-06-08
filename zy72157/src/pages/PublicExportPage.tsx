import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Download, FileText, MapPin, CheckCircle, XCircle, Clock, BarChart3, RefreshCw } from 'lucide-react';
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
  const { points, exportToCSV, clearAllData, loadSampleData, setCurrentStep } = useApp();
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'stats'>('map');

  const confirmedPoints = points.filter((p) => p.status === 'confirmed');
  const rejectedPoints = points.filter((p) => p.status === 'rejected');
  const pendingPoints = points.filter((p) => p.status === 'pending' || p.status === 'merged');

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary-700">公示导出</h1>
          <p className="mt-1 text-sm text-gray-500">地图可视化展示点位数据，导出公示清单</p>
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
          <nav className="flex">
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
                      >
                        <Popup>
                          <div className="text-sm min-w-[200px]">
                            <h4 className="font-semibold text-gray-900 mb-1">
                              {point.name || '(未命名)'}
                            </h4>
                            <p className="text-gray-600 mb-2">{point.address}</p>
                            <div className="flex flex-wrap gap-1 mb-2">
                              <StatusBadge type="source" value={point.source} />
                              <StatusBadge type="status" value={point.status} />
                              <StatusBadge type="pointType" value={point.type} />
                            </div>
                            <p className="text-xs text-gray-400 mb-1">
                              来源：{point.fileName || '未知'} L{point.sourceRowNumber}
                            </p>
                            {point.notes && (
                              <p className="text-xs text-gray-500 mt-2 pt-2 border-t">
                                备注：{point.notes}
                              </p>
                            )}
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
                      onClick={loadSampleData}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      加载样例数据
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'list' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">点位名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">地址</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">坐标</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源文件</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">备注</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {points.map((point) => (
                    <tr key={point.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {point.name || '(未命名)'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{point.address}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="source" value={point.source} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {point.fileName || '-'}
                        {point.sourceRowNumber > 0 && <span className="text-xs text-gray-400 ml-1">L{point.sourceRowNumber}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="status" value={point.status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="pointType" value={point.type} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {point.notes || '-'}
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
        </div>
      </div>

      {points.length > 0 && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">数据已本地保存</h3>
              <p className="text-primary-200 text-sm">
                刷新页面后，所有点位数据、人工备注和决策记录都会保留
              </p>
            </div>
            <button
              onClick={clearAllData}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
            >
              清除所有数据
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
