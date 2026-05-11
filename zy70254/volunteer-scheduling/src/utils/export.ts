import type { Volunteer, Campus, Course, Schedule, Statistics } from '../types'
import { getCampusById, getCourseById, getVolunteerById } from '../services/dataService'

function toCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportVolunteersToCSV(volunteers: Volunteer[]): string {
  const headers = ['ID', '姓名', '手机号', '邮箱', '擅长学科', '可服务校区', '总志愿时长', '已分配时长', '状态']
  const rows = volunteers.map((v) => {
    const campusNames = v.availableCampuses
      .map((id) => getCampusById(id)?.name || id)
      .join('、')
    return [
      toCSV(v.id),
      toCSV(v.name),
      toCSV(v.phone),
      toCSV(v.email),
      toCSV(v.subjects.join('、')),
      toCSV(campusNames),
      toCSV(v.volunteerHours),
      toCSV(v.totalAssignedHours),
      toCSV(v.status === 'active' ? '活跃' : '停用'),
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}

export function exportCampusesToCSV(campuses: Campus[]): string {
  const headers = ['ID', '名称', '地址', '容量', '每班最大志愿人数', '运营日', '联系人', '联系电话', '状态']
  const rows = campuses.map((c) => [
    toCSV(c.id),
    toCSV(c.name),
    toCSV(c.address),
    toCSV(c.capacity),
    toCSV(c.maxVolunteersPerClass),
    toCSV(c.operatingDays.join('、')),
    toCSV(c.contactPerson),
    toCSV(c.contactPhone),
    toCSV(c.status === 'active' ? '活跃' : '停用'),
  ].join(','))
  return [headers.join(','), ...rows].join('\n')
}

export function exportCoursesToCSV(courses: Course[]): string {
  const headers = ['ID', '名称', '学科', '校区', '上课日', '开始时间', '结束时间', '所需志愿者数', '状态']
  const rows = courses.map((c) => {
    const campus = getCampusById(c.campusId)
    return [
      toCSV(c.id),
      toCSV(c.name),
      toCSV(c.subject),
      toCSV(campus?.name || c.campusId),
      toCSV(c.dayOfWeek),
      toCSV(c.startTime),
      toCSV(c.endTime),
      toCSV(c.requiredVolunteers),
      toCSV(c.status === 'active' ? '活跃' : '停用'),
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}

export function exportSchedulesToCSV(schedules: Schedule[]): string {
  const headers = ['ID', '课程', '助教', '日期', '开始时间', '结束时间', '时长', '状态', '是否缺席', '缺席原因', '备注']
  const rows = schedules.map((s) => {
    const course = getCourseById(s.courseId)
    const volunteer = getVolunteerById(s.volunteerId)
    return [
      toCSV(s.id),
      toCSV(course?.name || s.courseId),
      toCSV(volunteer?.name || s.volunteerId),
      toCSV(s.date),
      toCSV(s.startTime),
      toCSV(s.endTime),
      toCSV(s.assignedHours),
      toCSV(s.status),
      toCSV(s.isAbsent ? '是' : '否'),
      toCSV(s.absenceReason),
      toCSV(s.notes),
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}

export function downloadCSV(content: string, filename: string): void {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function calculateStatistics(
  volunteers: Volunteer[],
  campuses: Campus[],
  courses: Course[],
  schedules: Schedule[],
): Statistics {
  const activeSchedules = schedules.filter((s) => s.status !== '已取消')
  const scheduledVolunteerIds = new Set(activeSchedules.map((s) => s.volunteerId))
  const bySubject: Record<string, number> = {}
  const byCampus: Record<string, number> = {}
  const byStatus: Record<string, number> = {}

  activeSchedules.forEach((s) => {
    const course = getCourseById(s.courseId)
    if (course) {
      bySubject[course.subject] = (bySubject[course.subject] || 0) + s.assignedHours
      byCampus[course.campusId] = (byCampus[course.campusId] || 0) + s.assignedHours
    }
    byStatus[s.status] = (byStatus[s.status] || 0) + 1
  })

  return {
    totalVolunteers: volunteers.length,
    totalScheduledVolunteers: scheduledVolunteerIds.size,
    totalCourses: courses.length,
    totalCampuses: campuses.length,
    totalHours: activeSchedules.reduce((sum, s) => sum + s.assignedHours, 0),
    absentCount: schedules.filter((s) => s.isAbsent).length,
    reassignedCount: schedules.filter((s) => s.reassignedFrom || s.reassignedTo).length,
    bySubject,
    byCampus,
    byStatus,
  }
}
