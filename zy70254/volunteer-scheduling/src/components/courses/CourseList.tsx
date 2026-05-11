import { useState, useMemo } from 'react'
import { Plus, Search, Edit, Trash2, Download, BookOpen } from 'lucide-react'
import type { Course, Campus, Subject } from '../../types'
import { StatusBadge } from '../common/StatusBadge'
import { Modal } from '../common/Modal'
import { CourseForm } from './CourseForm'
import { SUBJECTS } from '../../utils/validation'
import { exportCoursesToCSV, downloadCSV } from '../../utils/export'
import { getSchedules } from '../../services/dataService'

interface CourseListProps {
  courses: Course[]
  campuses: Campus[]
  onRefresh: () => void
}

export function CourseList({ courses, campuses, onRefresh }: CourseListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState<Subject | ''>('')
  const [filterCampus, setFilterCampus] = useState('')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (searchTerm && !c.name.includes(searchTerm)) {
        return false
      }
      if (filterSubject && c.subject !== filterSubject) {
        return false
      }
      if (filterCampus && c.campusId !== filterCampus) {
        return false
      }
      if (filterStatus && c.status !== filterStatus) {
        return false
      }
      return true
    })
  }, [courses, searchTerm, filterSubject, filterCampus, filterStatus])

  const handleEdit = (course: Course) => {
    setEditingCourse(course)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingCourse(null)
  }

  const handleExport = () => {
    const csv = exportCoursesToCSV(filteredCourses)
    downloadCSV(csv, `课程管理_${new Date().toISOString().split('T')[0]}.csv`)
  }

  const getCourseScheduleCount = (courseId: string) => {
    return getSchedules().filter((s) => s.courseId === courseId).length
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索课程名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
          </div>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value as Subject | '')}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部学科</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
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
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'active' | 'inactive' | '')}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="inactive">停用</option>
          </select>
        </div>
        <div className="flex gap-2">
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
            新建课程
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">课程信息</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学科</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所属校区</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">上课时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">所需助教</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCourses.map((course) => {
              const campus = campuses.find((c) => c.id === course.campusId)
              return (
                <tr key={course.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-500" />
                      <span className="text-sm font-medium text-gray-900">{course.name}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      已排 {getCourseScheduleCount(course.id)} 个班次
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded">
                      {course.subject}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {campus?.name || course.campusId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{course.dayOfWeek}</div>
                    <div className="text-gray-500">{course.startTime} - {course.endTime}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {course.requiredVolunteers} 人
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={course.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(course)}
                        className="text-green-600 hover:text-green-900 p-1"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const scheduleCount = getCourseScheduleCount(course.id)
                          if (scheduleCount > 0) {
                            alert(`该课程还有 ${scheduleCount} 个排班记录，请先处理排班`)
                            return
                          }
                          if (confirm(`确定要删除课程「${course.name}」吗？`)) {
                            import('../../services/dataService').then(({ deleteCourse }) => {
                              deleteCourse(course.id)
                              onRefresh()
                            })
                          }
                        }}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filteredCourses.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无课程数据
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={handleCloseForm}
        title={editingCourse ? '编辑课程' : '新建课程'}
        size="lg"
      >
        <CourseForm
          course={editingCourse}
          campuses={campuses}
          onClose={handleCloseForm}
          onSaved={onRefresh}
        />
      </Modal>
    </div>
  )
}
