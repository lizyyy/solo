import { create } from 'zustand';
import {
  Work,
  WorkVersion,
  ColorSample,
  ColorIssue,
  TeacherComment,
  DataGaps,
  ColorAnalysisResult,
  Student,
  Class
} from '../types';
import { db } from '../db';
import { generateId } from '../utils/color';
import { loadImage, getImageData, fileToDataUrl, calculateImageHash, hasTransparentPixels } from '../utils/image';
import { extractDominantColors } from '../lib/colorExtractor';
import { analyzeColorQuality } from '../lib/colorAnalyzer';
import { detectDataGaps } from '../lib/gapDetector';

interface WorkStore {
  currentWork: Work | null;
  currentVersion: WorkVersion | null;
  currentAnalysis: ColorAnalysisResult | null;
  currentComment: TeacherComment | null;
  versions: WorkVersion[];
  recentWorks: Array<{ work: Work; student: Student; version: WorkVersion; score: number }>;
  isLoading: boolean;
  error: string | null;

  importWork: (data: {
    file: File;
    studentName: string;
    className: string;
    workTitle: string;
    theme?: string;
    classId?: string;
    forceImport?: boolean;
  }) => Promise<{
    workId: string;
    versionId: string;
    dataGaps: DataGaps;
    requiresConfirmation: boolean;
  }>;

  analyzeVersion: (versionId: string) => Promise<ColorAnalysisResult>;
  saveComment: (versionId: string, comment: Partial<TeacherComment>) => Promise<TeacherComment>;
  loadWork: (workId: string) => Promise<void>;
  loadVersion: (versionId: string) => Promise<void>;
  loadRecentWorks: (limit?: number) => Promise<void>;
  getWorkVersions: (workId: string) => Promise<WorkVersion[]>;
  deleteWork: (workId: string) => Promise<void>;
  clearCurrent: () => void;
}

export const useWorkStore = create<WorkStore>((set, get) => ({
  currentWork: null,
  currentVersion: null,
  currentAnalysis: null,
  currentComment: null,
  versions: [],
  recentWorks: [],
  isLoading: false,
  error: null,

  importWork: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const imageDataUrl = await fileToDataUrl(data.file);
      const img = await loadImage(imageDataUrl);
      const imageData = getImageData(img, 200);
      const imageHash = await calculateImageHash(imageDataUrl);

      const existingVersion = await db.findWorkByImageHash(imageHash);
      if (existingVersion) {
        set({ isLoading: false });
        return {
          workId: existingVersion.workId,
          versionId: existingVersion.id,
          dataGaps: existingVersion.dataGaps,
          requiresConfirmation: false
        };
      }

      const gaps = detectDataGaps({
        studentName: data.studentName,
        className: data.className,
        workTitle: data.workTitle,
        theme: data.theme,
        hasImage: true,
        hasTransparency: hasTransparentPixels(imageData)
      });

      if (gaps.incomplete && !data.forceImport) {
        set({ isLoading: false });
        return {
          workId: '',
          versionId: '',
          dataGaps: gaps,
          requiresConfirmation: true
        };
      }

      let classId = data.classId;
      if (!classId) {
        const existingClass = await db.classes.where('name').equals(data.className).first();
        if (existingClass) {
          classId = existingClass.id;
        } else {
          classId = generateId();
          await db.classes.add({
            id: classId,
            name: data.className,
            grade: '',
            createdAt: new Date()
          });
        }
      }

      let student = await db.students
        .where('classId')
        .equals(classId)
        .and(s => s.name === data.studentName)
        .first();

      if (!student) {
        const studentId = generateId();
        student = {
          id: studentId,
          classId,
          name: data.studentName,
          createdAt: new Date()
        };
        await db.students.add(student);
      }

      const workId = generateId();
      const work: Work = {
        id: workId,
        studentId: student.id,
        title: data.workTitle,
        theme: data.theme,
        createdAt: new Date()
      };
      await db.works.add(work);

      const versionNumber = await db.getNextVersionNumber(workId);
      const versionId = generateId();

      const extractionResult = await extractDominantColors(imageData, versionId);

      const finalGaps: DataGaps = {
        ...gaps,
        warnings: [...gaps.warnings, ...extractionResult.warnings],
        forcedImport: !!data.forceImport
      };

      const version: WorkVersion = {
        id: versionId,
        workId,
        versionNumber,
        imageHash,
        imageDataUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
        hasTransparency: hasTransparentPixels(imageData),
        backgroundColor: extractionResult.backgroundColor,
        dataGaps: finalGaps,
        importedAt: new Date(),
        importedBy: '教师',
        excludedPixelCount: extractionResult.excludedPixelCount,
        totalPixelCount: imageData.width * imageData.height
      };

      await db.workVersions.add(version);
      await db.colorSamples.bulkAdd(extractionResult.colors);

      const analysis = analyzeColorQuality(extractionResult.colors, versionId);
      await db.colorIssues.bulkAdd(analysis.issues);

      set({ isLoading: false });

      return {
        workId,
        versionId,
        dataGaps: finalGaps,
        requiresConfirmation: false
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  analyzeVersion: async (versionId: string) => {
    set({ isLoading: true, error: null });

    try {
      const version = await db.workVersions.get(versionId);
      if (!version) throw new Error('版本不存在');

      const img = await loadImage(version.imageDataUrl);
      const imageData = getImageData(img, 200);

      const extractionResult = await extractDominantColors(imageData, versionId);

      await db.colorSamples.where('versionId').equals(versionId).delete();
      await db.colorSamples.bulkAdd(extractionResult.colors);

      const analysis = analyzeColorQuality(extractionResult.colors, versionId);

      await db.colorIssues.where('versionId').equals(versionId).delete();
      await db.colorIssues.bulkAdd(analysis.issues);

      set({ currentAnalysis: analysis, isLoading: false });
      return analysis;
    } catch (error) {
      const message = error instanceof Error ? error.message : '分析失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  saveComment: async (versionId: string, commentData: Partial<TeacherComment>) => {
    set({ isLoading: true, error: null });

    try {
      const existing = await db.teacherComments.where('versionId').equals(versionId).first();

      const comment: TeacherComment = {
        id: existing?.id || generateId(),
        versionId,
        content: commentData.content || '',
        overallScore: commentData.overallScore || 0,
        structuredTags: commentData.structuredTags || [],
        createdAt: new Date(),
        teacherName: commentData.teacherName || '教师'
      };

      if (existing) {
        await db.teacherComments.put(comment);
      } else {
        await db.teacherComments.add(comment);
      }

      set({ currentComment: comment, isLoading: false });
      return comment;
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  loadWork: async (workId: string) => {
    set({ isLoading: true, error: null });

    try {
      const details = await db.getWorkWithDetails(workId);
      if (!details) throw new Error('作品不存在');

      const latestVersion = details.versions[0];
      if (latestVersion) {
        const analysis = await db.getVersionWithAnalysis(latestVersion.id);
        set({
          currentWork: details.work,
          currentVersion: latestVersion,
          versions: details.versions,
          currentAnalysis: analysis ? {
            dominantColors: analysis.colors,
            issues: analysis.issues,
            overallScore: analysis.comment?.overallScore || 0,
            metrics: {
              colorEntropy: 0,
              grayPercentage: 0,
              overSaturatedPercentage: 0,
              averageSaturation: 0,
              colorVariety: analysis.colors.length
            }
          } : null,
          currentComment: analysis?.comment || null,
          isLoading: false
        });
      } else {
        set({
          currentWork: details.work,
          versions: details.versions,
          isLoading: false
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  loadVersion: async (versionId: string) => {
    set({ isLoading: true, error: null });

    try {
      const analysis = await db.getVersionWithAnalysis(versionId);
      if (!analysis) throw new Error('版本不存在');

      const work = await db.works.get(analysis.version.workId);
      const qualityAnalysis = analyzeColorQuality(analysis.colors, versionId);

      set({
        currentWork: work || null,
        currentVersion: analysis.version,
        currentAnalysis: qualityAnalysis,
        currentComment: analysis.comment || null,
        isLoading: false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  loadRecentWorks: async (limit = 10) => {
    set({ isLoading: true, error: null });

    try {
      const recentVersions = await db.workVersions
        .orderBy('importedAt')
        .reverse()
        .limit(limit)
        .toArray();

      const recentWorks = [];

      for (const version of recentVersions) {
        const work = await db.works.get(version.workId);
        if (!work) continue;

        const student = await db.students.get(work.studentId);
        if (!student) continue;

        const comment = await db.teacherComments.where('versionId').equals(version.id).first();

        recentWorks.push({
          work,
          student,
          version,
          score: comment?.overallScore || 0
        });
      }

      set({ recentWorks, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  getWorkVersions: async (workId: string) => {
    const versions = await db.workVersions
      .where('workId')
      .equals(workId)
      .reverse()
      .sortBy('importedAt');
    set({ versions });
    return versions;
  },

  deleteWork: async (workId: string) => {
    set({ isLoading: true, error: null });

    try {
      await db.deleteWorkCascade(workId);
      set({
        currentWork: null,
        currentVersion: null,
        currentAnalysis: null,
        currentComment: null,
        versions: [],
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
      currentWork: null,
      currentVersion: null,
      currentAnalysis: null,
      currentComment: null,
      versions: [],
      error: null
    });
  }
}));
