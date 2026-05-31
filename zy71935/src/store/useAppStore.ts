import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, MaterialFile, ExportConfig } from '@/types';
import { mockChanges, mockIssues, defaultFilters, defaultScreenRange, createMockTask } from '@/utils/mockData';
import { generateContentHash } from '@/utils/proofreadEngine';

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentTask: null,
      tasks: [],
      batchQueue: [],
      batchProcessing: false,
      screenRange: defaultScreenRange,
      filters: defaultFilters,

      setCurrentTask: (task) => set({ currentTask: task }),

      createNewTask: (name) => {
        const newTask = {
          id: generateId(),
          name,
          status: 'pending' as const,
          files: [],
          changes: [],
          issues: [],
          screenRange: defaultScreenRange,
          filters: defaultFilters,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          tasks: [...state.tasks, newTask],
          currentTask: newTask,
        }));
      },

      addFile: (file: MaterialFile) => {
        const { currentTask } = get();
        if (!currentTask) return;

        const fileWithHash = {
          ...file,
          hash: generateContentHash(file.content),
        };

        const updatedTask = {
          ...currentTask,
          files: [...currentTask.files, fileWithHash],
          updatedAt: Date.now(),
        };

        set((state) => ({
          currentTask: updatedTask,
          tasks: state.tasks.map((t) =>
            t.id === updatedTask.id ? updatedTask : t
          ),
        }));
      },

      runProofread: async () => {
        const { currentTask } = get();
        if (!currentTask || currentTask.files.length === 0) return;

        set((state) => ({
          currentTask: state.currentTask
            ? { ...state.currentTask, status: 'processing' }
            : null,
        }));

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const taskHash = currentTask.files
          .map((f) => f.hash || '')
          .join('|');

        if (currentTask.processedHash === taskHash) {
          set((state) => ({
            currentTask: state.currentTask
              ? { ...state.currentTask, status: 'completed' }
              : null,
          }));
          return;
        }

        const updatedTask = {
          ...currentTask,
          status: 'completed' as const,
          changes: mockChanges,
          issues: mockIssues,
          processedHash: taskHash,
          updatedAt: Date.now(),
        };

        set((state) => ({
          currentTask: updatedTask,
          tasks: state.tasks.map((t) =>
            t.id === updatedTask.id ? updatedTask : t
          ),
        }));
      },

      runBatchProofread: async (taskIds: string[]) => {
        const { tasks } = get();
        const uniqueTaskIds = [...new Set(taskIds)];

        set({ batchProcessing: true, batchQueue: uniqueTaskIds });

        for (const taskId of uniqueTaskIds) {
          const task = tasks.find((t) => t.id === taskId);
          if (!task) continue;

          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId ? { ...t, status: 'processing' } : t
            ),
          }));

          await new Promise((resolve) => setTimeout(resolve, 1000));

          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: 'completed',
                    changes: mockChanges,
                    issues: mockIssues,
                    updatedAt: Date.now(),
                  }
                : t
            ),
            batchQueue: state.batchQueue.filter((id) => id !== taskId),
          }));
        }

        set({ batchProcessing: false, batchQueue: [] });
      },

      resolveIssue: (issueId: string) => {
        const { currentTask } = get();
        if (!currentTask) return;

        const updatedIssues = currentTask.issues.map((issue) =>
          issue.id === issueId ? { ...issue, resolved: true } : issue
        );

        const updatedTask = {
          ...currentTask,
          issues: updatedIssues,
          updatedAt: Date.now(),
        };

        set((state) => ({
          currentTask: updatedTask,
          tasks: state.tasks.map((t) =>
            t.id === updatedTask.id ? updatedTask : t
          ),
        }));
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      setScreenRange: (range) => set({ screenRange: range }),

      exportReport: async (config: ExportConfig) => {
        const { currentTask, screenRange, filters } = get();
        if (!currentTask) return '';

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const reportContent = `
# 展板文案校对报告

## 任务信息
- 任务名称: ${currentTask.name}
- 导出时间: ${new Date(config.timestamp).toLocaleString('zh-CN')}
- 导出格式: ${config.format}

## 变更统计
- 总变更数: ${currentTask.changes.length}
- 补材料: ${currentTask.changes.filter((c) => c.type === 'material').length} 处
- 结论变更: ${currentTask.changes.filter((c) => c.type === 'conclusion').length} 处

## 问题统计
- 总问题数: ${currentTask.issues.length}
- 已解决: ${currentTask.issues.filter((i) => i.resolved).length}
- 待处理: ${currentTask.issues.filter((i) => !i.resolved).length}

${config.includeScreenRange ? `
## 屏幕状态
- 滚动位置: ${screenRange.scrollTop}
- 可见范围: ${screenRange.visibleStart} - ${screenRange.visibleEnd}
` : ''}

${config.includeFilters ? `
## 筛选条件
- 搜索文本: ${filters.searchText || '(无)'}
- 变更类型: ${filters.changeTypes.join(', ') || '(全部)'}
` : ''}
        `.trim();

        const blob = new Blob([reportContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentTask.name}-校对报告.md`;
        a.click();
        URL.revokeObjectURL(url);

        return reportContent;
      },

      resetState: () => {
        set({
          currentTask: null,
          tasks: [],
          batchQueue: [],
          batchProcessing: false,
          screenRange: defaultScreenRange,
          filters: defaultFilters,
        });
      },

      loadSampleData: () => {
        const sampleTask = createMockTask();
        set({
          tasks: [sampleTask],
          currentTask: sampleTask,
        });
      },
    }),
    {
      name: 'proofread-app-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        filters: state.filters,
      }),
    }
  )
);
