import { useState } from 'react';
import { Edit3, Clock, AlertTriangle, Save, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store';
import { showToast } from '@/utils/errorMessageUtils';
import { getFieldDisplayName } from '@/utils/diffUtils';

export default function RedlineRemarkManagement() {
  const { points, getPointRemarks, addRedlineRemark, currentUser, streets } = useAppStore();
  const [selectedPointId, setSelectedPointId] = useState(points[0]?.id || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null);

  const selectedPoint = points.find((p) => p.id === selectedPointId);
  const remarks = getPointRemarks(selectedPointId);
  const latestRemark = remarks[0];

  const getStreetName = (id: string) => {
    return streets.find((s) => s.id === id)?.name || id;
  };

  const handleStartEdit = () => {
    setEditContent(latestRemark?.content || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!currentUser || !editContent.trim()) {
      showToast('备注内容不能为空', 'error');
      return;
    }
    addRedlineRemark(selectedPointId, editContent.trim(), currentUser.id, currentUser.name);
    setIsEditing(false);
    setEditContent('');
    showToast('备注保存成功', 'success');
  };

  const getStatusBadge = (point: typeof points[0]) => {
    if (!point.isBoundary) {
      return <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">正常</span>;
    }
    switch (point.boundaryStatus) {
      case 'pending':
        return (
          <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs flex items-center gap-1">
            <AlertTriangle size={12} />
            待复核
          </span>
        );
      case 'confirmed':
        return <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">已确认</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs">已驳回</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 font-serif">红线图备注管理</h2>
        <p className="text-slate-500 mt-1">编辑点位备注，查看修改历史和版本对比</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">点位列表</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
              {points.map((point) => (
                <button
                  key={point.id}
                  onClick={() => setSelectedPointId(point.id)}
                  className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                    selectedPointId === point.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-800">{point.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {point.streetIds.map(getStreetName).join(' / ')}
                      </p>
                    </div>
                    {getStatusBadge(point)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedPoint && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{selectedPoint.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    坐标：{selectedPoint.lng}, {selectedPoint.lat}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedPoint.isBoundary && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                      边界点位
                    </span>
                  )}
                  {!isEditing && (
                    <button
                      onClick={handleStartEdit}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                    >
                      <Edit3 size={16} />
                      编辑备注
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="请输入备注内容..."
                      className="w-full h-32 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
                      >
                        <X size={16} />
                        取消
                      </button>
                      <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <Save size={16} />
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-700 leading-relaxed">
                      {latestRemark?.content || '暂无备注，点击右上角编辑按钮添加'}
                    </p>
                    {latestRemark && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                        <Clock size={14} />
                        <span>最后更新：{latestRemark.createdByName}</span>
                        <span>·</span>
                        <span>{new Date(latestRemark.createdAt).toLocaleString('zh-CN')}</span>
                        <span>·</span>
                        <span>版本 {latestRemark.version}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">历史版本</h3>
              {remarks.length >= 2 && (
                <button
                  onClick={() => setCompareVersions(compareVersions ? null : [0, 1])}
                  className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                    compareVersions
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {compareVersions ? '取消对比' : '版本对比'}
                </button>
              )}
            </div>

            {compareVersions && remarks.length >= 2 ? (
              <div className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <label className="text-sm text-slate-500">版本 1</label>
                    <select
                      value={compareVersions[0]}
                      onChange={(e) =>
                        setCompareVersions([Number(e.target.value), compareVersions[1]])
                      }
                      className="w-full mt-1 p-2 border border-slate-200 rounded-lg"
                    >
                      {remarks.map((r, i) => (
                        <option key={i} value={i}>
                          版本 {r.version} - {r.createdByName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ChevronRight size={24} className="text-slate-300" />
                  <div className="flex-1">
                    <label className="text-sm text-slate-500">版本 2</label>
                    <select
                      value={compareVersions[1]}
                      onChange={(e) =>
                        setCompareVersions([compareVersions[0], Number(e.target.value)])
                      }
                      className="w-full mt-1 p-2 border border-slate-200 rounded-lg"
                    >
                      {remarks.map((r, i) => (
                        <option key={i} value={i}>
                          版本 {r.version} - {r.createdByName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-600 mb-2">
                      版本 {remarks[compareVersions[0]]?.version}
                    </p>
                    <p className="text-slate-700">{remarks[compareVersions[0]]?.content}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-600 mb-2">
                      版本 {remarks[compareVersions[1]]?.version}
                    </p>
                    <p className="text-slate-700">{remarks[compareVersions[1]]?.content}</p>
                  </div>
                </div>

                {remarks[compareVersions[0]]?.diff && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-700 mb-2">差异字段：</p>
                    {Object.entries(remarks[compareVersions[0]].diff || {}).map(([field, values]) => (
                      <div key={field} className="mb-2">
                        <p className="text-sm text-slate-500">{getFieldDisplayName(field)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm line-through">
                            {String((values as { before: unknown }).before)}
                          </span>
                          <ChevronRight size={14} className="text-slate-300" />
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                            {String((values as { after: unknown }).after)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {remarks.map((remark) => (
                  <div key={remark.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            v{remark.version}
                          </span>
                          <span className="text-sm font-medium text-slate-700">
                            {remark.createdByName}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-2">{remark.content}</p>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(remark.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    {remark.diff && Object.keys(remark.diff).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400 mb-2">本次修改内容：</p>
                        {Object.entries(remark.diff).map(([field, values]) => (
                          <div key={field} className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500">{getFieldDisplayName(field)}：</span>
                            <span className="text-red-500 line-through">
                              {String((values as { before: unknown }).before)}
                            </span>
                            <ChevronRight size={12} className="text-slate-300" />
                            <span className="text-green-600">
                              {String((values as { after: unknown }).after)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
