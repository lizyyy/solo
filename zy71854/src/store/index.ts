import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DemoScript,
  Part,
  Note,
  KnowledgePoint,
  OperationLog,
  KnowledgeStatus,
  DataType,
  ImportResult,
} from '@/types';
import { mockScripts, mockParts, mockNotes, mockKnowledgePoints, mockOperationLogs } from '@/mock/data';
import {
  generateId,
  getCurrentTimestamp,
  generateProcessingRule,
  generateVersion,
  getOperator,
} from '@/utils/processing';

interface AppState {
  scripts: DemoScript[];
  parts: Part[];
  notes: Note[];
  knowledgePoints: KnowledgePoint[];
  operationLogs: OperationLog[];
  selectedKnowledgeId: string | null;
  showTracePanel: boolean;
  filterStatus: KnowledgeStatus | 'all';

  setShowTracePanel: (show: boolean, knowledgeId?: string) => void;
  setFilterStatus: (status: KnowledgeStatus | 'all') => void;
  setSelectedKnowledgeId: (id: string | null) => void;

  importScripts: (data: Partial<DemoScript>[], sourceFile: string) => ImportResult;
  importParts: (data: Partial<Part>[], sourceFile: string) => ImportResult;
  addNote: (content: string, relatedTo: string) => Note;

  updateKnowledgeStatus: (id: string, status: KnowledgeStatus, reason?: string) => void;
  editKnowledge: (id: string, updates: Partial<KnowledgePoint>, reason?: string) => void;
  undoLastOperation: () => boolean;

  addOperationLog: (
    action: OperationLog['action'],
    targetId: string,
    targetType: DataType,
    processingRule: string,
    beforeState?: string,
    afterState?: string
  ) => void;

  generateKnowledgeFromScripts: () => void;
  initializeWithMockData: () => void;
  clearAllData: () => void;
}

const initialState = {
  scripts: [],
  parts: [],
  notes: [],
  knowledgePoints: [],
  operationLogs: [],
  selectedKnowledgeId: null,
  showTracePanel: false,
  filterStatus: 'all' as KnowledgeStatus | 'all',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setShowTracePanel: (show, knowledgeId) => {
        set({ showTracePanel: show, selectedKnowledgeId: knowledgeId || null });
      },

      setFilterStatus: (status) => {
        set({ filterStatus: status });
      },

      setSelectedKnowledgeId: (id) => {
        set({ selectedKnowledgeId: id });
      },

      importScripts: (data, sourceFile) => {
        const state = get();
        let imported = 0;
        let duplicates = 0;
        const newScripts: DemoScript[] = [];

        data.forEach((item) => {
          if (!item.stepNumber || !item.title || !item.content) return;

          const existing = state.scripts.find(
            (s) => s.sourceFile === sourceFile && s.stepNumber === item.stepNumber
          );

          if (existing) {
            duplicates++;
            const updatedScript: DemoScript = {
              ...existing,
              title: item.title || existing.title,
              content: item.content || existing.content,
              version: generateVersion(existing.version),
              importedAt: getCurrentTimestamp(),
              processingRule: generateProcessingRule('import', 'script', '重复导入自动合并，保留较新版本'),
            };
            newScripts.push(updatedScript);
          } else {
            imported++;
            const newScript: DemoScript = {
              id: 's' + generateId(),
              title: item.title,
              content: item.content,
              stepNumber: item.stepNumber,
              sourceFile,
              importedAt: getCurrentTimestamp(),
              processingRule: generateProcessingRule('import', 'script', '首次导入'),
              version: '1.0',
              isSkipped: false,
            };
            newScripts.push(newScript);
          }
        });

        const existingIds = newScripts.filter((s) => state.scripts.find((e) => e.id === s.id)).map((s) => s.id);
        const otherScripts = state.scripts.filter((s) => !existingIds.includes(s.id));
        const allScripts = [...otherScripts, ...newScripts].sort((a, b) => a.stepNumber - b.stepNumber);

        set({ scripts: allScripts });

        const rule = generateProcessingRule('import', 'script', `${imported}条新增，${duplicates}条重复自动合并`);
        get().addOperationLog('import', 'batch-' + generateId(), 'script', rule);

        return {
          success: true,
          imported,
          duplicates,
          message: `成功导入${imported}条，合并${duplicates}条重复数据`,
        };
      },

      importParts: (data, sourceFile) => {
        const state = get();
        let imported = 0;
        let duplicates = 0;
        const newParts: Part[] = [];

        data.forEach((item) => {
          if (!item.partNumber || !item.name) return;

          const existing = state.parts.find(
            (p) => p.sourceFile === sourceFile && p.partNumber === item.partNumber
          );

          if (existing) {
            duplicates++;
            const updatedPart: Part = {
              ...existing,
              name: item.name || existing.name,
              quantity: item.quantity ?? existing.quantity,
              description: item.description || existing.description,
              category: item.category || existing.category,
              version: generateVersion(existing.version),
              importedAt: getCurrentTimestamp(),
              processingRule: generateProcessingRule('import', 'part', '重复导入自动合并，保留较新版本'),
            };
            newParts.push(updatedPart);
          } else {
            imported++;
            const newPart: Part = {
              id: 'p' + generateId(),
              name: item.name,
              partNumber: item.partNumber,
              quantity: item.quantity ?? 1,
              description: item.description || '',
              category: item.category || '未分类',
              sourceFile,
              importedAt: getCurrentTimestamp(),
              processingRule: generateProcessingRule('import', 'part', '首次导入'),
              version: '1.0',
            };
            newParts.push(newPart);
          }
        });

        const existingIds = newParts.filter((p) => state.parts.find((e) => e.id === p.id)).map((p) => p.id);
        const otherParts = state.parts.filter((p) => !existingIds.includes(p.id));
        const allParts = [...otherParts, ...newParts].sort((a, b) => a.partNumber.localeCompare(b.partNumber));

        set({ parts: allParts });

        const rule = generateProcessingRule('import', 'part', `${imported}条新增，${duplicates}条重复自动合并`);
        get().addOperationLog('import', 'batch-' + generateId(), 'part', rule);

        return {
          success: true,
          imported,
          duplicates,
          message: `成功导入${imported}条，合并${duplicates}条重复数据`,
        };
      },

      addNote: (content, relatedTo) => {
        const newNote: Note = {
          id: 'n' + generateId(),
          content,
          relatedTo,
          author: getOperator(),
          createdAt: getCurrentTimestamp(),
          processingRule: generateProcessingRule('import', 'note', '手动录入'),
        };

        set((state) => ({ notes: [...state.notes, newNote] }));

        get().addOperationLog(
          'import',
          newNote.id,
          'note',
          generateProcessingRule('import', 'note', '手动录入备注')
        );

        return newNote;
      },

      updateKnowledgeStatus: (id, status, reason) => {
        const state = get();
        const kp = state.knowledgePoints.find((k) => k.id === id);
        if (!kp) return;

        const beforeState = JSON.stringify({ status: kp.status });
        const processingRule = generateProcessingRule(
          'status_change',
          'knowledge',
          `${kp.status} → ${status}${reason ? `：${reason}` : ''}`
        );

        set((state) => ({
          knowledgePoints: state.knowledgePoints.map((k) =>
            k.id === id
              ? {
                  ...k,
                  status,
                  updatedAt: getCurrentTimestamp(),
                  processingRule,
                  manualEditReason: reason || k.manualEditReason,
                }
              : k
          ),
        }));

        const afterState = JSON.stringify({ status });
        get().addOperationLog('status_change', id, 'knowledge', processingRule, beforeState, afterState);
      },

      editKnowledge: (id, updates, reason) => {
        const state = get();
        const kp = state.knowledgePoints.find((k) => k.id === id);
        if (!kp) return;

        const beforeState = JSON.stringify(kp);
        const processingRule = generateProcessingRule(
          'edit',
          'knowledge',
          reason || '人工修改内容'
        );

        set((state) => ({
          knowledgePoints: state.knowledgePoints.map((k) =>
            k.id === id
              ? {
                  ...k,
                  ...updates,
                  status: 'modified',
                  updatedAt: getCurrentTimestamp(),
                  processingRule,
                  manualEditReason: reason || k.manualEditReason,
                }
              : k
          ),
        }));

        const afterState = JSON.stringify({ ...kp, ...updates });
        get().addOperationLog('edit', id, 'knowledge', processingRule, beforeState, afterState);
      },

      undoLastOperation: () => {
        const state = get();
        const undoableLogs = state.operationLogs.filter(
          (log) => log.action !== 'undo' && log.beforeState
        );

        if (undoableLogs.length === 0) return false;

        const lastLog = undoableLogs[undoableLogs.length - 1];
        let success = false;

        try {
          const beforeState = JSON.parse(lastLog.beforeState || '{}');

          if (lastLog.targetType === 'knowledge') {
            const kp = state.knowledgePoints.find((k) => k.id === lastLog.targetId);
            if (kp) {
              const processingRule = generateProcessingRule(
                'undo',
                'knowledge',
                `撤回至 ${lastLog.timestamp} 版本`
              );

              set((state) => ({
                knowledgePoints: state.knowledgePoints.map((k) =>
                  k.id === lastLog.targetId
                    ? {
                        ...k,
                        ...beforeState,
                        status: beforeState.status || k.status,
                        updatedAt: getCurrentTimestamp(),
                        processingRule,
                        undoHighlight: true,
                      }
                    : k
                ),
              }));

              setTimeout(() => {
                set((state) => ({
                  knowledgePoints: state.knowledgePoints.map((k) =>
                    k.id === lastLog.targetId ? { ...k, undoHighlight: false } : k
                  ),
                }));
              }, 1000);

              success = true;
            }
          } else if (lastLog.targetType === 'script') {
            const script = state.scripts.find((s) => s.id === lastLog.targetId);
            if (script) {
              const processingRule = generateProcessingRule(
                'undo',
                'script',
                `撤回至 ${lastLog.timestamp} 版本`
              );
              set((state) => ({
                scripts: state.scripts.map((s) =>
                  s.id === lastLog.targetId ? { ...s, ...beforeState, processingRule } : s
                ),
              }));
              success = true;
            }
          } else if (lastLog.targetType === 'part') {
            const part = state.parts.find((p) => p.id === lastLog.targetId);
            if (part) {
              const processingRule = generateProcessingRule(
                'undo',
                'part',
                `撤回至 ${lastLog.timestamp} 版本`
              );
              set((state) => ({
                parts: state.parts.map((p) =>
                  p.id === lastLog.targetId ? { ...p, ...beforeState, processingRule } : p
                ),
              }));
              success = true;
            }
          }

          if (success) {
            get().addOperationLog(
              'undo',
              lastLog.targetId,
              lastLog.targetType,
              generateProcessingRule('undo', lastLog.targetType, `撤回操作：${lastLog.processingRule}`)
            );
          }
        } catch (e) {
          console.error('撤回失败:', e);
          return false;
        }

        return success;
      },

      addOperationLog: (action, targetId, targetType, processingRule, beforeState, afterState) => {
        const newLog: OperationLog = {
          id: 'l' + generateId(),
          action,
          targetId,
          targetType,
          timestamp: getCurrentTimestamp(),
          operator: getOperator(),
          processingRule,
          beforeState,
          afterState,
        };

        set((state) => ({
          operationLogs: [newLog, ...state.operationLogs],
        }));
      },

      generateKnowledgeFromScripts: () => {
        const state = get();
        const existingScriptRefs = new Set(
          state.knowledgePoints.flatMap((k) => k.scriptReferences)
        );

        const newKnowledgePoints: KnowledgePoint[] = [];

        state.scripts.forEach((script) => {
          if (existingScriptRefs.has(script.id) || script.isSkipped) return;

          const kp: KnowledgePoint = {
            id: 'k' + generateId(),
            title: script.title,
            content: script.content,
            status: 'pending',
            scriptReferences: [script.id],
            partReferences: [],
            noteReferences: [],
            createdAt: getCurrentTimestamp(),
            updatedAt: getCurrentTimestamp(),
            processingRule: generateProcessingRule('import', 'knowledge', '系统自动生成'),
          };

          newKnowledgePoints.push(kp);
        });

        if (newKnowledgePoints.length > 0) {
          set((state) => ({
            knowledgePoints: [...state.knowledgePoints, ...newKnowledgePoints],
          }));

          get().addOperationLog(
            'import',
            'batch-' + generateId(),
            'knowledge',
            generateProcessingRule('import', 'knowledge', `系统自动生成${newKnowledgePoints.length}条知识点`)
          );
        }
      },

      initializeWithMockData: () => {
        set({
          scripts: mockScripts,
          parts: mockParts,
          notes: mockNotes,
          knowledgePoints: mockKnowledgePoints,
          operationLogs: mockOperationLogs,
        });
      },

      clearAllData: () => {
        set(initialState);
      },
    }),
    {
      name: 'solar-orbit-teaching-store',
    }
  )
);
