import { useNavigate } from "react-router-dom"
import { Play, Trophy } from "lucide-react"
import { useLevelStore } from "@/stores/levelStore"
import { useSummaryStore } from "@/stores/summaryStore"
import LevelCard from "@/components/LevelCard"
import InstructionsPanel from "@/components/InstructionsPanel"
import StatsCard from "@/components/StatsCard"

export default function Home() {
  const navigate = useNavigate()
  const { levelPacks, selectedLevelPackId, setSelectedLevelPack } = useLevelStore()
  const { getSummary } = useSummaryStore()
  const summary = getSummary()

  const selectedPack = levelPacks.find((p) => p.id === selectedLevelPackId)

  const handleStart = () => {
    navigate("/training")
  }

  return (
    <div className="container py-8 space-y-8">
      <div className="text-center py-8 animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-brand-400/10 text-brand-300 px-4 py-2 rounded-full text-sm font-medium mb-4">
          <Trophy className="w-4 h-4" />
          课堂训练 · 投影大屏模式
        </div>
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
          AI客服训练营
        </h1>
        <p className="text-xl text-slate-400 max-w-xl mx-auto">
          每局 1-2 分钟，练完就能上手。例外不丢，反馈到位，投影大屏也能看清每一步。
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={Trophy}
          label="训练局数"
          value={summary.totalRecords}
          color="info"
        />
        <StatsCard
          icon={Trophy}
          label="通过率"
          value={summary.passRate}
          valueSuffix="%"
          color={summary.passRate >= 70 ? "success" : "warning"}
        />
        <StatsCard
          icon={Play}
          label="平均用时"
          value={summary.avgDuration}
          valueSuffix="秒"
          color="info"
        />
        <StatsCard
          icon={Trophy}
          label="异常记录"
          value={summary.exceptionCount}
          color={summary.exceptionCount > 0 ? "danger" : "success"}
        />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">选择训练关卡</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {levelPacks.map((pack) => (
            <LevelCard
              key={pack.id}
              pack={pack}
              selected={pack.id === selectedLevelPackId}
              onSelect={() => setSelectedLevelPack(pack.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleStart}
          disabled={!selectedPack}
          className="btn btn-primary text-lg px-12 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-5 h-5" />
          开始训练 · {selectedPack?.name}
        </button>
      </div>

      <InstructionsPanel />

      <div className="card p-6 border border-brand-400/30 bg-brand-400/5">
        <h3 className="font-bold mb-2 text-brand-300">📋 样例数据说明</h3>
        <p className="text-sm text-slate-400 mb-3">
          系统预置了 3 条样例记录，覆盖了课堂常见场景：
        </p>
        <ul className="text-sm text-slate-300 space-y-2">
          <li className="flex items-start gap-2">
            <span className="tag tag-success flex-shrink-0 mt-0.5">顺利</span>
            <span>一条全程顺利的记录，5 题全对，得分 95，一次通过</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="tag tag-warning flex-shrink-0 mt-0.5">待确认</span>
            <span>一条含边界选择 + 一次主动暂停的记录，得分 70，需人工确认</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="tag tag-info flex-shrink-0 mt-0.5">补录</span>
            <span>一条从投影大屏补来的旧口径记录，已补录备注，分数从 80 调整为 65，差异清晰可见</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
