import type { Volunteer, Campus, Course, Schedule, ValidationError, Subject } from '../types'

const SUBJECTS: Subject[] = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '编程', '音乐', '美术']

const DAYS_OF_WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function validatePhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

function validateEmail(email?: string): boolean {
  if (!email) return true
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function validateTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  return timeRegex.test(time)
}

function validateDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  return dateRegex.test(date)
}

export function validateVolunteer(
  volunteer: Partial<Volunteer>,
  existingVolunteers: Volunteer[],
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!volunteer.name || volunteer.name.trim() === '') {
    errors.push({ field: 'name', message: '姓名不能为空', type: 'error' })
  }

  if (!volunteer.phone) {
    errors.push({ field: 'phone', message: '手机号不能为空', type: 'error' })
  } else if (!validatePhone(volunteer.phone)) {
    errors.push({ field: 'phone', message: '手机号格式不正确（应为11位有效手机号）', type: 'error' })
  } else {
    const duplicate = existingVolunteers.find(
      (v) => v.phone === volunteer.phone && v.id !== volunteer.id,
    )
    if (duplicate) {
      errors.push({
        field: 'phone',
        message: `手机号已被使用（${duplicate.name}）`,
        type: 'error',
      })
    }
  }

  if (volunteer.email && !validateEmail(volunteer.email)) {
    errors.push({ field: 'email', message: '邮箱格式不正确', type: 'error' })
  }

  if (!volunteer.subjects || volunteer.subjects.length === 0) {
    errors.push({ field: 'subjects', message: '至少选择一个擅长学科', type: 'error' })
  }

  if (!volunteer.availableCampuses || volunteer.availableCampuses.length === 0) {
    errors.push({ field: 'availableCampuses', message: '至少选择一个可服务校区', type: 'warning' })
  }

  if (volunteer.volunteerHours !== undefined && volunteer.volunteerHours < 0) {
    errors.push({ field: 'volunteerHours', message: '志愿时长不能为负数', type: 'error' })
  }

  return errors
}

export function validateCampus(
  campus: Partial<Campus>,
  existingCampuses: Campus[],
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!campus.name || campus.name.trim() === '') {
    errors.push({ field: 'name', message: '校区名称不能为空', type: 'error' })
  } else {
    const duplicate = existingCampuses.find(
      (c) => c.name === campus.name && c.id !== campus.id,
    )
    if (duplicate) {
      errors.push({
        field: 'name',
        message: `校区名称已存在`,
        type: 'error',
      })
    }
  }

  if (!campus.address || campus.address.trim() === '') {
    errors.push({ field: 'address', message: '校区地址不能为空', type: 'error' })
  }

  if (campus.capacity !== undefined && campus.capacity <= 0) {
    errors.push({ field: 'capacity', message: '容量必须大于0', type: 'error' })
  }

  if (campus.maxVolunteersPerClass !== undefined && campus.maxVolunteersPerClass <= 0) {
    errors.push({ field: 'maxVolunteersPerClass', message: '每班最大志愿人数必须大于0', type: 'error' })
  }

  if (!campus.operatingDays || campus.operatingDays.length === 0) {
    errors.push({ field: 'operatingDays', message: '至少选择一个运营日', type: 'warning' })
  }

  if (!campus.contactPerson || campus.contactPerson.trim() === '') {
    errors.push({ field: 'contactPerson', message: '联系人不能为空', type: 'error' })
  }

  if (!campus.contactPhone) {
    errors.push({ field: 'contactPhone', message: '联系电话不能为空', type: 'error' })
  }

  return errors
}

export function validateCourse(
  course: Partial<Course>,
  _existingCourses: Course[],
  campuses: Campus[],
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!course.name || course.name.trim() === '') {
    errors.push({ field: 'name', message: '课程名称不能为空', type: 'error' })
  }

  if (!course.subject) {
    errors.push({ field: 'subject', message: '学科不能为空', type: 'error' })
  } else if (!SUBJECTS.includes(course.subject)) {
    errors.push({ field: 'subject', message: '学科类型无效', type: 'error' })
  }

  if (!course.campusId) {
    errors.push({ field: 'campusId', message: '所属校区不能为空', type: 'error' })
  } else {
    const campus = campuses.find((c) => c.id === course.campusId)
    if (!campus) {
      errors.push({ field: 'campusId', message: '所属校区不存在', type: 'error' })
    } else if (campus.status === 'inactive') {
      errors.push({ field: 'campusId', message: '所属校区已停用', type: 'warning' })
    }
  }

  if (!course.dayOfWeek) {
    errors.push({ field: 'dayOfWeek', message: '上课日不能为空', type: 'error' })
  } else if (!DAYS_OF_WEEK.includes(course.dayOfWeek)) {
    errors.push({ field: 'dayOfWeek', message: '上课日无效', type: 'error' })
  }

  if (!course.startTime) {
    errors.push({ field: 'startTime', message: '开始时间不能为空', type: 'error' })
  } else if (!validateTimeFormat(course.startTime)) {
    errors.push({ field: 'startTime', message: '开始时间格式不正确（应为HH:MM）', type: 'error' })
  }

  if (!course.endTime) {
    errors.push({ field: 'endTime', message: '结束时间不能为空', type: 'error' })
  } else if (!validateTimeFormat(course.endTime)) {
    errors.push({ field: 'endTime', message: '结束时间格式不正确（应为HH:MM）', type: 'error' })
  }

  if (course.startTime && course.endTime && validateTimeFormat(course.startTime) && validateTimeFormat(course.endTime)) {
    if (course.startTime >= course.endTime) {
      errors.push({ field: 'endTime', message: '结束时间必须晚于开始时间', type: 'error' })
    }
  }

  if (course.requiredVolunteers !== undefined && course.requiredVolunteers <= 0) {
    errors.push({ field: 'requiredVolunteers', message: '所需志愿者人数必须大于0', type: 'error' })
  }

  return errors
}

export function validateSchedule(
  schedule: Partial<Schedule>,
  existingSchedules: Schedule[],
  volunteers: Volunteer[],
  courses: Course[],
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!schedule.courseId) {
    errors.push({ field: 'courseId', message: '课程不能为空', type: 'error' })
  } else {
    const course = courses.find((c) => c.id === schedule.courseId)
    if (!course) {
      errors.push({ field: 'courseId', message: '课程不存在', type: 'error' })
    }
  }

  if (!schedule.volunteerId) {
    errors.push({ field: 'volunteerId', message: '助教不能为空', type: 'error' })
  } else {
    const volunteer = volunteers.find((v) => v.id === schedule.volunteerId)
    if (!volunteer) {
      errors.push({ field: 'volunteerId', message: '助教不存在', type: 'error' })
    } else if (volunteer.status === 'inactive') {
      errors.push({ field: 'volunteerId', message: '该助教已停用', type: 'warning' })
    }
  }

  if (!schedule.date) {
    errors.push({ field: 'date', message: '日期不能为空', type: 'error' })
  } else if (!validateDateFormat(schedule.date)) {
    errors.push({ field: 'date', message: '日期格式不正确（应为YYYY-MM-DD）', type: 'error' })
  }

  if (schedule.startTime && !validateTimeFormat(schedule.startTime)) {
    errors.push({ field: 'startTime', message: '开始时间格式不正确', type: 'error' })
  }

  if (schedule.endTime && !validateTimeFormat(schedule.endTime)) {
    errors.push({ field: 'endTime', message: '结束时间格式不正确', type: 'error' })
  }

  if (schedule.volunteerId && schedule.date && schedule.startTime && schedule.endTime) {
    const conflict = existingSchedules.find((s) => {
      if (s.id === schedule.id) return false
      if (s.volunteerId !== schedule.volunteerId) return false
      if (s.date !== schedule.date) return false
      if (s.status === '已取消') return false
      const sStart = s.startTime
      const sEnd = s.endTime
      const newStart = schedule.startTime
      const newEnd = schedule.endTime
      return (newStart! < sEnd && newEnd! > sStart)
    })
    if (conflict) {
      errors.push({
        field: 'date',
        message: `该助教在 ${schedule.date} ${schedule.startTime}-${schedule.endTime} 已有排班冲突`,
        type: 'error',
      })
    }
  }

  if (schedule.courseId && schedule.volunteerId) {
    const course = courses.find((c) => c.id === schedule.courseId)
    const volunteer = volunteers.find((v) => v.id === schedule.volunteerId)
    if (course && volunteer) {
      if (!volunteer.subjects.includes(course.subject)) {
        errors.push({
          field: 'volunteerId',
          message: `该助教不擅长 ${course.subject} 学科`,
          type: 'warning',
        })
      }
      if (!volunteer.availableCampuses.includes(course.campusId)) {
        errors.push({
          field: 'volunteerId',
          message: `该助教不服务该课程所在校区`,
          type: 'warning',
        })
      }
    }
  }

  return errors
}

export { SUBJECTS, DAYS_OF_WEEK }
