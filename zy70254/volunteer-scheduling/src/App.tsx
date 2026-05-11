import { useState, useCallback, useMemo } from 'react'
import { Users, GraduationCap, Building2, Calendar, BarChart3, RefreshCw, RotateCcw, Heart } from 'lucide-react'
import { VolunteerList } from './components/volunteers/VolunteerList'
import { CampusList } from './components/campuses/CampusList'
import { CourseList } from './components/courses/CourseList'
import { ScheduleList } from './components/schedules/ScheduleList'
import { StatCard } from './components/common/StatCard'
import {
  getVolunteers,
  getCampuses,
  getCourses,
  getSchedules,
  resetAllData,
} from './services/dataService'
import { calculateStatistics } from './utils/export'
import type { Volunteer, Campus, Course, Schedule } from './types'

type TabType = 'dashboard' | 'volunteers' | 'campuses' | 'courses' | 'schedules'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const volunteers: Volunteer[] = useMemo(() => getVolunteers(), [refreshKey])
  const campuses: Campus[] = useMemo(() => getCampuses(), [refreshKey])
  const courses: Course[] = useMemo(() => getCourses(), [refreshKey])
  const schedules: Schedule[] = useMemo(() => getSchedules(), [refreshKey])

  const stats = useMemo(() => {
    return calculateStatistics(volunteers, campuses, courses, schedules)
  }, [volunteers, campuses, courses, schedules])

  const handleReset = () => {
    if (confirm('确定要重置所有数据吗？这将恢复到初始示例数据状态。')) {
      resetAllData()
      refresh()
      alert('数据已重置')
    }
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: '总览', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'volunteers', label: '助教档案', icon: <Users className="w-5 h-5" /> },
    { id: 'campuses', label: '校区约束', icon: <Building2 className="w-5 h-5" /> },
    { id: 'courses', label: '课程管理', icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'schedules', label: '排班管理', icon: <Calendar className="w-5 h-5" /> },
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Heart className="w-8 h-8" />
                    公益课堂助教排班台
                  </h2>
                  <p className="mt-2 text-blue-100">
                    按学科、校区和志愿时长智能排班，确保课程顺利进行
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={refresh}
                    className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    刷新
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    重置数据
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="助教总数"
                value={stats.totalVolunteers}
                icon={Users}
                color="blue"
              />
              <StatCard
                title="校区数量"
                value={stats.totalCampuses}
                icon={Building2}
                color="green"
              />
              <StatCard
                title="课程数量"
                value={stats.totalCourses}
                icon={GraduationCap}
                color="purple"
              />
              <StatCard
                title="总排班时长"
                value={`${stats.totalHours}h`}
                icon={Calendar}
                color="yellow"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">各学科时长分布</h3>
                <div className="space-y-3">
                  {Object.entries(stats.bySubject).length > 0 ? (
                    Object.entries(stats.bySubject)
                      .sort((a, b) => b[1] - a[1])
                      .map(([subject, hours]) => {
                        const max = Math.max(...Object.values(stats.bySubject), 1)
                        const percent = (hours / max) * 100
                        return (
                          <div key={subject} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">{subject}</span>
                              <span className="text-gray-500">{hours} 小时</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        )
                      })
                  ) : (
                    <p className="text-gray-500 text-sm">暂无数据</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">各校区时长分布</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byCampus).length > 0 ? (
                    Object.entries(stats.byCampus).map(([campusId, hours]) => {
                      const campus = campuses.find((c) => c.id === campusId)
                      const max = Math.max(...Object.values(stats.byCampus), 1)
                      const percent = (hours / max) * 100
                      return (
                        <div key={campusId} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">{campus?.name || campusId}</span>
                            <span className="text-gray-500">{hours} 小时</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-gray-500 text-sm">暂无数据</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">排班状态统计</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <div key={status} className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-800">{count}</div>
                    <div className="text-sm text-gray-500 mt-1">{status}</div>
                  </div>
                ))}
                {stats.absentCount > 0 && (
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{stats.absentCount}</div>
                    <div className="text-sm text-red-500 mt-1">缺席记录</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-3">⚠️ 系统使用提示</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-yellow-700">
                <div>
                  <p className="font-medium mb-1">数据持久化</p>
                  <p>所有数据保存在浏览器 localStorage 中，刷新页面不会丢失。</p>
                </div>
                <div>
                  <p className="font-medium mb-1">排班校验</p>
                  <p>排班时会自动校验：学科匹配、校区匹配、时间冲突。</p>
                </div>
                <div>
                  <p className="font-medium mb-1">缺席处理</p>
                  <p>标记缺席后状态变为「需改派」，可选择其他助教改派。</p>
                </div>
                <div>
                  <p className="font-medium mb-1">导入测试</p>
                  <p>导入功能内置异常数据示例，可测试校验逻辑。</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'volunteers':
        return <VolunteerList volunteers={volunteers} campuses={campuses} onRefresh={refresh} />

      case 'campuses':
        return <CampusList campuses={campuses} onRefresh={refresh} />

      case 'courses':
        return <CourseList courses={courses} campuses={campuses} onRefresh={refresh} />

      case 'schedules':
        return (
          <ScheduleList
            schedules={schedules}
            volunteers={volunteers}
            courses={courses}
            campuses={campuses}
            onRefresh={refresh}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1 overflow-x-auto py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderContent()}
      </main>

      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            公益课堂助教排班系统 · 数据保存在本地浏览器 · 刷新不会丢失
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
