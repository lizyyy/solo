import { pets } from '../../data/mockPets'
import { useAppStore } from '../../store/useAppStore'
import StatusTag from '../common/StatusTag'
import Badge from '../common/Badge'

export default function DeliveryTable() {
  const deliveryMode = useAppStore((s) => s.deliveryMode)
  const textSize = deliveryMode ? 'text-lg' : 'text-base'

  const avgRate =
    pets.reduce((sum, p) => {
      const rate = ((p.startWeight - p.currentWeight) / p.startWeight) * 100
      return sum + rate
    }, 0) / pets.length

  return (
    <div className="rounded-xl overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-clay to-clay-500 text-white font-medium">
              <th className={`px-4 py-3 text-left ${textSize}`}>序号</th>
              <th className={`px-4 py-3 text-left ${textSize}`}>宠物</th>
              <th className={`px-4 py-3 text-right ${textSize}`}>入站体重</th>
              <th className={`px-4 py-3 text-right ${textSize}`}>当前体重</th>
              <th className={`px-4 py-3 text-right ${textSize}`}>目标体重</th>
              <th className={`px-4 py-3 text-right ${textSize}`}>减重kg</th>
              <th className={`px-4 py-3 text-right ${textSize}`}>减重率</th>
              <th className={`px-4 py-3 text-center ${textSize}`}>异常数</th>
              <th className={`px-4 py-3 text-center ${textSize}`}>处理状态</th>
              <th className={`px-4 py-3 text-left ${textSize}`}>结论置信度</th>
            </tr>
          </thead>
          <tbody>
            {pets.map((pet, idx) => {
              const weightLoss = pet.startWeight - pet.currentWeight
              const lossRate = (weightLoss / pet.startWeight) * 100
              const isAnomaly = pet.anomalyCount > 0
              const lossColor = weightLoss < 0 ? 'text-rust-600' : 'text-sage-600'

              return (
                <tr
                  key={pet.id}
                  className={`${textSize} border-b border-clay-100 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-paper/50'
                  } ${isAnomaly ? 'bg-rust-50' : ''}`}
                >
                  <td className="px-4 py-3 text-clay-800 font-medium num">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{pet.avatarEmoji}</span>
                      <div>
                        <span className="font-bold text-clay-900">{pet.name}</span>
                        {pet.aliases.length > 0 && (
                          <span className="text-clay-500 text-sm ml-1">
                            ({pet.aliases.slice(0, 2).join('、')}
                            {pet.aliases.length > 2 ? '…' : ''})
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-clay-800 num">
                    {pet.startWeight.toFixed(1)}kg
                  </td>
                  <td className="px-4 py-3 text-right text-clay-800 num">
                    {pet.currentWeight.toFixed(1)}kg
                  </td>
                  <td className="px-4 py-3 text-right text-clay-600 num">
                    {pet.targetWeight ? `${pet.targetWeight.toFixed(1)}kg` : '-'}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold num ${lossColor}`}>
                    {weightLoss >= 0 ? '-' : '+'}
                    {Math.abs(weightLoss).toFixed(1)}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold num ${lossColor}`}>
                    {lossRate >= 0 ? '-' : '+'}
                    {Math.abs(lossRate).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pet.anomalyCount > 0 ? (
                      <Badge variant="rust" size={deliveryMode ? 'md' : 'sm'}>
                        {pet.anomalyCount}
                      </Badge>
                    ) : (
                      <span className="text-clay-400 text-sm">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusTag status={pet.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1 h-2 bg-clay-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-clay-400 to-clay rounded-full transition-all"
                          style={{ width: `${pet.confidenceScore}%` }}
                        />
                      </div>
                      <span className="num text-sm font-bold text-clay-700 w-10 text-right">
                        {pet.confidenceScore}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
            <tr className={`bg-gradient-to-r from-paper to-paper-deep ${textSize}`}>
              <td colSpan={6} className="px-4 py-3 font-kai font-bold text-clay-800">
                📊 合计
              </td>
              <td className="px-4 py-3 text-right font-bold text-sage-700 num">
                {avgRate >= 0 ? '-' : '+'}
                {Math.abs(avgRate).toFixed(1)}%
              </td>
              <td className="px-4 py-3 text-center text-clay-500 text-sm" colSpan={3}>
                平均减重率
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-paper-deep/60 text-xs text-clay-600 border-t border-clay-100">
        异常行已高亮 · 置信度基于异常严重度和人工改判数自动估算
      </div>
    </div>
  )
}
