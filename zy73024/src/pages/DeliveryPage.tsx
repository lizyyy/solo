import { pets } from '../data/mockPets'
import { anomalies } from '../data/mockAnomalies'
import { useAppStore } from '../store/useAppStore'
import DeliveryToggle from '../components/delivery/DeliveryToggle'
import DeliveryTable from '../components/delivery/DeliveryTable'
import DeliveryCardGrid from '../components/delivery/DeliveryCardGrid'
import ReviewSummary from '../components/delivery/ReviewSummary'

export default function DeliveryPage() {
  const deliveryMode = useAppStore((s) => s.deliveryMode)
  const anomalyCount = anomalies.length

  const animClass = deliveryMode ? 'animate-zoom-in' : ''

  return (
    <div className={animClass}>
      <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
        <div>
          <h1 className="font-kai text-3xl text-clay-700 mb-2">
            📤 宠物减重回访追踪 · 交付说明
          </h1>
          <p className="text-sm text-clay-500">
            适用于救助站同事交接 / 向领养人同步情况 / 归档截图 · 共生成{' '}
            <span className="font-bold num text-clay-700">{pets.length}</span> 条档案 /{' '}
            <span className="font-bold num text-rust-600">{anomalyCount}</span> 条异常说明
          </p>
        </div>
        <DeliveryToggle />
      </div>

      <section className="mb-10">
        <div className="mb-5">
          <h2 className="font-kai text-2xl text-clay-800 tracking-wide pb-2 border-b-2 border-clay-200 inline-block">
            📋 汇总总表
          </h2>
        </div>
        <DeliveryTable />
      </section>

      <section className="mb-10">
        <div className="mb-5">
          <h2 className="font-kai text-2xl text-clay-800 tracking-wide pb-2 border-b-2 border-clay-200 inline-block">
            🖼️ 异常截图说明卡
          </h2>
        </div>
        <DeliveryCardGrid />
      </section>

      <section>
        <div className="mb-5">
          <h2 className="font-kai text-2xl text-clay-800 tracking-wide pb-2 border-b-2 border-clay-200 inline-block">
            ✍️ 人工改判说明
          </h2>
        </div>
        <ReviewSummary />
      </section>
    </div>
  )
}
