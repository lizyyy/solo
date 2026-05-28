import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Lock, Download, Upload, Trophy, ScrollText, Gavel } from 'lucide-react'
import { useGameStore } from '@/store'
import lots from '@/data/lots'
import type { LotProgress } from '@/types'
import ProfileManager from '@/components/ProfileManager'

function getLotStatus(progress: LotProgress | null) {
  if (!progress) return '未开始' as const
  if (progress.completedAt) return '已完成' as const
  if (progress.readDocuments.length > 0 || progress.collectedClues.length > 0 || progress.valuation) {
    return '进行中' as const
  }
  return '未开始' as const
}

function StatusBadge({ status }: { status: ReturnType<typeof getLotStatus> }) {
  const config = {
    '未开始': 'bg-wood-700/60 text-parchment-dark border-parchment-dark/30',
    '进行中': 'bg-gold/15 text-gold-light border-gold/40',
    '已完成': 'bg-jade/20 text-jade-light border-jade/40',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-sm text-xs font-serif tracking-wider border ${config[status]}`}>
      {status}
    </span>
  )
}

function DifficultyStars({ difficulty }: { difficulty: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((level) => (
        <Star
          key={level}
          className={`w-3.5 h-3.5 ${
            level <= difficulty ? 'text-gold fill-gold' : 'text-wood-600'
          }`}
        />
      ))}
    </div>
  )
}

export default function Lobby() {
  const navigate = useNavigate()
  const { activeProfileId, profiles, getLotProgress, exportAllData, importData } = useGameStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeProfile = profiles.find(p => p.profileId === activeProfileId)
  const hasActiveProfile = !!activeProfileId && !!activeProfile

  const totalScore = activeProfile?.totalScore ?? 0

  const handleExport = () => {
    const json = exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auction-challenge-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const success = importData(text)
      if (!success) {
        alert('导入失败，请检查文件格式')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleLotClick = (lotId: string) => {
    if (!hasActiveProfile) return
    navigate(`/case/${lotId}`)
  }

  return (
    <div className="min-h-screen wood-panel">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-wood-900/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(201,168,76,0.12)_0%,transparent_60%)]" />

        <div className="relative z-10">
          <header className="flex items-center justify-between px-6 py-4 border-b border-gold/15">
            <div className="flex items-center gap-3">
              <Gavel className="w-6 h-6 text-gold" />
              <span className="font-serif text-gold-light tracking-widest text-sm">AUCTION HOUSE</span>
            </div>
            <ProfileManager />
          </header>

          <section className="py-16 px-6 text-center">
            <div className="max-w-2xl mx-auto">
              <div className="mb-4">
                <ScrollText className="w-10 h-10 text-gold/60 mx-auto mb-4" />
              </div>
              <h1 className="font-serif text-5xl md:text-6xl tracking-wider gold-shimmer mb-4">
                拍卖行估价闯关
              </h1>
              <p className="font-body text-xl md:text-2xl text-parchment-dark tracking-[0.3em]">
                审材料 · 识陷阱 · 估价值
              </p>
              <div className="mt-6 flex items-center justify-center gap-1">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/40" />
                <div className="w-2 h-2 rotate-45 border border-gold/40" />
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/40" />
              </div>
            </div>
          </section>

          {!hasActiveProfile && (
            <section className="px-6 pb-10">
              <div className="max-w-lg mx-auto parchment-card relative rounded-sm p-6 text-center">
                <Lock className="w-8 h-8 text-seal mx-auto mb-3" />
                <h3 className="font-serif text-lg text-ink mb-2 tracking-wide">请先创建鉴定师</h3>
                <p className="font-body text-sm text-ink/70 mb-4">
                  点击右上角「选择鉴定师」创建您的鉴定师身份，方可开始闯关挑战
                </p>
              </div>
            </section>
          )}

          {hasActiveProfile && (
            <section className="px-6 pb-8">
              <div className="max-w-3xl mx-auto flex items-center justify-center gap-6">
                <div className="flex items-center gap-2 px-4 py-2 gold-border rounded-sm bg-wood-800/30">
                  <Trophy className="w-5 h-5 text-gold" />
                  <div>
                    <p className="text-parchment-dark text-xs font-body">鉴定师</p>
                    <p className="text-gold-light font-serif tracking-wide">{activeProfile!.profileName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 gold-border rounded-sm bg-wood-800/30">
                  <Star className="w-5 h-5 text-gold fill-gold" />
                  <div>
                    <p className="text-parchment-dark text-xs font-body">总分</p>
                    <p className="text-gold-light font-serif tracking-wide">{totalScore}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="px-6 pb-12">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-gold/30 to-transparent" />
                <h2 className="font-serif text-xl text-gold-light tracking-widest">拍品一览</h2>
                <div className="h-px flex-1 bg-gradient-to-l from-gold/30 to-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {lots.map((lot) => {
                  const progress = getLotProgress(lot.id)
                  const status = getLotStatus(progress)
                  const score = progress?.score ?? 0

                  return (
                    <button
                      key={lot.id}
                      onClick={() => handleLotClick(lot.id)}
                      disabled={!hasActiveProfile}
                      className={`group relative parchment-card rounded-sm overflow-hidden
                                 transition-all duration-500 text-left
                                 ${hasActiveProfile
                                   ? 'hover:shadow-2xl hover:shadow-gold/10 hover:-translate-y-1 cursor-pointer'
                                   : 'opacity-60 cursor-not-allowed'}`}
                    >
                      <div className="relative h-52 overflow-hidden">
                        <img
                          src={lot.image}
                          alt={lot.name}
                          className="w-full h-full object-cover transition-transform duration-700
                                     group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
                        <div className="absolute top-3 right-3">
                          <DifficultyStars difficulty={lot.difficulty} />
                        </div>
                        <div className="absolute top-3 left-3">
                          <StatusBadge status={status} />
                        </div>
                        {status === '已完成' && (
                          <div className="absolute bottom-3 right-3 flex items-center gap-1
                                          bg-jade/80 text-parchment px-2 py-0.5 rounded-sm text-xs font-serif">
                            <Trophy className="w-3 h-3" />
                            <span>{score}分</span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 relative">
                        <h3 className="font-serif text-lg text-ink tracking-wide mb-1 group-hover:text-seal transition-colors">
                          {lot.name}
                        </h3>
                        <p className="font-body text-sm text-ink/60 tracking-wider">
                          {lot.subtitle}
                        </p>

                        {status === '进行中' && (
                          <div className="mt-3 pt-3 border-t border-ink/10">
                            <div className="flex items-center justify-between text-xs font-body text-ink/50">
                              <span>已读 {progress!.readDocuments.length}/{lot.documents.length} 份文档</span>
                              <span>已收集 {progress!.collectedClues.length} 条线索</span>
                            </div>
                            <div className="mt-2 h-1 bg-ink/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-gold-dark to-gold rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.round(
                                    (progress!.readDocuments.length / lot.documents.length) * 100
                                  )}%`
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {status === '未开始' && hasActiveProfile && (
                          <div className="mt-3 pt-3 border-t border-ink/10">
                            <p className="text-xs font-body text-ink/40 tracking-wider">
                              点击开始鉴定挑战
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="px-6 pb-12">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-gold/20 to-transparent" />
                <h2 className="font-serif text-base text-gold/60 tracking-widest">数据管理</h2>
                <div className="h-px flex-1 bg-gradient-to-l from-gold/20 to-transparent" />
              </div>

              <div className="flex items-center justify-center gap-4">
                <button onClick={handleExport} className="btn-gold text-sm flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  导出数据
                </button>
                <button onClick={handleImport} className="btn-gold text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  导入数据
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </section>

          <footer className="py-6 text-center border-t border-gold/10">
            <p className="text-parchment-dark/40 text-xs font-body tracking-wider">
              AUCTION HOUSE VALUATION CHALLENGE
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
