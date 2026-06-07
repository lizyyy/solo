import { useState } from 'react';
import { BarChart3, AlertTriangle, FileText, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import { useGaitStore } from '../../store/useGaitStore';
import { BONE_GROUP_LABELS, DATA_SOURCE_LABELS, ANOMALY_TYPE_LABELS } from '../../types';

export default function StatisticsPanel() {
  const { getStatistics, snapshots } = useGaitStore();
  const stats = getStatistics();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-600" />
          全局统计
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalFrames}</div>
              <div className="text-xs text-blue-600">总帧数</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">{stats.totalPoints}</div>
              <div className="text-xs text-gray-500">点位数量</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.anomalyPoints}</div>
              <div className="text-xs text-orange-600">异常点位</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.totalNotes}</div>
              <div className="text-xs text-purple-600">备注总数</div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <AlertTriangle size={12} className="text-orange-500" />
              异常类型分布
            </p>
            <div className="space-y-1">
              {Object.entries(stats.anomalyByType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{ANOMALY_TYPE_LABELS[type as keyof typeof ANOMALY_TYPE_LABELS]}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${stats.anomalyPoints > 0 ? (count / stats.anomalyPoints) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-gray-700 font-mono w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <FileText size={12} className="text-blue-500" />
              数据来源分布
            </p>
            <div className="space-y-1">
              {Object.entries(stats.pointsBySource).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{DATA_SOURCE_LABELS[source as keyof typeof DATA_SOURCE_LABELS]}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(count / stats.totalPoints) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-700 font-mono w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
              <Edit3 size={12} className="text-green-500" />
              坐标修正总数
            </p>
            <div className="text-center bg-green-50 rounded-lg p-2">
              <span className="text-xl font-bold text-green-600">{stats.totalCoordinateChanges}</span>
              <span className="text-xs text-green-600 ml-1">次</span>
            </div>
          </div>

          {snapshots.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">已保存快照 ({snapshots.length})</p>
              <div className="text-xs text-gray-500">
                最新快照：{snapshots[snapshots.length - 1]?.name}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
