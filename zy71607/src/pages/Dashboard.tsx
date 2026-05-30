import StatusChart from '@/components/dashboard/StatusChart'
import MatchRateChart from '@/components/dashboard/MatchRateChart'
import ExceptionChart from '@/components/dashboard/ExceptionChart'
import TaskList from '@/components/dashboard/TaskList'
import Sidebar from '@/components/layout/Sidebar'

export default function Dashboard() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-surface-100">续保报价比对</h2>
          <p className="text-xs text-surface-400 mt-1">点击图表元素可跳转至对应业务线详情</p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <StatusChart />
          <MatchRateChart />
          <ExceptionChart />
          <TaskList />
        </div>
      </main>
    </div>
  )
}
