import ActionBar from './ActionBar'
import MatchingPanel from './MatchingPanel'
import GanttChart from './GanttChart'
import TrialPanel from './TrialPanel'
import GapWarningsPanel from './GapWarningsPanel'

export default function SchedulingPage() {
  return (
    <div className="min-h-screen bg-[#0f1219] text-white">
      <div className="px-6 py-4 border-b border-white/5 bg-[#0f1219]">
        <ActionBar />
      </div>

      <div className="flex gap-4 p-6">
        <div className="flex-1 min-w-0 space-y-4">
          <MatchingPanel />
          <GanttChart />
          <TrialPanel />
        </div>

        <div className="w-[300px] shrink-0">
          <GapWarningsPanel />
        </div>
      </div>
    </div>
  )
}
