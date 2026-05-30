import Dexie, { type Table } from 'dexie'
import type { Project, Student, MotionClip, Keyframe, Comment, Report, ManualNote } from '@/types'

class MotionClassroomDB extends Dexie {
  projects!: Table<Project>
  students!: Table<Student>
  motionClips!: Table<MotionClip>
  keyframes!: Table<Keyframe>
  comments!: Table<Comment>
  reports!: Table<Report>
  manualNotes!: Table<ManualNote>

  constructor() {
    super('MotionClassroomDB')
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      students: 'id, projectId, name',
      motionClips: 'id, projectId, studentId, name',
      keyframes: 'id, clipId, frameIndex',
      comments: 'id, clipId, frameIndex',
      reports: 'id, projectId',
      manualNotes: 'id, reportId, section',
    })
  }
}

export const db = new MotionClassroomDB()

export async function loadProject(projectId: string) {
  const project = await db.projects.get(projectId)
  if (!project) return null
  const students = await db.students.where('projectId').equals(projectId).toArray()
  const clips = await db.motionClips.where('projectId').equals(projectId).toArray()
  const keyframes = await Promise.all(
    clips.map((c) => db.keyframes.where('clipId').equals(c.id).toArray())
  )
  const comments = await Promise.all(
    clips.map((c) => db.comments.where('clipId').equals(c.id).toArray())
  )
  const report = await db.reports.where('projectId').equals(projectId).first()
  const notes = report
    ? await db.manualNotes.where('reportId').equals(report.id).toArray()
    : []
  return { project, students, clips, keyframes: keyframes.flat(), comments: comments.flat(), report, notes }
}

export async function saveProject(project: Project) {
  await db.projects.put(project)
}

export async function saveStudent(student: Student) {
  await db.students.put(student)
}

export async function deleteStudent(studentId: string) {
  await db.students.delete(studentId)
}

export async function saveMotionClip(clip: MotionClip) {
  await db.motionClips.put(clip)
}

export async function deleteMotionClip(clipId: string) {
  await db.motionClips.delete(clipId)
  await db.keyframes.where('clipId').equals(clipId).delete()
  await db.comments.where('clipId').equals(clipId).delete()
}

export async function saveKeyframe(kf: Keyframe) {
  await db.keyframes.put(kf)
}

export async function deleteKeyframe(kfId: string) {
  await db.keyframes.delete(kfId)
}

export async function saveComment(comment: Comment) {
  await db.comments.put(comment)
}

export async function deleteComment(commentId: string) {
  await db.comments.delete(commentId)
}

export async function saveReport(report: Report) {
  await db.reports.put(report)
}

export async function saveManualNote(note: ManualNote) {
  await db.manualNotes.put(note)
}

export async function deleteManualNote(noteId: string) {
  await db.manualNotes.delete(noteId)
}

export async function getStudentClips(studentId: string) {
  return db.motionClips.where('studentId').equals(studentId).toArray()
}

export async function getClipKeyframes(clipId: string) {
  return db.keyframes.where('clipId').equals(clipId).toArray()
}

export async function getClipComments(clipId: string) {
  return db.comments.where('clipId').equals(clipId).toArray()
}

export async function checkClipOverlap(
  projectId: string,
  studentId: string,
  startFrame: number,
  endFrame: number,
  excludeClipId?: string
) {
  const clips = await db.motionClips
    .where('projectId')
    .equals(projectId)
    .filter((c) => c.studentId === studentId && c.id !== excludeClipId)
    .toArray()
  return clips.filter((c) => c.startFrame <= endFrame && c.endFrame >= startFrame)
}

export async function exportAllData(projectId: string) {
  const data = await loadProject(projectId)
  return JSON.stringify(data, null, 2)
}

export async function importAllData(json: string) {
  const data = JSON.parse(json)
  if (data.project) await db.projects.put(data.project)
  if (data.students) for (const s of data.students) await db.students.put(s)
  if (data.clips) for (const c of data.clips) await db.motionClips.put(c)
  if (data.keyframes) for (const k of data.keyframes) await db.keyframes.put(k)
  if (data.comments) for (const cm of data.comments) await db.comments.put(cm)
  if (data.report) await db.reports.put(data.report)
  if (data.notes) for (const n of data.notes) await db.manualNotes.put(n)
  return data.project?.id
}
