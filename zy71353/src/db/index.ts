import Dexie, { Table } from 'dexie';
import {
  Class,
  Student,
  Work,
  WorkVersion,
  ColorSample,
  ColorIssue,
  TeacherComment
} from '../types';

export class ArtClassDatabase extends Dexie {
  classes!: Table<Class, string>;
  students!: Table<Student, string>;
  works!: Table<Work, string>;
  workVersions!: Table<WorkVersion, string>;
  colorSamples!: Table<ColorSample, string>;
  colorIssues!: Table<ColorIssue, string>;
  teacherComments!: Table<TeacherComment, string>;

  constructor() {
    super('ArtClassColorDB');

    this.version(1).stores({
      classes: 'id, name, grade, createdAt',
      students: 'id, classId, name, studentNo, createdAt',
      works: 'id, studentId, title, theme, createdAt',
      workVersions: 'id, workId, versionNumber, imageHash, importedAt',
      colorSamples: 'id, versionId, hex, percentage',
      colorIssues: 'id, versionId, type, severity',
      teacherComments: 'id, versionId, createdAt'
    });
  }

  async getWorkWithDetails(workId: string) {
    const work = await this.works.get(workId);
    if (!work) return null;

    const student = await this.students.get(work.studentId);
    const versions = await this.workVersions
      .where('workId')
      .equals(workId)
      .reverse()
      .sortBy('importedAt');

    return { work, student, versions };
  }

  async getLatestVersion(workId: string) {
    return await this.workVersions
      .where('workId')
      .equals(workId)
      .reverse()
      .first();
  }

  async getVersionWithAnalysis(versionId: string) {
    const version = await this.workVersions.get(versionId);
    if (!version) return null;

    const colors = await this.colorSamples
      .where('versionId')
      .equals(versionId)
      .sortBy('percentage');

    const issues = await this.colorIssues
      .where('versionId')
      .equals(versionId)
      .toArray();

    const comment = await this.teacherComments
      .where('versionId')
      .equals(versionId)
      .first();

    return { version, colors: colors.reverse(), issues, comment };
  }

  async getClassWithStudents(classId: string) {
    const cls = await this.classes.get(classId);
    if (!cls) return null;

    const students = await this.students
      .where('classId')
      .equals(classId)
      .sortBy('name');

    return { cls, students };
  }

  async getStudentWorks(studentId: string) {
    return await this.works
      .where('studentId')
      .equals(studentId)
      .reverse()
      .sortBy('createdAt');
  }

  async deleteWorkCascade(workId: string) {
    const versions = await this.workVersions.where('workId').equals(workId).toArray();
    const versionIds = versions.map(v => v.id);

    await this.transaction('rw', [
      this.workVersions,
      this.colorSamples,
      this.colorIssues,
      this.teacherComments,
      this.works
    ], async () => {
      for (const versionId of versionIds) {
        await this.colorSamples.where('versionId').equals(versionId).delete();
        await this.colorIssues.where('versionId').equals(versionId).delete();
        await this.teacherComments.where('versionId').equals(versionId).delete();
      }
      await this.workVersions.where('workId').equals(workId).delete();
      await this.works.delete(workId);
    });
  }

  async getNextVersionNumber(workId: string): Promise<number> {
    const latest = await this.getLatestVersion(workId);
    return latest ? latest.versionNumber + 1 : 1;
  }

  async findWorkByImageHash(imageHash: string) {
    return await this.workVersions
      .where('imageHash')
      .equals(imageHash)
      .first();
  }
}

export const db = new ArtClassDatabase();
