import { Link } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

export default function DeliveryToggle() {
  const deliveryMode = useAppStore((s) => s.deliveryMode)
  const setDeliveryMode = useAppStore((s) => s.setDeliveryMode)

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-xl overflow-hidden border border-clay-200 shadow-sm">
        <button
          onClick={() => setDeliveryMode(false)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            !deliveryMode
              ? 'bg-clay text-white'
              : 'bg-white text-clay-700 hover:bg-clay-50'
          }`}
        >
          📝 编辑视图
        </button>
        <button
          onClick={() => setDeliveryMode(true)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            deliveryMode
              ? 'bg-clay text-white'
              : 'bg-white text-clay-700 hover:bg-clay-50'
          }`}
        >
          📺 交接视图
        </button>
      </div>
      {deliveryMode && (
        <Link
          to="/dashboard"
          onClick={() => setDeliveryMode(false)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sage text-white rounded-xl shadow-btn hover:bg-sage-600 active:translate-y-[1px] active:shadow-none transition-all text-sm font-medium"
        >
          🔙 返回追踪汇总
        </Link>
      )}
    </div>
  )
}
