import { v4 as uuidv4 } from 'uuid'
import type { Volunteer, Campus, Course, Schedule, ImportRecord } from '../types'
import { getItem, setItem, STORAGE_KEYS } from '../utils/storage'
import { sampleVolunteers, sampleCampuses, sampleCourses, sampleSchedules } from '../data/seedData'

function getOrInitialize<T>(key: string, samples: T[]): T[] {
  const data = getItem<T[] | null>(key, null)
  if (data === null) {
    setItem(key, samples)
    return samples
  }
  return data
}

function generateId(prefix: string): string {
  return `${prefix}-${uuidv4().slice(0, 8)}`
}

export function getVolunteers(): Volunteer[] {
  return getOrInitialize(STORAGE_KEYS.volunteers, sampleVolunteers)
}

export function saveVolunteers(volunteers: Volunteer[]): void {
  setItem(STORAGE_KEYS.volunteers, volunteers)
}

export function addVolunteer(volunteer: Omit<Volunteer, 'id' | 'createdAt' | 'updatedAt' | 'totalAssignedHours'>): Volunteer {
  const volunteers = getVolunteers()
  const now = new Date().toISOString()
  const newVolunteer: Volunteer = {
    ...volunteer,
    id: generateId('v'),
    totalAssignedHours: 0,
    createdAt: now,
    updatedAt: now,
  }
  volunteers.push(newVolunteer)
  saveVolunteers(volunteers)
  return newVolunteer
}

export function updateVolunteer(id: string, updates: Partial<Volunteer>): Volunteer | null {
  const volunteers = getVolunteers()
  const index = volunteers.findIndex((v) => v.id === id)
  if (index === -1) return null
  volunteers[index] = {
    ...volunteers[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  saveVolunteers(volunteers)
  return volunteers[index]
}

export function deleteVolunteer(id: string): boolean {
  const volunteers = getVolunteers()
  const filtered = volunteers.filter((v) => v.id !== id)
  if (filtered.length === volunteers.length) return false
  saveVolunteers(filtered)
  return true
}

export function getVolunteerById(id: string): Volunteer | undefined {
  return getVolunteers().find((v) => v.id === id)
}

export function getCampuses(): Campus[] {
  return getOrInitialize(STORAGE_KEYS.campuses, sampleCampuses)
}

export function saveCampuses(campuses: Campus[]): void {
  setItem(STORAGE_KEYS.campuses, campuses)
}

export function addCampus(campus: Omit<Campus, 'id' | 'createdAt' | 'updatedAt'>): Campus {
  const campuses = getCampuses()
  const now = new Date().toISOString()
  const newCampus: Campus = {
    ...campus,
    id: generateId('c'),
    createdAt: now,
    updatedAt: now,
  }
  campuses.push(newCampus)
  saveCampuses(campuses)
  return newCampus
}

export function updateCampus(id: string, updates: Partial<Campus>): Campus | null {
  const campuses = getCampuses()
  const index = campuses.findIndex((c) => c.id === id)
  if (index === -1) return null
  campuses[index] = {
    ...campuses[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  saveCampuses(campuses)
  return campuses[index]
}

export function deleteCampus(id: string): boolean {
  const campuses = getCampuses()
  const filtered = campuses.filter((c) => c.id !== id)
  if (filtered.length === campuses.length) return false
  saveCampuses(filtered)
  return true
}

export function getCampusById(id: string): Campus | undefined {
  return getCampuses().find((c) => c.id === id)
}

export function getCourses(): Course[] {
  return getOrInitialize(STORAGE_KEYS.courses, sampleCourses)
}

export function saveCourses(courses: Course[]): void {
  setItem(STORAGE_KEYS.courses, courses)
}

export function addCourse(course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>): Course {
  const courses = getCourses()
  const now = new Date().toISOString()
  const newCourse: Course = {
    ...course,
    id: generateId('cs'),
    createdAt: now,
    updatedAt: now,
  }
  courses.push(newCourse)
  saveCourses(courses)
  return newCourse
}

export function updateCourse(id: string, updates: Partial<Course>): Course | null {
  const courses = getCourses()
  const index = courses.findIndex((c) => c.id === id)
  if (index === -1) return null
  courses[index] = {
    ...courses[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  saveCourses(courses)
  return courses[index]
}

export function deleteCourse(id: string): boolean {
  const courses = getCourses()
  const filtered = courses.filter((c) => c.id !== id)
  if (filtered.length === courses.length) return false
  saveCourses(filtered)
  return true
}

export function getCourseById(id: string): Course | undefined {
  return getCourses().find((c) => c.id === id)
}

export function getSchedules(): Schedule[] {
  return getOrInitialize(STORAGE_KEYS.schedules, sampleSchedules)
}

export function saveSchedules(schedules: Schedule[]): void {
  setItem(STORAGE_KEYS.schedules, schedules)
}

export function addSchedule(schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>): Schedule {
  const schedules = getSchedules()
  const now = new Date().toISOString()
  const newSchedule: Schedule = {
    ...schedule,
    id: generateId('s'),
    createdAt: now,
    updatedAt: now,
  }
  schedules.push(newSchedule)
  saveSchedules(schedules)
  updateVolunteerAssignedHours(schedule.volunteerId, schedule.assignedHours)
  return newSchedule
}

export function updateSchedule(id: string, updates: Partial<Schedule>): Schedule | null {
  const schedules = getSchedules()
  const index = schedules.findIndex((s) => s.id === id)
  if (index === -1) return null
  const oldSchedule = schedules[index]
  const newHours = updates.assignedHours
  if (newHours !== undefined && newHours !== oldSchedule.assignedHours) {
    updateVolunteerAssignedHours(oldSchedule.volunteerId, -oldSchedule.assignedHours)
    updateVolunteerAssignedHours(oldSchedule.volunteerId, newHours)
  }
  schedules[index] = {
    ...schedules[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  saveSchedules(schedules)
  return schedules[index]
}

export function deleteSchedule(id: string): boolean {
  const schedules = getSchedules()
  const schedule = schedules.find((s) => s.id === id)
  if (!schedule) return false
  updateVolunteerAssignedHours(schedule.volunteerId, -schedule.assignedHours)
  const filtered = schedules.filter((s) => s.id !== id)
  saveSchedules(filtered)
  return true
}

export function getScheduleById(id: string): Schedule | undefined {
  return getSchedules().find((s) => s.id === id)
}

export function markAbsence(scheduleId: string, reason: string): Schedule | null {
  const schedule = getScheduleById(scheduleId)
  if (!schedule) return null
  return updateSchedule(scheduleId, {
    isAbsent: true,
    absenceReason: reason,
    status: '需改派',
  })
}

export function reassignSchedule(
  oldScheduleId: string,
  newVolunteerId: string,
  reason?: string,
): { oldSchedule: Schedule; newSchedule: Schedule } | null {
  const oldSchedule = getScheduleById(oldScheduleId)
  if (!oldSchedule) return null
  updateSchedule(oldScheduleId, {
    reassignedTo: newVolunteerId,
    status: '已取消',
    notes: reason ? `原助教缺席，已改派：${reason}` : '原助教缺席，已改派',
  })
  updateVolunteerAssignedHours(oldSchedule.volunteerId, -oldSchedule.assignedHours)
  const newSchedule = addSchedule({
    ...oldSchedule,
    volunteerId: newVolunteerId,
    status: '待确认',
    reassignedFrom: oldSchedule.volunteerId,
    notes: reason,
  })
  const updatedOld = getScheduleById(oldScheduleId)!
  return { oldSchedule: updatedOld, newSchedule }
}

function updateVolunteerAssignedHours(volunteerId: string, delta: number): void {
  const volunteer = getVolunteerById(volunteerId)
  if (volunteer) {
    updateVolunteer(volunteerId, {
      totalAssignedHours: Math.max(0, volunteer.totalAssignedHours + delta),
    })
  }
}

export function getImportRecords(): ImportRecord[] {
  return getOrInitialize(STORAGE_KEYS.importRecords, [])
}

export function saveImportRecords(records: ImportRecord[]): void {
  setItem(STORAGE_KEYS.importRecords, records)
}

export function addImportRecord(record: Omit<ImportRecord, 'id' | 'createdAt'>): ImportRecord {
  const records = getImportRecords()
  const now = new Date().toISOString()
  const newRecord: ImportRecord = {
    ...record,
    id: generateId('imp'),
    createdAt: now,
  }
  records.push(newRecord)
  saveImportRecords(records)
  return newRecord
}

export function resetAllData(): void {
  setItem(STORAGE_KEYS.volunteers, sampleVolunteers)
  setItem(STORAGE_KEYS.campuses, sampleCampuses)
  setItem(STORAGE_KEYS.courses, sampleCourses)
  setItem(STORAGE_KEYS.schedules, sampleSchedules)
  setItem(STORAGE_KEYS.importRecords, [])
}
