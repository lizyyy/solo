import { useGameStore } from '@/store/gameStore'
import { Route, ListOrdered, Timer, Play } from 'lucide-react'

const FEATURES = [
  {
    icon: <Route className="w-8 h-8" />,
    title: '路线规划',
    desc: '规划服务员送餐与收台路径，避免动线交叉冲突',
  },
  {
    icon: <ListOrdered className="w-8 h-8" />,
    title: '任务优先级',
    desc: '合理安排出餐与收台优先级，减少超时与遗漏',
  },
  {
    icon: <Timer className="w-8 h-8" />,
    title: '时间压力',
    desc: '在有限时间内做出最优决策，挑战高分记录',
  },
]

export default function StartScreen() {
  const startGame = useGameStore(s => s.startGame)

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-[#0D0D1A] via-[#1A1A2E] to-[#0D0D1A] flex items-center justify-center">
      <div className="max-w-lg w-full mx-4 text-center">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#F0A500] to-[#FF6B35] mb-3">
          3D餐厅动线挑战
        </h1>
        <p className="text-white/60 text-lg mb-10">
          规划服务员路线，避免出餐与收台动线冲突
        </p>

        <div className="grid grid-cols-3 gap-4 mb-10">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-[#F0A500]/30 transition-colors"
            >
              <div className="text-[#F0A500] mb-2 flex justify-center">{f.icon}</div>
              <h3 className="text-white font-bold text-sm mb-1">{f.title}</h3>
              <p className="text-white/40 text-xs">{f.desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={startGame}
          className="bg-[#F0A500] hover:bg-[#FFB820] text-black font-bold text-lg px-10 py-4 rounded-xl shadow-lg shadow-[#F0A500]/20 hover:shadow-[#F0A500]/40 transition-all hover:scale-105 active:scale-95"
        >
          <span className="flex items-center gap-2">
            <Play className="w-6 h-6" />
            开始挑战
          </span>
        </button>

        <div className="mt-10 bg-white/5 rounded-xl p-5 border border-white/10 text-left">
          <h3 className="text-white font-bold text-sm mb-3 text-center">游戏规则</h3>
          <ul className="text-white/50 text-xs space-y-1.5">
            <li>• 客人随机下单，选择空闲服务员分配出餐任务</li>
            <li>• 用餐完毕后需及时收台，超时将扣分</li>
            <li>• 避免送餐与收台路线交叉，交叉将触发风险记录</li>
            <li>• 调整任务优先级，合理安排服务员工作顺序</li>
            <li>• 3分钟内获得最高分数，起始1000分，风险扣分</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
