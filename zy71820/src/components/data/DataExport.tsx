import { Download, FileJson, BarChart3, Users, Trophy, AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { getStatusLabel, getStatusColor } from '@/services/AnomalyService';
import { formatDate, formatNumber } from '@/utils/helpers';
import { serializeFilters } from '@/utils/viewSync';
import type { PlayerScore, LevelConfig, ViewState } from '@/types/data';

interface DataExportProps {
  scores: PlayerScore[];
  levels: LevelConfig[];
  previewData: any[];
  filters: ViewState['filters'];
  isLoading: boolean;
  onExport: () => Promise<void>;
}

export function DataExport({
  scores: _scores,
  levels: _levels,
  previewData,
  filters,
  isLoading,
  onExport,
}: DataExportProps) {
  const { showError } = useUIStore();

  const stats = {
    total: previewData.length,
    avgScore: previewData.length > 0
      ? Math.round(previewData.reduce((sum, s) => sum + s.score, 0) / previewData.length)
      : 0,
    maxScore: previewData.length > 0
      ? Math.max(...previewData.map((s) => s.score))
      : 0,
    pending: previewData.filter((s) => s.status === 'pending').length,
    anomaly: previewData.filter((s) => s.anomalyType).length,
  };

  const filterStr = serializeFilters(filters);

  const handleExportClick = async () => {
    if (previewData.length === 0) {
      showError({
        code: 'EXPORT_NO_DATA',
        message: '当前筛选条件下没有数据可以导出',
        suggestion: '试试调整一下筛选条件，比如扩大时间范围或者清除状态筛选',
        contact: '联系数据组 @数据专员',
      });
      return;
    }
    await onExport();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-neon-orange">导出活动复盘</h3>
        <button
          onClick={handleExportClick}
          disabled={previewData.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-neon-orange text-white hover:bg-neon-orange/90 transition-all shadow-neon-orange disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={18} />
          导出 JSON
        </button>
      </div>

      <div className="bg-night-card rounded-xl p-4 border border-night-card">
        <h4 className="font-display text-neon-yellow mb-3 flex items-center gap-2">
          <BarChart3 size={18} />
          导出数据概览
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="font-display text-3xl text-white">{stats.total}</div>
            <div className="text-xs text-gray-400 mt-1">总记录数</div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl text-neon-orange">
              {formatNumber(stats.avgScore)}
            </div>
            <div className="text-xs text-gray-400 mt-1">平均分</div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl text-neon-green">
              {formatNumber(stats.maxScore)}
            </div>
            <div className="text-xs text-gray-400 mt-1">最高分</div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl text-neon-yellow">{stats.pending}</div>
            <div className="text-xs text-gray-400 mt-1">待复核</div>
          </div>
          <div className="text-center">
            <div className="font-display text-3xl text-neon-pink">{stats.anomaly}</div>
            <div className="text-xs text-gray-400 mt-1">异常数</div>
          </div>
        </div>
      </div>

      <div className="bg-night-surface/80 backdrop-blur-md rounded-xl p-4 border border-night-card">
        <h4 className="font-display text-neon-blue mb-3 flex items-center gap-2">
          <FileJson size={18} />
          当前筛选条件
        </h4>
        <div className="text-sm text-gray-400 font-body">
          {filterStr || '无筛选条件'}
        </div>
      </div>

      <div className="bg-night-card rounded-xl p-4 border border-night-card">
        <h4 className="font-display text-neon-green mb-3 flex items-center gap-2">
          <Users size={18} />
          数据预览 ({previewData.length} 条)
        </h4>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-neon-orange border-t-transparent rounded-full mx-auto" />
          </div>
        ) : previewData.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle size={32} className="mx-auto text-neon-yellow mb-2" />
            <p className="font-body text-gray-400">当前筛选条件下没有数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-night-surface">
                  <th className="pb-2 font-body font-medium">玩家</th>
                  <th className="pb-2 font-body font-medium">分数</th>
                  <th className="pb-2 font-body font-medium">满意度</th>
                  <th className="pb-2 font-body font-medium">状态</th>
                  <th className="pb-2 font-body font-medium">提交时间</th>
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 10).map((score) => (
                  <tr
                    key={score.id}
                    className="border-b border-night-surface/50"
                  >
                    <td className="py-2 font-body text-white">{score.playerName}</td>
                    <td className="py-2 font-display text-neon-orange">
                      {formatNumber(score.score)}
                    </td>
                    <td className="py-2 font-body text-neon-green">
                      {Math.floor(score.satisfaction)}%
                    </td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(
                          score.status
                        )}`}
                      >
                        {getStatusLabel(score.status)}
                      </span>
                    </td>
                    <td className="py-2 text-sm text-gray-400">
                      {formatDate(score.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 10 && (
              <p className="text-center text-sm text-gray-500 mt-2">
                ...还有 {previewData.length - 10} 条记录未显示
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-night-card/50 rounded-xl p-4 border border-night-card/50">
        <h4 className="font-display text-white mb-2">📋 导出说明</h4>
        <div className="space-y-2 text-sm text-gray-400 font-body">
          <p>• 导出的JSON文件包含：数据汇总统计、完整的分数记录、筛选条件元数据</p>
          <p>• 导出范围与当前筛选条件完全一致，确保导出的活动复盘与屏幕视图对得上</p>
          <p>• 导出操作会被记录到操作历史，方便后续追溯</p>
          <p>• 导出的文件可以通过"导入"功能在其他电脑上恢复数据</p>
        </div>
      </div>
    </div>
  );
}
