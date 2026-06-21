import React, { useMemo } from 'react'
import { useStationStore } from '@/store/stationStore'
import StationRow from './StationRow'
import AnimatedNumber from '@/components/ui/AnimatedNumber'

const StationList: React.FC = () => {
  const { records, searchKeyword, getLatestByStation } = useStationStore()

  const latestList = useMemo(() => getLatestByStation(), [records, getLatestByStation])

  const filtered = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase()
    if (!kw) return latestList
    return latestList.filter(
      (r) =>
        r.station_code.toLowerCase().includes(kw) ||
        r.station_name.toLowerCase().includes(kw),
    )
  }, [latestList, searchKeyword])

  const stats = useMemo(() => {
    const total = latestList.length
    const anomaly = latestList.filter(
      (r) => r.time_conflict || r.result_abnormal,
    ).length
    const cloud = latestList.filter((r) => r.cloud_impact !== '无').length
    return { total, anomaly, cloud }
  }, [latestList])

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-4 border-b border-deepsea-600/40">
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-lg px-3 py-3 text-center border border-deepsea-500/30">
            <AnimatedNumber
              value={stats.total}
              duration={900}
              className="font-display font-bold text-2xl text-teal-glow drop-shadow-[0_0_6px_rgba(0,212,170,0.55)]"
            />
            <p className="text-[11px] text-deepsea-200/80 mt-1 tracking-wide">
              总站点数
            </p>
          </div>
          <div className="glass rounded-lg px-3 py-3 text-center border border-deepsea-500/30">
            <AnimatedNumber
              value={stats.anomaly}
              duration={900}
              className="font-display font-bold text-2xl text-alert-red drop-shadow-[0_0_6px_rgba(255,90,95,0.55)]"
            />
            <p className="text-[11px] text-deepsea-200/80 mt-1 tracking-wide">
              异常站点
            </p>
          </div>
          <div className="glass rounded-lg px-3 py-3 text-center border border-deepsea-500/30">
            <AnimatedNumber
              value={stats.cloud}
              duration={900}
              className="font-display font-bold text-2xl text-alert-yellow drop-shadow-[0_0_6px_rgba(255,183,3,0.55)]"
            />
            <p className="text-[11px] text-deepsea-200/80 mt-1 tracking-wide">
              有云遮
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center justify-between text-[11px] text-deepsea-200/70 border-b border-deepsea-600/30">
        <span>
          共{' '}
          <span className="text-teal-glow font-mono font-semibold">
            {filtered.length}
          </span>{' '}
          条结果
          {searchKeyword && (
            <span className="ml-2 text-alert-yellow/90">
              （搜索: "{searchKeyword}"）
            </span>
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-deepsea-300/70 px-6 text-center">
            <div className="text-4xl mb-3 opacity-70">🔍</div>
            <p className="text-[13px]">没有匹配的站点</p>
            <p className="text-[11px] mt-1 opacity-80">请尝试更换关键词</p>
          </div>
        ) : (
          filtered.map((record) => (
            <StationRow key={record.id} record={record} />
          ))
        )}
      </div>
    </div>
  )
}

export default StationList
