import { useState, useCallback } from 'react'
import { Settings2, AlignHorizontalSpaceAround } from 'lucide-react'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { alignCurves } from '@/utils/alignment'
import { cn } from '@/lib/utils'

export default function AlignmentControls() {
  const { filteredCurves, alignmentParams, setAlignmentParams, setFilteredCurves, setCurves } = useAnalysisStore()
  const [isAligning, setIsAligning] = useState(false)
  const [alignedCount, setAlignedCount] = useState(0)
  const [prevLengths, setPrevLengths] = useState<string>('')

  const handleAlign = useCallback(() => {
    if (filteredCurves.length === 0) return
    setIsAligning(true)

    const beforeLengths = filteredCurves.map((c) => c.strain.length)
    const beforeSummary = `${Math.min(...beforeLengths)}-${Math.max(...beforeLengths)}`
    setPrevLengths(beforeSummary)

    setTimeout(() => {
      const aligned = alignCurves(
        filteredCurves,
        alignmentParams.mode,
        alignmentParams.targetLength
      )

      const updated = filteredCurves.map((c, i) => ({
        ...c,
        alignedStrain: aligned[i].alignedStrain,
        alignedStress: aligned[i].alignedStress,
      }))

      setFilteredCurves(updated)
      setCurves(
        useAnalysisStore.getState().curves.map((c) => {
          const match = updated.find((u) => u.id === c.id)
          return match ? { ...c, alignedStrain: match.alignedStrain, alignedStress: match.alignedStress } : c
        })
      )

      setAlignedCount(updated.length)
      setIsAligning(false)
    }, 0)
  }, [filteredCurves, alignmentParams, setFilteredCurves, setCurves])

  return (
    <div className="rounded-xl border border-[#1B2A4A] bg-[#0F1923]/80 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Settings2 size={16} className="text-[#4A90D9]" />
        <h3 className="text-sm font-semibold text-[#E2E8F0]">曲线对齐</h3>
      </div>

      <div className="mb-4 flex gap-3">
        <button
          onClick={() => setAlignmentParams({ ...alignmentParams, mode: 'interpolation' })}
          className={cn(
            'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
            alignmentParams.mode === 'interpolation'
              ? 'border-[#4A90D9]/50 bg-[#4A90D9]/15 text-[#4A90D9]'
              : 'border-[#1B2A4A] text-[#64748B] hover:border-[#3A4A5C] hover:text-[#94A3B8]'
          )}
        >
          <AlignHorizontalSpaceAround size={14} className="mb-1.5 mx-auto" />
          线性插值
        </button>
        <button
          onClick={() => setAlignmentParams({ ...alignmentParams, mode: 'dtw' })}
          className={cn(
            'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
            alignmentParams.mode === 'dtw'
              ? 'border-[#4A90D9]/50 bg-[#4A90D9]/15 text-[#4A90D9]'
              : 'border-[#1B2A4A] text-[#64748B] hover:border-[#3A4A5C] hover:text-[#94A3B8]'
          )}
        >
          <AlignHorizontalSpaceAround size={14} className="mb-1.5 mx-auto" />
          动态时间规整
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-[#94A3B8]">目标长度</label>
          <span className="rounded bg-[#1B2A4A] px-2 py-0.5 font-mono text-xs text-[#4A90D9]">
            {alignmentParams.targetLength}
          </span>
        </div>
        <input
          type="range"
          min={50}
          max={200}
          step={10}
          value={alignmentParams.targetLength}
          onChange={(e) =>
            setAlignmentParams({ ...alignmentParams, targetLength: Number(e.target.value) })
          }
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#1B2A4A] accent-[#4A90D9]"
        />
      </div>

      <button
        onClick={handleAlign}
        disabled={isAligning || filteredCurves.length === 0}
        className={cn(
          'w-full rounded-lg px-4 py-2 text-xs font-semibold transition-all',
          isAligning || filteredCurves.length === 0
            ? 'cursor-not-allowed bg-[#1B2A4A]/50 text-[#64748B]'
            : 'bg-[#4A90D9] text-white hover:bg-[#3A7BC8] active:scale-[0.98]'
        )}
      >
        {isAligning ? '对齐中...' : '执行对齐'}
      </button>

      {alignedCount > 0 && (
        <div className="mt-3 rounded-lg bg-[#1B2A4A]/30 px-3 py-2 text-[11px] text-[#94A3B8]">
          已对齐 <span className="font-mono text-[#4A90D9]">{alignedCount}</span> 条曲线
          {prevLengths && (
            <span>
              ，原始长度 {prevLengths} → 目标长度 <span className="font-mono text-[#4A90D9]">{alignmentParams.targetLength}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
