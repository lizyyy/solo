import { useState } from 'react'
import { useScanStore } from '@/store/useScanStore'
import { useLineageStore } from '@/store/useLineageStore'

interface ScanInputProps {
  onScan: () => void
}

export default function ScanInput({ onScan }: ScanInputProps) {
  const { query, setQuery, executeScan, clearResults, results, hasScanned } = useScanStore()
  const { changeOrders } = useLineageStore()
  const [showChangeOrders, setShowChangeOrders] = useState(false)

  const handleScan = () => {
    onScan()
  }

  const handleChangeOrderSelect = (fieldId: string) => {
    setQuery(fieldId)
    setShowChangeOrders(false)
  }

  return (
    <div className="w-80 bg-base-800 border-r border-base-600 h-full p-4 flex flex-col gap-4">
      <h2 className="font-mono text-lg text-white">变更字段</h2>

      <div>
        <label className="text-sm text-muted mb-1 block">字段名</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="请输入字段名或别名"
          className="bg-base-700 border border-base-600 rounded px-3 py-2 text-sm w-full text-white placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleScan}
          className="bg-accent text-base-900 font-bold px-4 py-2 rounded text-sm hover:bg-accent/90 transition-colors"
        >
          开始扫描
        </button>
        <button
          onClick={clearResults}
          className="bg-base-600 text-gray-300 px-4 py-2 rounded text-sm hover:bg-base-600/80 transition-colors"
        >
          清除
        </button>
      </div>

      <div>
        <p className="text-sm text-muted mb-2">快速填充</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setQuery('user_order.amount')}
            className="text-left text-sm text-accent hover:text-accent/80 bg-base-700 px-3 py-2 rounded border border-base-600 hover:border-accent/50 transition-colors"
          >
            user_order.amount (精度变更)
          </button>
          <button
            onClick={() => setQuery('etl_meta._etl_batch_id')}
            className="text-left text-sm text-accent hover:text-accent/80 bg-base-700 px-3 py-2 rounded border border-base-600 hover:border-accent/50 transition-colors"
          >
            etl_meta._etl_batch_id (隐藏字段)
          </button>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setShowChangeOrders(!showChangeOrders)}
          className="w-full text-left text-sm text-white bg-base-700 px-3 py-2 rounded border border-base-600 hover:border-accent/50 transition-colors"
        >
          从变更单导入 ↓
        </button>
        {showChangeOrders && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-base-700 border border-base-600 rounded z-10 max-h-48 overflow-y-auto">
          {changeOrders.map((order) => (
            <button
              key={order.id}
              onClick={() => handleChangeOrderSelect(order.fieldIds[0])}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-base-600 border-b border-base-600 last:border-b-0"
            >
              {order.title}
            </button>
          ))}
        </div>
        )}
      </div>

      {hasScanned && (
        <div className="bg-accent-glow border border-accent/30 rounded p-3">
          <p className="text-sm text-accent">
            扫描完成，发现 {results.length} 个受影响节点
          </p>
        </div>
      )}
    </div>
  )
}
