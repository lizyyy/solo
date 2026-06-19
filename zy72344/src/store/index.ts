import { create } from 'zustand';
import type {
  ParameterTable,
  StudentAnswer,
  HistoryRecord,
  MealPlanResult,
  VisualizationData,
  AnswerStatus,
  ErrorItem,
  NextStep,
  ParameterRecord,
} from '@/types';
import {
  mockParameterTables,
  mockStudentAnswers,
  mockHistoryRecords,
  mockMealPlanResults,
  mockVisualizationData,
} from '@/data/mockData';

interface AppState {
  parameterTables: ParameterTable[];
  studentAnswers: StudentAnswer[];
  historyRecords: HistoryRecord[];
  mealPlanResults: MealPlanResult[];
  visualizationData: VisualizationData[];
  currentUser: string;
  lastImportStatus: {
    type: 'success' | 'duplicate' | 'none';
    message: string;
    tableName?: string;
    countBefore: number;
    countAfter: number;
  } | null;

  addParameterTable: (
    table: Omit<ParameterTable, 'id' | 'importedAt' | 'hash'>
  ) => boolean;
  updateAnswerStatus: (answerId: string, status: AnswerStatus) => void;
  updateAnswerRemark: (answerId: string, remark: string) => void;
  updateAnswerManualExample: (answerId: string, example: string) => void;
  updateMealPlanError: (
    errorId: string,
    updates: Partial<ErrorItem> & { updatedField?: string }
  ) => void;
  refreshMealPlanResult: (parameterVersion?: string) => void;
  resolveError: (errorId: string, resolved: boolean, note?: string) => void;
  addHistoryRecord: (record: Omit<HistoryRecord, 'id' | 'operatedAt'>) => void;
  getStudentAnswersByStudentId: (studentId: string) => StudentAnswer[];
  getHistoryByTargetId: (targetId: string) => HistoryRecord[];
  getErrorsByAnswerId: (answerId: string) => ErrorItem[];
  getLatestMealPlan: () => MealPlanResult | undefined;
  clearLastImportStatus: () => void;
  getStats: () => {
    totalStudents: number;
    multiVersionStudentCount: number;
    multiVersionStudentIds: Set<string>;
    multiVersionAnswersCount: number;
    answersWithManualCount: number;
    pendingReviewCount: number;
  };
  getMultiVersionStudents: () => { studentId: string; studentName: string; versions: StudentAnswer[] }[];
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const generateHash = (records: ParameterRecord[]) => {
  const str = JSON.stringify(
    records.map((r) => ({ name: r.name, value: r.value, constraint: r.constraint }))
  );
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary);
};

const buildErrorsFromAnswers = (answers: StudentAnswer[]): ErrorItem[] => {
  const errors: ErrorItem[] = [];
  const studentGroups = new Map<string, StudentAnswer[]>();

  answers.forEach((a) => {
    const arr = studentGroups.get(a.studentId) || [];
    arr.push(a);
    studentGroups.set(a.studentId, arr);
  });

  studentGroups.forEach((group) => {
    const sorted = [...group].sort((a, b) => a.version - b.version);

    if (sorted.length > 1) {
      sorted.forEach((ans, idx) => {
        const isLatest = idx === sorted.length - 1;
        errors.push({
          id: `err-${ans.id}`,
          answerId: ans.id,
          studentName: ans.studentName,
          studentVersion: ans.version,
          description: isLatest
            ? `${ans.studentName} v${ans.version}：同学生提交多版答案，已${ans.manualExample ? '补手算反例' : '待补充验证'}，需业务运营复核后归正常`
            : `${ans.studentName} v${ans.version}：存在后续版本，需对照核实`,
          originalContent: ans.content,
          correctedContent: isLatest && ans.manualExample ? ans.manualExample : undefined,
          reviewProcess: ans.remark
            ? ans.remark
            : '多版答案自动标记异常，待教研补充反例后移交运营复核',
          reason: isLatest
            ? ans.manualExample
              ? `手算验证已补充，当前状态为"${ans.status}"，仍需运营复核确认`
              : '吴老师未补看手算反例，暂无法确认正确性'
            : `存在v${sorted[sorted.length - 1].version}更新版本，请以最新版为准`,
          missingMaterials: isLatest
            ? [
                ans.manualExample ? '✅ 手算反例已补充' : '⏳ 待吴老师补充手算反例',
                '⏳ 待业务运营复核确认记录',
              ]
            : ['与最新版本答案的差异对比表'],
          nextStep: (isLatest && ans.status !== 'normal' ? 'business' : 'research') as NextStep,
          kept: true,
          resolved: ans.status === 'normal',
        });
      });
    } else {
      const ans = sorted[0];
      if (ans.status !== 'normal') {
        errors.push({
          id: `err-${ans.id}`,
          answerId: ans.id,
          studentName: ans.studentName,
          studentVersion: ans.version,
          description: `${ans.studentName} v${ans.version}：${
            ans.status === 'pending' ? '待审核处理' : '存在异常需跟进'
          }`,
          originalContent: ans.content,
          reviewProcess: ans.remark || '初检状态待处理',
          reason: `当前状态为"${ans.status}"，${
            ans.status === 'pending'
              ? '尚未完成初检流程'
              : '存在异常未完全解决'
          }`,
          missingMaterials: [
            ans.manualExample ? '✅ 手算反例已补充' : '⏳ 待补充手算验证',
            '⏳ 待完整复核记录',
          ],
          nextStep: 'research' as NextStep,
          kept: true,
          resolved: false,
        });
      }
    }
  });

  return errors;
};

const buildMealPlanFromParameters = (
  table: ParameterTable,
  answers: StudentAnswer[]
): MealPlanResult => {
  const records = table.records;
  const totalWeight = records.reduce((sum, r) => sum + r.value, 0) || 1;

  const result: Record<string, number> = {};
  records.forEach((r, idx) => {
    const ratio = Math.round((r.value / totalWeight) * 100);
    const keys = ['主食分配', '蛋白质来源', '蔬菜配比', '脂肪摄入', '纤维补充'];
    result[keys[idx] || `参数${idx + 1}`] = ratio;
  });

  while (Object.values(result).reduce((a, b) => a + b, 0) > 100) {
    const maxKey = Object.entries(result).sort((a, b) => b[1] - a[1])[0][0];
    result[maxKey] -= 1;
  }

  return {
    id: `meal-${generateId()}`,
    parameterVersion: table.version,
    calculationReason: `参数表"${table.name}" (${table.version}) 基于拉格朗日乘子法：共${
      records.length
    }项约束，采用KKT条件求解，目标函数权重归一化后配餐`,
    result,
    errors: buildErrorsFromAnswers(answers),
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
  };
};

export const useAppStore = create<AppState>((set, get) => ({
  parameterTables: mockParameterTables,
  studentAnswers: mockStudentAnswers,
  historyRecords: mockHistoryRecords,
  mealPlanResults: mockMealPlanResults,
  visualizationData: mockVisualizationData,
  currentUser: '吴老师',
  lastImportStatus: null,

  clearLastImportStatus: () => {
    set({ lastImportStatus: null });
  },

  addParameterTable: (table) => {
    const countBefore = get().parameterTables.length;
    const newHash = generateHash(table.records);
    const existing = get().parameterTables.find((t) => t.hash === newHash);

    if (existing) {
      set({
        lastImportStatus: {
          type: 'duplicate',
          message: `检测到与"${existing.name}" (${existing.version}) 内容完全相同，数量未翻倍，原表保留 ${countBefore} 条`,
          tableName: table.name,
          countBefore,
          countAfter: countBefore,
        },
      });
      return false;
    }

    const newTable: ParameterTable = {
      ...table,
      id: `param-${generateId()}`,
      importedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      hash: newHash,
    };

    set((state) => ({
      parameterTables: [...state.parameterTables, newTable],
    }));

    get().addHistoryRecord({
      targetId: newTable.id,
      targetType: 'parameter',
      fieldName: 'import',
      oldValue: '(未导入)',
      newValue: `导入${newTable.records.length}条记录，版本${newTable.version}`,
      operator: get().currentUser,
    });

    get().refreshMealPlanResult(newTable.version);

    set({
      lastImportStatus: {
        type: 'success',
        message: `成功导入"${newTable.name}"，共${newTable.records.length}条参数记录，参数表数量从 ${countBefore} → ${countBefore + 1}`,
        tableName: newTable.name,
        countBefore,
        countAfter: countBefore + 1,
      },
    });
    return true;
  },

  updateAnswerStatus: (answerId, status) => {
    const answer = get().studentAnswers.find((a) => a.id === answerId);
    if (!answer) return;

    set((state) => ({
      studentAnswers: state.studentAnswers.map((a) =>
        a.id === answerId ? { ...a, status } : a
      ),
    }));

    get().addHistoryRecord({
      targetId: answerId,
      targetType: 'answer',
      fieldName: 'status',
      oldValue: answer.status,
      newValue: status,
      operator: get().currentUser,
    });

    get().refreshMealPlanResult();

    const error = get()
      .getLatestMealPlan()
      ?.errors.find((e) => e.answerId === answerId);
    if (error) {
      get().updateMealPlanError(error.id, {
        resolved: status === 'normal',
        reviewProcess: `[${get().currentUser}] 将状态从"${answer.status}"改为"${status}"，${
          status === 'normal' ? '已纳入正常结果' : '保留在异常列表待后续处理'
        }`,
        updatedField: 'status',
      });
    }
  },

  updateAnswerRemark: (answerId, remark) => {
    const answer = get().studentAnswers.find((a) => a.id === answerId);
    if (!answer) return;

    set((state) => ({
      studentAnswers: state.studentAnswers.map((a) =>
        a.id === answerId ? { ...a, remark } : a
      ),
    }));

    get().addHistoryRecord({
      targetId: answerId,
      targetType: 'answer',
      fieldName: 'remark',
      oldValue: answer.remark,
      newValue: remark,
      operator: get().currentUser,
    });

    const error = get()
      .getLatestMealPlan()
      ?.errors.find((e) => e.answerId === answerId);
    if (error) {
      get().updateMealPlanError(error.id, {
        reason: remark,
        updatedField: 'remark',
      });
    }
  },

  updateAnswerManualExample: (answerId, example) => {
    const answer = get().studentAnswers.find((a) => a.id === answerId);
    if (!answer) return;

    set((state) => ({
      studentAnswers: state.studentAnswers.map((a) =>
        a.id === answerId ? { ...a, manualExample: example } : a
      ),
    }));

    get().addHistoryRecord({
      targetId: answerId,
      targetType: 'answer',
      fieldName: 'manualExample',
      oldValue: answer.manualExample || '(空)',
      newValue: example,
      operator: get().currentUser,
    });

    get().refreshMealPlanResult();
  },

  updateMealPlanError: (errorId, updates) => {
    const latest = get().getLatestMealPlan();
    if (!latest) return;

    const targetError = latest.errors.find((e) => e.id === errorId);
    if (!targetError) return;

    set((state) => ({
      mealPlanResults: state.mealPlanResults.map((mr) =>
        mr.id === latest.id
          ? {
              ...mr,
              errors: mr.errors.map((e) =>
                e.id === errorId ? { ...e, ...updates } : e
              ),
            }
          : mr
      ),
    }));

    if (updates.updatedField) {
      get().addHistoryRecord({
        targetId: `${latest.id}-${errorId}`,
        targetType: 'parameter',
        fieldName: `error.${errorId}.${updates.updatedField}`,
        oldValue: (targetError as any)[updates.updatedField] || '',
        newValue: (updates as any)[updates.updatedField] || '',
        operator: get().currentUser,
      });
    }
  },

  resolveError: (errorId, resolved, note) => {
    get().updateMealPlanError(errorId, {
      resolved,
      reviewProcess: note,
    });
  },

  refreshMealPlanResult: (_parameterVersion) => {
    const tables = get().parameterTables;
    if (tables.length === 0) return;

    const latestTable = [...tables].sort(
      (a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    )[0];
    const answers = get().studentAnswers;
    const newPlan = buildMealPlanFromParameters(latestTable, answers);

    set((state) => {
      const filtered = state.mealPlanResults.filter(
        (m) => m.parameterVersion !== latestTable.version
      );
      return {
        mealPlanResults: [...filtered, newPlan],
      };
    });
  },

  addHistoryRecord: (record) => {
    const newRecord: HistoryRecord = {
      ...record,
      id: `hist-${generateId()}`,
      operatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    set((state) => ({
      historyRecords: [...state.historyRecords, newRecord],
    }));
  },

  getStudentAnswersByStudentId: (studentId) => {
    return get().studentAnswers.filter((a) => a.studentId === studentId);
  },

  getHistoryByTargetId: (targetId) => {
    return get().historyRecords.filter((h) => h.targetId.startsWith(targetId));
  },

  getErrorsByAnswerId: (answerId) => {
    const latest = get().getLatestMealPlan();
    return latest?.errors.filter((e) => e.answerId === answerId) || [];
  },

  getStats: () => {
    const { studentAnswers } = get();
    const allStudentIds = new Set(studentAnswers.map((a) => a.studentId));
    const multiVersionStudentIds = new Set(
      studentAnswers
        .filter((a) => studentAnswers.filter((x) => x.studentId === a.studentId).length > 1)
        .map((a) => a.studentId)
    );
    return {
      totalStudents: allStudentIds.size,
      multiVersionStudentCount: multiVersionStudentIds.size,
      multiVersionStudentIds,
      multiVersionAnswersCount: studentAnswers.filter((a) => multiVersionStudentIds.has(a.studentId)).length,
      answersWithManualCount: studentAnswers.filter((a) => a.manualExample).length,
      pendingReviewCount: studentAnswers.filter((a) => a.status === 'pending' || a.status === 'reviewing').length,
    };
  },

  getMultiVersionStudents: () => {
    const { studentAnswers } = get();
    const groups = new Map<string, StudentAnswer[]>();
    studentAnswers.forEach((a) => {
      const arr = groups.get(a.studentId) || [];
      arr.push(a);
      groups.set(a.studentId, arr);
    });
    return Array.from(groups.entries())
      .filter(([_, versions]) => versions.length > 1)
      .map(([studentId, versions]) => ({
        studentId,
        studentName: versions[0].studentName,
        versions: versions.sort((a, b) => a.version - b.version),
      }));
  },

  getLatestMealPlan: () => {
    const results = get().mealPlanResults;
    if (results.length === 0) return undefined;
    return [...results].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  },
}));
