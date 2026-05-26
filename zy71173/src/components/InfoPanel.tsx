import { useGameStore } from '@/store/useGameStore';

const eventColors: Record<string, string> = {
  move: 'text-green-400',
  door_open: 'text-emerald-400',
  humidity: 'text-blue-400',
  humidity_damage: 'text-blue-500',
  congestion: 'text-orange-400',
  alert: 'text-yellow-400',
  guard_spotted: 'text-red-500',
  item_used: 'text-purple-400',
  timeout: 'text-gray-400',
  door_permission_denied: 'text-red-400',
  wrong_operation: 'text-red-400',
  resource_waste: 'text-yellow-500',
  door_blocked: 'text-red-400',
  success: 'text-emerald-500',
};

const exhibitTypeLabels: Record<string, string> = {
  painting: '绘画',
  sculpture: '雕塑',
  artifact: '文物',
};

export function InfoPanel() {
  const { currentLevel, events } = useGameStore();

  const recentEvents = events.slice(-5).reverse();

  return (
    <div className="hud-panel w-[280px] h-auto overflow-y-auto flex flex-col gap-4">
      {currentLevel && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-museum-accent uppercase tracking-wider">
            展品信息
          </h3>
          <div className="bg-museum-bg/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">名称</span>
              <span className="text-white font-medium text-sm">
                {currentLevel.exhibit.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">类型</span>
              <span className="text-white text-sm">
                {exhibitTypeLabels[currentLevel.exhibit.type] ||
                  currentLevel.exhibit.type}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">价值</span>
              <span className="text-museum-accent font-semibold text-sm">
                ${currentLevel.exhibit.value.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs">最大承受湿度</span>
              <span className="text-museum-humidity text-sm">
                {currentLevel.exhibit.maxHumidity}%
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-museum-accent uppercase tracking-wider">
          风险图例
        </h3>
        <div className="bg-museum-bg/50 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-blue-400">🟦</span>
            <span className="text-gray-300">湿度区</span>
            <span className="text-gray-500 text-[10px]">
              （湿度&gt;60%会损坏展品）
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">🟧</span>
            <span className="text-gray-300">拥堵区</span>
            <span className="text-gray-500 text-[10px]">
              （特定回合无法通行）
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-500">🟥</span>
            <span className="text-gray-300">安保巡逻</span>
            <span className="text-gray-500 text-[10px]">
              （进入视野范围失败）
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>🚪</span>
            <span className="text-gray-300">门禁</span>
            <span className="text-gray-500 text-[10px]">
              （需要对应权限卡）
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-museum-accent uppercase tracking-wider">
          操作说明
        </h3>
        <div className="bg-museum-bg/50 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-museum-accent shrink-0">•</span>
            <span className="text-gray-300">
              规划阶段：点击格子规划路线
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-museum-accent shrink-0">•</span>
            <span className="text-gray-300">
              执行阶段：观察风险，使用道具
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-museum-accent uppercase tracking-wider">
          扣分规则
        </h3>
        <div className="bg-museum-bg/50 rounded-lg p-3 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">错误操作</span>
            <span className="text-red-400 font-medium">-100</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">超时</span>
            <span className="text-red-400 font-medium">-200</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">资源浪费</span>
            <span className="text-yellow-500 font-medium">-150</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">未授权开门</span>
            <span className="text-red-400 font-medium">-300</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">湿度损坏</span>
            <span className="text-red-400 font-medium">-100</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">被安保发现</span>
            <span className="text-red-400 font-medium">-500</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-museum-accent uppercase tracking-wider">
          失败条件
        </h3>
        <div className="bg-museum-bg/50 rounded-lg p-3 space-y-1.5 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-red-400 shrink-0">✕</span>
            <span className="text-gray-300">
              未授权开门触发警报
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400 shrink-0">✕</span>
            <span className="text-gray-300">
              进入安保人员视野范围
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400 shrink-0">✕</span>
            <span className="text-gray-300">
              在拥堵回合进入拥堵区
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400 shrink-0">✕</span>
            <span className="text-gray-300">
              超出最大回合数
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-museum-accent uppercase tracking-wider">
          实时事件
        </h3>
        <div className="bg-museum-bg/50 rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
          {recentEvents.length === 0 ? (
            <div className="text-gray-500 text-xs text-center py-2">
              暂无事件
            </div>
          ) : (
            recentEvents.map((event, index) => (
              <div
                key={`${event.round}-${event.type}-${index}`}
                className={`text-xs py-1 border-b border-museum-bgLighter/30 last:border-0 ${
                  eventColors[event.type] || 'text-gray-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-[10px]">
                    R{event.round}
                  </span>
                  <span className="font-medium">[{event.type}]</span>
                </div>
                <div className="text-[11px] mt-1 pl-8 text-gray-300">
                  {event.description || event.message}
                  {event.scoreChange !== 0 && (
                    <span
                      className={`ml-1 ${
                        event.scoreChange > 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {event.scoreChange > 0 ? '+' : ''}
                      {event.scoreChange}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
