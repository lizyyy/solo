import { useEffect, useState } from 'react';
import { Merge, Check, X, MapPin, Map, Navigation, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store';
import { cn, getSourceColor, getSourceLabel } from '../lib/utils';

export function MergePage() {
  const {
    points,
    mergeGroups,
    generateMergeGroups,
    confirmMerge,
    rejectMerge,
    updateMergeName,
    updateMergeAddress,
  } = useAppStore();
  const [threshold, setThreshold] = useState(0.6);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (points.length > 0 && mergeGroups.length === 0) {
      handleGenerate();
    }
  }, [points.length]);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      generateMergeGroups(threshold);
      setGenerating(false);
    }, 500);
  };

  const pendingGroups = mergeGroups.filter((g) => !g.confirmed && !g.rejected);
  const confirmedGroups = mergeGroups.filter((g) => g.confirmed);
  const rejectedGroups = mergeGroups.filter((g) => g.rejected);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">点位归并</h1>
        <p className="text-gray-600">智能识别并归并名称、地址相似的点位</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                匹配阈值: {(threshold * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.4"
                max="0.9"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-48"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Merge className="w-4 h-4" />
              {generating ? '分析中...' : '重新分析'}
            </button>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{pendingGroups.length}</p>
              <p className="text-gray-500">待确认</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{confirmedGroups.length}</p>
              <p className="text-gray-500">已归并</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-400">{rejectedGroups.length}</p>
              <p className="text-gray-500">已拒绝</p>
            </div>
          </div>
        </div>
      </div>

      {pendingGroups.length === 0 && !generating ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Merge className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">暂无待归并的点位组</p>
          <p className="text-sm text-gray-400 mt-1">
            调整匹配阈值或导入更多数据后重新分析
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingGroups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        疑似相同点位组 ({group.points.length} 个点位)
                      </h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        综合匹配度 {(group.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        名称匹配 {(group.nameSimilarity * 100).toFixed(0)}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Map className="w-4 h-4" />
                        地址匹配 {(group.addressSimilarity * 100).toFixed(0)}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Navigation className="w-4 h-4" />
                        距离 {group.distance.toFixed(1)}m
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectMerge(group.id)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      不是同一点位
                    </button>
                    <button
                      onClick={() => confirmMerge(group.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      确认归并
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    归并后名称
                  </label>
                  <input
                    type="text"
                    value={group.mergedName}
                    onChange={(e) => updateMergeName(group.id, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    归并后地址
                  </label>
                  <input
                    type="text"
                    value={group.mergedAddress}
                    onChange={(e) => updateMergeAddress(group.id, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(group.points.length, 3)}, 1fr)` }}>
                  {group.points.map((point, idx) => (
                    <div
                      key={point.id}
                      className="p-4 rounded-lg border border-gray-200 bg-white"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-500">点位 {idx + 1}</span>
                        <span className={cn('px-2 py-0.5 text-xs rounded-full', getSourceColor(point.source))}>
                          {getSourceLabel(point.source)}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{point.name}</h4>
                      <p className="text-sm text-gray-500 mb-2">{point.address}</p>
                      <p className="text-xs text-gray-400 line-clamp-2">{point.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmedGroups.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            已完成归并 ({confirmedGroups.length})
          </h2>
          <div className="space-y-3">
            {confirmedGroups.map((group) => (
              <div
                key={group.id}
                className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-green-800">{group.mergedName}</p>
                  <p className="text-sm text-green-600">
                    归并了 {group.points.length} 个点位: {group.points.map((p) => p.name).join('、')}
                  </p>
                </div>
                <Check className="w-5 h-5 text-green-600" />
              </div>
            ))}
          </div>
        </div>
      )}

      {rejectedGroups.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <X className="w-5 h-5 text-gray-500" />
            已拒绝归并 ({rejectedGroups.length})
          </h2>
          <div className="space-y-3">
            {rejectedGroups.map((group) => (
              <div
                key={group.id}
                className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-700">
                    {group.points.map((p) => p.name).join(' / ')}
                  </p>
                  <p className="text-sm text-gray-500">已确认为不同点位</p>
                </div>
                <X className="w-5 h-5 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
