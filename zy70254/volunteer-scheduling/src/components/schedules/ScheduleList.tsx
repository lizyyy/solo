import { useState, useMemo } from 'react'
import { Plus, Search, Download, Edit, Trash2, AlertTriangle, RefreshCw, Play, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { Schedule, Volunteer, Course, Campus, ScheduleStatus } from '../../types'
import { StatusBadge } from '../common/StatusBadge'
import { Modal } from '../common/Modal'
import { ScheduleForm } from './ScheduleForm'
import { AbsenceModal } from './AbsenceModal'
import { ReassignModal } from './ReassignModal'
import { ImportModal } from './ImportModal'
import { exportSchedulesToCSV, downloadCSV } from '../../utils/export'

interface ScheduleListProps {
  schedules: Schedule[]
  volunteers: Volunteer[]
  courses: Course[]
  campuses: Campus[]
  onRefresh: () => void
}

const STATUS_ACTIONS: { status: ScheduleStatus; label: string; icon: React.ReactNode; next?: ScheduleStatus }[] = [
  { status: '待确认', label: '确认排班', icon: <CheckCircle className="w-4 h-4" />, next: '已确认' },
  { status: '已确认', label: '开始上课', icon: <Play className="w-4 h-4" />, next: '进行中' },
  { status: '进行中', label: '完成课程', icon: <CheckCircle className="w-4 h-4" />, next: '已完成' },
  { status: '需改派', label: '重新分配', icon: <RefreshCw className="w-4 h-4" /> },
]

export function ScheduleList({ schedules, volunteers, courses, campuses, onRefresh }: ScheduleListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<ScheduleStatus | ''>('')
  const [filterCourse, setFilterCourse] = useState('')
  const [filterVolunteer, setFilterVolunteer] = useState('')
  const [filterCampus, setFilterCampus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [absenceSchedule, setAbsenceSchedule] = useState<Schedule | null>(null)
  const [reassignSchedule, setReassignSchedule] = useState<Schedule | null>(null)

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const course = courses.find((c) => c.id === s.courseId)
      const volunteer = volunteers.find((v) => v.id === s.volunteerId)
      if (searchTerm) {
        const matchCourse = course?.name.includes(searchTerm)
        const matchVolunteer = volunteer?.name.includes(searchTerm) || volunteer?.phone.includes(searchTerm)
        if (!matchCourse && !matchVolunteer) return false
      }
      if (filterStatus && s.status !== filterStatus) return false
      if (filterCourse && s.courseId !== filterCourse) return false
      if (filterVolunteer && s.volunteerId !== filterVolunteer) return false
      if (filterCampus && course?.campusId !== filterCampus) return false
      return true
    }).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.startTime.localeCompare(b.startTime)
    })
  }, [schedules, volunteers, courses, searchTerm, filterStatus, filterCourse, filterVolunteer, filterCampus])

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingSchedule(null)
  }

  const handleExport = () => {
    const csv = exportSchedulesToCSV(filteredSchedules)
    downloadCSV(csv, `排班记录_${new Date().toISOString().split('T')[0]}.csv`)
  }

  const handleStatusChange = (scheduleId: string, nextStatus: ScheduleStatus) => {
    import('../../services/dataService').then(({ updateSchedule }) => {
      updateSchedule(scheduleId, { status: nextStatus })
      onRefresh()
    })
  }

  const getNextAction = (schedule: Schedule) => {
    return STATUS_ACTIONS.find((a) => a.status === schedule.status)
  }

  const needsAttention = (schedule: Schedule) => {
    return schedule.status === '需改派' || schedule.isAbsent
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">排班规则说明</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>助教必须擅长对应课程的学科</li>
              <li>助教必须服务于课程所在的校区</li>
              <li>同一时间段不能重复排班</li>
              <li>缺席的排班需要改派给其他助教</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索课程或助教..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ScheduleStatus | '')}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="待确认">待确认</option>
            <option value="已确认">已确认</option>
            <option value="进行中">进行中</option>
            <option value="已完成">已完成</option>
            <option value="已取消">已取消</option>
            <option value="需改派">需改派</option>
          </select>
          <select
            value={filterCampus}
            onChange={(e) => setFilterCampus(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部校区</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部课程</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterVolunteer}
            onChange={(e) => setFilterVolunteer(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部助教</option>
            {volunteers.filter((v) => v.status === 'active').map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            导入
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建排班
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">课程</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">校区</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">助教</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时长</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSchedules.map((schedule) => {
              const course = courses.find((c) => c.id === schedule.courseId)
              const campus = campuses.find((c) => c.id === course?.campusId)
              const volunteer = volunteers.find((v) => v.id === schedule.volunteerId)
              const nextAction = getNextAction(schedule)
              const attention = needsAttention(schedule)

              return (
                <tr key={schedule.id} className={`hover:bg-gray-50 ${attention ? 'bg-red-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{schedule.date}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {schedule.startTime} - {schedule.endTime}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{course?.name || '未知课程'}</div>
                    {course && (
                      <div className="text-sm text-gray-500">
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{course.subject}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {campus?.name || '未知校区'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{volunteer?.name || '未知助教'}</div>
                    {volunteer && (
                      <div className="text-sm text-gray-500">{volunteer.phone}</div>
                    )}
                    {schedule.isAbsent && (
                      <div className="text-xs text-red-600 mt-1">
                        缺席：{schedule.absenceReason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {schedule.assignedHours} 小时
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={schedule.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      {nextAction && nextAction.next && (
                        <button
                          onClick={() => handleStatusChange(schedule.id, nextAction.next!)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title={nextAction.label}
                        >
                          {nextAction.icon}
                        </button>
                      )}
                      {schedule.status === '需改派' && (
                        <button
                          onClick={() => setReassignSchedule(schedule)}
                          className="text-orange-600 hover:text-orange-900 p-1"
                          title="改派助教"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      {!schedule.isAbsent && !['已完成', '已取消'].includes(schedule.status) && (
                        <button
                          onClick={() => setAbsenceSchedule(schedule)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="标记缺席"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {['待确认', '已确认'].includes(schedule.status) && (
                        <>
                          <button
                            onClick={() => handleEdit(schedule)}
                            className="text-green-600 hover:text-green-900 p-1"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('确定要删除这个排班吗？')) {
                                import('../../services/dataService').then(({ deleteSchedule }) => {
                                  deleteSchedule(schedule.id)
                                  onRefresh()
                                })
                              }
                            }}
                            className="text-gray-600 hover:text-gray-900 p-1"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredSchedules.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无排班数据
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={handleCloseForm}
        title={editingSchedule ? '编辑排班' : '新建排班'}
        size="lg"
      >
        <ScheduleForm
          schedule={editingSchedule}
          volunteers={volunteers}
          courses={courses}
          campuses={campuses}
          onClose={handleCloseForm}
          onSaved={onRefresh}
        />
      </Modal>

      <Modal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        title="导入排班数据"
        size="lg"
      >
        <ImportModal
          volunteers={volunteers}
          courses={courses}
          onClose={() => setShowImport(false)}
          onSaved={onRefresh}
        />
      </Modal>

      <Modal
        isOpen={!!absenceSchedule}
        onClose={() => setAbsenceSchedule(null)}
        title="标记缺席"
        size="md"
      >
        {absenceSchedule && (
          <AbsenceModal
            schedule={absenceSchedule}
            volunteer={volunteers.find((v) => v.id === absenceSchedule.volunteerId)}
            course={courses.find((c) => c.id === absenceSchedule.courseId)}
            onClose={() => setAbsenceSchedule(null)}
            onSaved={() => {
              setAbsenceSchedule(null)
              onRefresh()
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!reassignSchedule}
        onClose={() => setReassignSchedule(null)}
        title="改派助教"
        size="lg"
      >
        {reassignSchedule && (
          <ReassignModal
            schedule={reassignSchedule}
            volunteers={volunteers}
            courses={courses}
            campuses={campuses}
            onClose={() => setReassignSchedule(null)}
            onSaved={() => {
              setReassignSchedule(null)
              onRefresh()
            }}
          />
        )}
      </Modal>
    </div>
  )
}
