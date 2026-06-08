import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { isAdjacentPoint } from '@/utils/merge';
import { Merge, AlertTriangle, Check, MapPin, ChevronRight } from 'lucide-react';
import type { Point } from '@/types';

interface MergeDialogState {
  group: Point[];
  targetName: string;
  showConfirm: boolean;
  hasAdjacentRisk: boolean;
}

export default function PointsMerge() {
  const { getMergeCandidates, mergePoints, loading } = useAppStore();
  const [candidateGroups, setCandidateGroups] = useState<Point[][]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [mergeDialog, setMergeDialog] = useState<MergeDialogState | null>(null);

  useEffect(() => {
    loadCandidates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const candidates = await getMergeCandidates();
      setCandidateGroups(candidates);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const checkAdjacentRisk = (group: Point[]): boolean => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (isAdjacentPoint(group[i], group[j])) return true;
      }
    }
    return false;
  };

  const getPreviewCoords = (group: Point[]) => ({
    lat: group.reduce((s, p) => s + p.coordinates.lat, 0) / group.length,
    lng: group.reduce((s, p) => s + p.coordinates.lng, 0) / group.length,
  });

  const getPreviewAliases = (group: Point[]) => {
    const aliases = new Set(group.flatMap((p) => [p.name, ...p.aliases]));
    aliases.delete(group[0].name);
    return Array.from(aliases);
  };

  const getPreviewPeriods = (group: Point[]) =>
    Array.from(new Set(group.flatMap((p) => p.timePeriods)));

  const handleInitMerge = (group: Point[]) => {
    const hasAdjacentRisk = checkAdjacentRisk(group);
    setMergeDialog({
      group,
      targetName: group[0].name,
      showConfirm: hasAdjacentRisk,
      hasAdjacentRisk,
    });
  };

  const handleConfirmMerge = () => {
    if (!mergeDialog) return;
    if (mergeDialog.hasAdjacentRisk && mergeDialog.showConfirm) {
      setMergeDialog({ ...mergeDialog, showConfirm: false });
    } else {
      executeMerge();
    }
  };

  const executeMerge = async () => {
    if (!mergeDialog) return;
    const pointIds = mergeDialog.group.map((p) => p.id);
    try {
      await mergePoints(pointIds, mergeDialog.targetName);
      setSuccessMessage(`成功归并 ${mergeDialog.group.length} 个点位为「${mergeDialog.targetName}」`);
      setMergeDialog(null);
      loadCandidates();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('归并失败:', error);
    }
  };

  if (loadingCandidates) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text="加载归并候选..." />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">点位归并</h1>
        <p className="text-slate-500 mt-1">智能识别相似点位，一键归并重复数据</p>
      </div>

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <span className="text-green-800 font-medium">{successMessage}</span>
        </div>
      )}

      {candidateGroups.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center">
          <Merge className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">暂无待归并的点位</h3>
          <p className="text-slate-500">系统未检测到需要归并的相似点位</p>
        </div>
      ) : (
        <div className="space-y-6">
          {candidateGroups.map((group, idx) => {
            const hasAdjacentRisk = checkAdjacentRisk(group);
            const previewCoords = getPreviewCoords(group);
            const aliases = getPreviewAliases(group);
            const periods = getPreviewPeriods(group);

            return (
              <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Merge className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-slate-900">候选组 #{idx + 1}（{group.length} 个点位）</span>
                    {hasAdjacentRisk && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />相邻点位风险
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleInitMerge(group)}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50"
                  >
                    <Merge className="w-4 h-4" />归并此组
                  </button>
                </div>
                <div className="flex">
                  <div className="flex-1 p-4 border-r border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">候选点位列表</h4>
                    <div className="space-y-3">
                      {group.map((point) => (
                        <div key={point.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-900">{point.name}</span>
                            <StatusBadge status={point.status} showIcon={false} />
                          </div>
                          <div className="text-sm text-slate-600 mb-2">{point.address}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {point.coordinates.lat.toFixed(6)}, {point.coordinates.lng.toFixed(6)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-8 p-4 flex items-center justify-center">
                    <ChevronRight className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="flex-1 p-4 bg-purple-50">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">归并结果预览</h4>
                    <div className="p-4 bg-white rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-purple-600" />
                        <span className="font-medium text-slate-900">{group[0].name}</span>
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">归并结果</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">别名</label>
                          <div className="flex flex-wrap gap-1">
                            {aliases.slice(0, 5).map((a, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">{a}</span>
                            ))}
                            {aliases.length > 5 && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">+{aliases.length - 5}</span>}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">地址</label>
                          <span className="text-sm text-slate-700">{group[0].address}</span>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">坐标</label>
                          <span className="text-sm font-mono text-slate-700">{previewCoords.lat.toFixed(6)}, {previewCoords.lng.toFixed(6)}</span>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1">涉及时段</label>
                          <div className="flex flex-wrap gap-1">
                            {periods.map((p, i) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">{p}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mergeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            {mergeDialog.showConfirm ? (
              <>
                <div className="p-6 border-b border-slate-200">
                  <div className="flex items-center gap-3 text-red-600 mb-2">
                    <AlertTriangle className="w-6 h-6" />
                    <h3 className="text-lg font-bold">相邻点位警告</h3>
                  </div>
                  <p className="text-red-600 font-medium">⚠️ 这是相邻点位，确定要合并吗？</p>
                  <p className="text-slate-600 text-sm mt-2">检测到该组内的点位为相邻关系（距离 50-200 米），合并可能会导致数据失真，请谨慎操作。</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                  <button onClick={() => setMergeDialog(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium">取消</button>
                  <button onClick={handleConfirmMerge} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">确认合并</button>
                </div>
              </>
            ) : (
              <>
                <div className="p-6 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">确认归并点位</h3>
                  <p className="text-slate-600 text-sm">将合并 {mergeDialog.group.length} 个点位，请输入目标点位名称：</p>
                </div>
                <div className="p-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">目标点位名称</label>
                  <input
                    type="text"
                    value={mergeDialog.targetName}
                    onChange={(e) => setMergeDialog({ ...mergeDialog, targetName: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                    placeholder="请输入归并后的点位名称"
                  />
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-2">即将归并以下点位：</div>
                    <div className="flex flex-wrap gap-1">
                      {mergeDialog.group.map((p) => (
                        <span key={p.id} className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs rounded">{p.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                  <button onClick={() => setMergeDialog(null)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium">取消</button>
                  <button
                    onClick={executeMerge}
                    disabled={loading || !mergeDialog.targetName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50"
                  >
                    {loading && <LoadingSpinner size="sm" />}
                    <Merge className="w-4 h-4" />确认归并
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
