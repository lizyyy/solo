import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useGameStore } from "@/store/gameStore"
import { CASES } from "@/data/mockData"
import { Car, Calendar, Shield, ChevronRight, User, Trophy } from "lucide-react"

export default function Home() {
  const navigate = useNavigate()
  const startGame = useGameStore((s) => s.startGame)
  const [playerName, setPlayerName] = useState("")

  const handleCaseClick = (caseId: string) => {
    const name = playerName.trim() || "匿名定损员"
    startGame(caseId, name)
    navigate(`/case/${caseId}`)
  }

  return (
    <div className="min-h-screen bg-cream">
      <section className="bg-gradient-to-b from-steel-700 to-steel-500 text-white py-16 px-4">
        <div className="container max-w-3xl text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-10 h-10 text-amber" />
            <h1 className="font-serif text-4xl font-bold tracking-wide">
              保险定损快拍赛
            </h1>
          </div>
          <p className="text-steel-200 text-lg leading-relaxed">
            通过真实案例模拟，训练你的保险定损判断力——识别旧伤、把控条款、精准定损
          </p>
          <div className="mt-8 flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5 text-amber" />
            <span className="text-amber font-medium">3 个精选案例等你挑战</span>
          </div>
        </div>
      </section>

      <section className="container max-w-3xl px-4 py-8">
        <div className="mb-6">
          <label className="block font-serif text-lg font-bold text-steel-500 mb-2">
            定损员姓名
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cool" />
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="请输入姓名（可选）"
              className="w-full pl-11 pr-4 py-3 rounded-lg border border-steel-50 bg-white text-steel-500 placeholder:text-cool/50 focus:outline-none focus:ring-2 focus:ring-amber/40 transition-shadow"
            />
          </div>
        </div>

        <h2 className="section-title">选择案例</h2>

        <div className="space-y-4">
          {CASES.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCaseClick(c.id)}
              className="w-full card flex items-center gap-4 p-4 text-left transition-all duration-200 hover:shadow-md hover:border-amber group cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-steel-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                    {c.caseNumber}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cool">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {c.accidentDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Car className="w-3.5 h-3.5" />
                    {c.carModel}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    {c.insuranceType}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-cool group-hover:text-amber transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
