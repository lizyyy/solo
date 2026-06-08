import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { loadSampleData } from '@/lib/sample-data'

export default function AppInit({ children }: { children: React.ReactNode }) {
  const loadData = useStore(s => s.loadData)
  const runMergeDetection = useStore(s => s.runMergeDetection)
  const runConflictDetection = useStore(s => s.runConflictDetection)
  const [ready, setReady] = useState(false)
  const initiated = useRef(false)

  useEffect(() => {
    if (initiated.current) return
    initiated.current = true
    ;(async () => {
      const loaded = await loadSampleData()
      await loadData()
      if (loaded) {
        await runMergeDetection()
        await runConflictDetection()
      }
      setReady(true)
    })()
  }, [loadData, runMergeDetection, runConflictDetection])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-400 text-sm">加载中…</div>
      </div>
    )
  }

  return <>{children}</>
}
