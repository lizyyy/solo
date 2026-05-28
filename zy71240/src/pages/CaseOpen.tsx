import { useParams, useNavigate } from "react-router-dom"
import { useGameStore } from "@/store/gameStore"
import { CASES } from "@/data/mockData"
import { Car, Calendar, Shield, FileText, ArrowRight } from "lucide-react"

export default function CaseOpen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const startGame = useGameStore((s) => s.startGame)
  const session = useGameStore((s) => s.session)

  const currentCase = CASES.find((c) => c.id === id)

  if (!currentCase) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <p className="text-cool text-lg">未找到该案例</p>
      </div>
    )
  }

  const handleStart = () => {
    const playerName = session?.playerName || "匿名定损员"
    if (!session || session.caseId !== currentCase.id) {
      startGame(currentCase.id, playerName)
    }
    useGameStore.getState().goToPhase("clues")
    navigate(`/case/${currentCase.id}/clues`)
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="w-full">
        <img
          src={currentCase.photoUrl}
          alt="事故现场"
          className="w-full h-64 object-cover"
        />
      </div>

      <div className="container max-w-2xl px-4 py-6">
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <span>案件信息</span>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-center gap-3">
              <span className="bg-steel-500 text-white text-sm font-bold px-3 py-1 rounded">
                {currentCase.caseNumber}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center gap-2 text-steel-500">
                <Calendar className="w-4 h-4 text-cool" />
                <span className="text-cool">事故日期：</span>
                <span className="font-medium">{currentCase.accidentDate}</span>
              </div>
              <div className="flex items-center gap-2 text-steel-500">
                <Car className="w-4 h-4 text-cool" />
                <span className="text-cool">车辆型号：</span>
                <span className="font-medium">{currentCase.carModel}</span>
              </div>
              <div className="flex items-center gap-2 text-steel-500">
                <Shield className="w-4 h-4 text-cool" />
                <span className="text-cool">保险类型：</span>
                <span className="font-medium">{currentCase.insuranceType}</span>
              </div>
            </div>
            <p className="text-cool text-sm leading-relaxed border-t border-steel-50 pt-3">
              {currentCase.description}
            </p>
          </div>
        </div>

        <button
          onClick={handleStart}
          className="mt-6 w-full btn-amber flex items-center justify-center gap-2 py-3 text-lg"
        >
          开始定损
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
