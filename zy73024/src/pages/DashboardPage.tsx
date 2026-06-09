import SectionTitle from '../components/common/SectionTitle'
import OverviewBar from '../components/dashboard/OverviewBar'
import FilterPanel from '../components/dashboard/FilterPanel'
import PetGrid from '../components/dashboard/PetGrid'

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-zoom-in">
      <SectionTitle icon="📋" subtitle="追踪中的宠物档案概览，点击数字可快速筛选">
        追踪汇总
      </SectionTitle>

      <OverviewBar />

      <FilterPanel />

      <div className="pt-1">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-kai text-xl text-clay-800 tracking-wide">🎯 宠物档案列表</h2>
            <p className="text-xs text-clay-500 mt-0.5">点击卡片查看完整分析链路与异常详情</p>
          </div>
        </div>
        <PetGrid />
      </div>
    </div>
  )
}
