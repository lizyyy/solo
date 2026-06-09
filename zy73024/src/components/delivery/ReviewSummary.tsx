import { Link } from 'react-router-dom'
import { reviewDecisions } from '../../data/mockTraces'
import { pets } from '../../data/mockPets'
import { useAppStore } from '../../store/useAppStore'
import Badge from '../common/Badge'

export default function ReviewSummary() {
  const deliveryMode = useAppStore((s) => s.deliveryMode)

  const grouped = reviewDecisions.reduce<Record<string, typeof reviewDecisions>>((acc, d) => {
    if (!acc[d.reviewer]) acc[d.reviewer] = []
    acc[d.reviewer].push(d)
    return acc
  }, {})

  const total = reviewDecisions.length
  const uniquePetIds = new Set(reviewDecisions.map((d) => d.petId))
  const reviewers = Object.keys(grouped)

  const getPetName = (petId: string) => pets.find((p) => p.id === petId)?.name ?? petId

  const parseRate = (r: string): number | null => {
    const m = r.match(/-?\d+\.?\d*%/)
    if (!m) return null
    return parseFloat(m[0])
  }

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([reviewer, decisions]) => {
        const signature = decisions[0]?.signatureEmoji ?? '✍️'
        return (
          <div key={reviewer} className="card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-clay-100">
              <h3 className="font-kai text-xl text-clay-800 flex items-center gap-2">
                <span className="text-2xl">{signature}</span>
                判读人: {reviewer}
                <Badge variant="clay" size="md">
                  共 {decisions.length} 次判读
                </Badge>
              </h3>
            </div>

            <div className="space-y-3">
              {decisions.map((d) => {
                const beforeRate = parseRate(d.beforeRate)
                const afterRate = parseRate(d.afterRate)
                const delta =
                  beforeRate !== null && afterRate !== null
                    ? afterRate - beforeRate
                    : null
                const isNumericChange = d.beforeWeight !== 0 || d.afterWeight !== 0

                return (
                  <div
                    key={d.id}
                    className="p-4 rounded-xl bg-paper-deep/50 border border-clay-100"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm text-clay-500 num">{d.reviewedAt}</span>
                          {deliveryMode ? (
                            <span className="font-bold text-clay-800">{getPetName(d.petId)}</span>
                          ) : (
                            <Link
                              to={`/pet/${d.petId}`}
                              className="font-bold text-clay-800 hover:text-clay-600"
                            >
                              {getPetName(d.petId)}
                            </Link>
                          )}
                          <Badge variant="sage" size="sm">
                            人工改判
                          </Badge>
                        </div>

                        <div className="mt-2 text-sm text-clay-700 leading-relaxed">
                          <span className="text-clay-500">改判理由: </span>
                          {d.reason}
                        </div>

                        <div className="mt-3 flex items-center gap-6 flex-wrap">
                          {isNumericChange ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-clay-500">体重对比:</span>
                              <span className="px-2 py-1 bg-rust-50 text-rust-700 rounded-md text-sm font-medium num">
                                {d.beforeWeight.toFixed(1)}kg
                              </span>
                              <span className="text-clay-400">→</span>
                              <span className="px-2 py-1 bg-sage-50 text-sage-700 rounded-md text-sm font-medium num">
                                {d.afterWeight.toFixed(1)}kg
                              </span>
                              {d.beforeWeight !== d.afterWeight && (
                                <span
                                  className={`text-xs font-bold num ${
                                    d.afterWeight < d.beforeWeight ? 'text-sage-600' : 'text-rust-600'
                                  }`}
                                >
                                  {d.afterWeight < d.beforeWeight ? '-' : '+'}
                                  {Math.abs(d.afterWeight - d.beforeWeight).toFixed(1)}kg
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-clay-500">数值对比:</span>
                              <span className="px-2 py-1 bg-clay-50 text-clay-700 rounded-md text-sm font-medium">
                                档案合并,无数值改判
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-clay-500">减重率:</span>
                            <span className="px-2 py-1 bg-rust-50 text-rust-700 rounded-md text-sm num">
                              {d.beforeRate}
                            </span>
                            <span className="text-clay-400">→</span>
                            <span className="px-2 py-1 bg-sage-50 text-sage-700 rounded-md text-sm num">
                              {d.afterRate}
                            </span>
                            {delta !== null && (
                              <span
                                className={`text-xs font-bold num ${
                                  delta > 0 ? 'text-sage-600' : delta < 0 ? 'text-rust-600' : 'text-clay-500'
                                }`}
                              >
                                Δ {delta > 0 ? '+' : ''}
                                {delta.toFixed(1)}pp
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="card p-5 bg-gradient-to-r from-paper to-paper-deep">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 font-kai text-lg text-clay-800">
            <span className="text-2xl">📋</span>
            <span>
              合计人工改判 <span className="num text-clay-700 font-bold">{total}</span> 次
              <span className="mx-2 text-clay-300">·</span>
              涉及 <span className="num text-clay-700 font-bold">{uniquePetIds.size}</span> 只宠物
            </span>
          </div>
          <div className="text-sm text-clay-600">
            判读人: <span className="font-medium text-clay-800">{reviewers.join('、')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
