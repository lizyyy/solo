import { create } from 'zustand';
import {
  Class,
  Student,
  Work,
  WorkVersion,
  ClassOverviewStats,
  StudentComparisonData,
  IssueType
} from '../types';
import { db } from '../db';
import { generateId } from '../utils/color';

interface ClassStore {
  classes: Class[];
  currentClass: Class | null;
  currentClassStudents: Student[];
  classStats: ClassOverviewStats | null;
  studentComparisons: StudentComparisonData[];
  isLoading: boolean;
  error: string | null;

  loadClasses: () => Promise<void>;
  createClass: (name: string, grade?: string) => Promise<Class>;
  loadClassOverview: (classId: string) => Promise<void>;
  loadStudentComparisons: (classId: string) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;
  clearCurrent: () => void;
}

export const useClassStore = create<ClassStore>((set, get) => ({
  classes: [],
  currentClass: null,
  currentClassStudents: [],
  classStats: null,
  studentComparisons: [],
  isLoading: false,
  error: null,

  loadClasses: async () => {
    set({ isLoading: true, error: null });
    try {
      const classes = await db.classes.orderBy('name').toArray();
      set({ classes, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  createClass: async (name: string, grade: string = '') => {
    set({ isLoading: true, error: null });
    try {
      const existing = await db.classes.where('name').equals(name).first();
      if (existing) {
        set({ isLoading: false });
        return existing;
      }

      const cls: Class = {
        id: generateId(),
        name,
        grade,
        createdAt: new Date()
      };
      await db.classes.add(cls);
      set({ isLoading: false });
      return cls;
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  loadClassOverview: async (classId: string) => {
    set({ isLoading: true, error: null });

    try {
      const classData = await db.getClassWithStudents(classId);
      if (!classData) throw new Error('班级不存在');

      const { cls, students } = classData;

      let totalWorks = 0;
      let totalScore = 0;
      let worksWithIssues = 0;
      let completeWorks = 0;
      const issueDistribution: Record<IssueType, number> = {
        duplicate: 0,
        gray: 0,
        over_saturated: 0
      };

      const studentScores: Map<string, { total: number; count: number }> = new Map();
      const recentWorksList: Array<{
        workId: string;
        studentName: string;
        title: string;
        score: number;
        importedAt: Date;
      }> = [];

      for (const student of students) {
        const works = await db.getStudentWorks(student.id);
        studentScores.set(student.id, { total: 0, count: 0 });

        for (const work of works) {
          const versions = await db.workVersions.where('workId').equals(work.id).reverse().sortBy('importedAt');
          const latestVersion = versions[0];
          if (!latestVersion) continue;

          totalWorks++;

          if (!latestVersion.dataGaps.incomplete) {
            completeWorks++;
          }

          const analysis = await db.getVersionWithAnalysis(latestVersion.id);
          if (analysis) {
            if (analysis.comment) {
              totalScore += analysis.comment.overallScore;
              const scores = studentScores.get(student.id)!;
              scores.total += analysis.comment.overallScore;
              scores.count++;
            }

            if (analysis.issues.length > 0) {
              worksWithIssues++;
              for (const issue of analysis.issues) {
                issueDistribution[issue.type]++;
              }
            }

            recentWorksList.push({
              workId: work.id,
              studentName: student.name,
              title: work.title,
              score: analysis.comment?.overallScore || 0,
              importedAt: latestVersion.importedAt
            });
          }
        }
      }

      const topStudents = students
        .map(s => {
          const scores = studentScores.get(s.id);
          return {
            studentId: s.id,
            studentName: s.name,
            averageScore: scores && scores.count > 0 ? Math.round(scores.total / scores.count) : 0,
            workCount: scores?.count || 0
          };
        })
        .filter(s => s.workCount > 0)
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 5);

      const stats: ClassOverviewStats = {
        totalWorks,
        averageScore: totalWorks > 0 ? Math.round(totalScore / totalWorks) : 0,
        issueRate: totalWorks > 0 ? Math.round((worksWithIssues / totalWorks) * 100) : 0,
        completionRate: totalWorks > 0 ? Math.round((completeWorks / totalWorks) * 100) : 0,
        issueDistribution,
        topStudents,
        recentWorks: recentWorksList
          .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())
          .slice(0, 10)
      };

      set({
        currentClass: cls,
        currentClassStudents: students,
        classStats: stats,
        isLoading: false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  loadStudentComparisons: async (classId: string) => {
    set({ isLoading: true, error: null });

    try {
      const classData = await db.getClassWithStudents(classId);
      if (!classData) throw new Error('班级不存在');

      const { students } = classData;
      const comparisons: StudentComparisonData[] = [];

      for (const student of students) {
        const works = await db.getStudentWorks(student.id);
        const studentWorks: StudentComparisonData['works'] = [];
        let totalScore = 0;
        let totalIssues = 0;
        const scores: number[] = [];

        for (const work of works) {
          const versions = await db.workVersions.where('workId').equals(work.id).reverse().sortBy('importedAt');
          const latestVersion = versions[0];
          if (!latestVersion) continue;

          const analysis = await db.getVersionWithAnalysis(latestVersion.id);
          if (!analysis) continue;

          const score = analysis.comment?.overallScore || 0;
          scores.push(score);
          totalScore += score;
          totalIssues += analysis.issues.length;

          studentWorks.push({
            workId: work.id,
            title: work.title,
            theme: work.theme,
            score,
            issues: analysis.issues.length,
            dominantColors: analysis.colors
              .filter(c => !c.isBackground && !c.isExtreme)
              .slice(0, 3)
              .map(c => c.hex)
          });
        }

        let improvementTrend = 0;
        if (scores.length >= 2) {
          const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
          const secondHalf = scores.slice(Math.floor(scores.length / 2));
          const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
          improvementTrend = Math.round(secondAvg - firstAvg);
        }

        comparisons.push({
          studentId: student.id,
          studentName: student.name,
          works: studentWorks,
          averageScore: scores.length > 0 ? Math.round(totalScore / scores.length) : 0,
          totalIssues,
          improvementTrend
        });
      }

      set({
        studentComparisons: comparisons.sort((a, b) => b.averageScore - a.averageScore),
        isLoading: false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteClass: async (classId: string) => {
    set({ isLoading: true, error: null });

    try {
      const students = await db.students.where('classId').equals(classId).toArray();

      for (const student of students) {
        const works = await db.getStudentWorks(student.id);
        for (const work of works) {
          await db.deleteWorkCascade(work.id);
        }
        await db.students.delete(student.id);
      }

      await db.classes.delete(classId);

      set({
        currentClass: null,
        currentClassStudents: [],
        classStats: null,
        isLoading: false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  clearCurrent: () => {
    set({
      currentClass: null,
      currentClassStudents: [],
      classStats: null,
      studentComparisons: [],
      error: null
    });
  }
}));
