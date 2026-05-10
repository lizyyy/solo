import { DashboardStats, STATUS_LABELS } from '../types';
import { formatDateTime } from '../api';
import { Link } from 'react-router-dom';

interface Props {
  stats: DashboardStats | null;
  onRefresh: () => void;
}

export default function Dashboard({ stats, onRefresh }: Props) {
  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const statusCards = Object.entries(stats.statusCounts).map(([key, count]) => ({
    status: key,
    label: (STATUS_LABELS as any)[key] || key,
    count
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">活动仪表盘</h1>
        <button onClick={onRefresh} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          🔄 刷新
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statusCards.map(card => (
          <Link key={card.status} to={`/riders?status=${card.status}`} className={`block p-4 rounded-lg shadow bg-status-${card.status} hover:shadow-lg transition-shadow`}>
            <div className={`text-sm status-${card.status}`}>{card.label}</div>
            <div className="text-2xl font-bold">{card.count}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">签到点状态</h2>
          <div className="space-y-3">
            {stats.checkpointStats.map(cp => (
              <div key={cp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">
                    {cp.isStart ? '🏁 ' : cp.isFinish ? '🏆 ' : '📍 '}
                    {cp.name}
                  </div>
                  <div className="text-sm text-gray-500">{cp.location}</div>
                </div>
                <Link to={`/checkpoints`} className="text-blue-600 font-bold text-lg hover:underline">
                  {cp.totalChecked} 人
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">补给发放</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-sm text-orange-600">途中补给</div>
              <div className="text-2xl font-bold">{stats.supplyStats.course}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600">完赛补给</div>
              <div className="text-2xl font-bold">{stats.supplyStats.finish}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">⚠️ 异常情况 - 漏签到</h2>
          {stats.missingCheckins.length === 0 ? (
            <div className="text-gray-500 text-center py-4">当前无漏签到情况</div>
          ) : (
            <div className="space-y-2">
              {stats.missingCheckins.map(rider => (
                <Link key={rider.id} to={`/riders/${rider.id}`} 
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded hover:bg-yellow-100">
                  <div>
                    <span className="font-bold">#{rider.bibNumber}</span> {rider.name}
                    {rider.team && <span className="text-gray-500 text-sm ml-2">({rider.team})</span>}
                  </div>
                  <span className="text-yellow-600 text-sm">可能漏签</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">📋 最近退赛</h2>
          {stats.dropouts.length === 0 ? (
            <div className="text-gray-500 text-center py-4">暂无退赛记录</div>
          ) : (
            <div className="space-y-2">
              {stats.dropouts.slice(0, 5).map(d => (
                <div key={d.id} className="p-3 bg-orange-50 rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{d.reason}</span>
                    <span className="text-gray-500 text-sm">{formatDateTime(d.droppedAt)}</span>
                  </div>
                  {d.comments && <div className="text-sm text-gray-600 mt-1">{d.comments}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3 text-blue-800">📖 样例场景说明</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-white rounded">
            <div className="font-semibold text-green-700">✅ 张明 - 正常完赛</div>
            <div className="text-gray-600">装备检查通过 → 所有签到点签到 → 完赛 → 领取完赛补给</div>
          </div>
          <div className="p-3 bg-white rounded">
            <div className="font-semibold text-red-700">❌ 李华 - 装备缺失</div>
            <div className="text-gray-600">尾灯缺失，装备检查未通过，无法出发。有审批意见记录。</div>
          </div>
          <div className="p-3 bg-white rounded">
            <div className="font-semibold text-yellow-700">⚠️ 王芳 - 漏签到</div>
            <div className="text-gray-600">缺少CP2(东方明珠)签到，无法直接完赛。</div>
          </div>
          <div className="p-3 bg-white rounded">
            <div className="font-semibold text-orange-700">🏥 赵强 - 途中退赛</div>
            <div className="text-gray-600">CP2退赛（身体不适），不能领取完赛补给。有退赛确认记录。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
