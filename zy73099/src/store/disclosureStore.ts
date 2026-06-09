import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  DisclosureItem,
  StatusFilter,
  SummaryStats,
  TimelineNode,
  DiffResult,
} from '@/types';
import { quickstartItems } from '@/data/quickstart';
import { computeTextDiff, serializeDiffResult } from '@/lib/diff';
import {
  assessOffsetRisk,
  buildBlockerReason,
  getContactInfoForZone,
  isOffsetBlocker,
} from '@/lib/coordinate';
import { validateImportData } from '@/lib/validation';

const STORAGE_KEY = 'fire-disclosure-store';
const DEFAULT_OPERATOR = '阿乔';

interface DisclosureState {
  items: DisclosureItem[];
  lastOperator: string;
  lastSyncAt: string;

  importQuickstart: () => { success: boolean; count: number };
  importFromJSON: (jsonStr: string) => { success: boolean; count: number; errors?: string[] };
  getFilteredItems: (filter: StatusFilter) => DisclosureItem[];
  getItemById: (id: string) => DisclosureItem | undefined;
  getSummary: () => SummaryStats;
  getItemTimeline: (id: string) => TimelineNode[];
  computeDiff: (id: string) => DiffResult | null;

  confirmItem: (
    id: string,
    remark: string,
    contentAfter: string
  ) => DisclosureItem | undefined;
  revertItem: (id: string, reason: string) => DisclosureItem | undefined;
  flagAwaitingPatch: (
    id: string,
    blockerReason: string,
    contactInfo?: {
      nextContact: string;
      nextContactRole: string;
      nextContactPhone: string;
    }
  ) => DisclosureItem | undefined;
  checkOffsetAndNotify: (id: string) => {
    isBlocker: boolean;
    blockerReason?: string;
    contactInfo?: {
      nextContact: string;
      nextContactRole: string;
      nextContactPhone: string;
    };
  };
  resetAll: () => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const useDisclosureStore = create<DisclosureState>()(
  persist(
    (set, get) => ({
      items: [],
      lastOperator: DEFAULT_OPERATOR,
      lastSyncAt: new Date(0).toISOString(),

      importQuickstart: () => {
        const existingIds = new Set(get().items.map((i) => i.id));
        const newItems = quickstartItems.filter((i) => !existingIds.has(i.id));
        if (newItems.length === 0) {
          return { success: false, count: 0 };
        }
        set({
          items: [...get().items, ...newItems],
          lastSyncAt: new Date().toISOString(),
        });
        return { success: true, count: newItems.length };
      },

      importFromJSON: (jsonStr) => {
        try {
          const parsed = JSON.parse(jsonStr);
          const result = validateImportData(parsed);
          if (!result.success) {
            return {
              success: false,
              count: 0,
              errors: result.error.issues.map((i) => i.message),
            };
          }
          const existingIds = new Set(get().items.map((i) => i.id));
          const validItems = result.data.items.filter(
            (i) => !existingIds.has(i.id)
          ) as DisclosureItem[];
          set({
            items: [...get().items, ...validItems],
            lastSyncAt: new Date().toISOString(),
          });
          return { success: true, count: validItems.length };
        } catch (e) {
          return {
            success: false,
            count: 0,
            errors: [`文件解析失败：${(e as Error).message}`],
          };
        }
      },

      getFilteredItems: (filter) => {
        const all = get().items;
        if (filter === 'all') return [...all].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
        return all
          .filter((i) => i.status === filter)
          .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      },

      getItemById: (id) => get().items.find((i) => i.id === id),

      getSummary: () => {
        const items = get().items;
        const summary: SummaryStats = {
          total: items.length,
          confirmed: 0,
          awaitingPatch: 0,
          reverted: 0,
          pending: 0,
        };
        for (const it of items) {
          if (it.status === 'confirmed') summary.confirmed++;
          else if (it.status === 'awaiting_patch') summary.awaitingPatch++;
          else if (it.status === 'reverted') summary.reverted++;
          else summary.pending++;
        }
        return summary;
      },

      getItemTimeline: (id) => {
        const item = get().getItemById(id);
        if (!item) return [];
        const nodes: TimelineNode[] = [];

        nodes.push({
          id: `${id}-origin`,
          type: 'origin',
          title: '会议纪要原文',
          content: item.originalContent,
          operator: '系统抽取',
          timestamp: formatDateTime(item.createdAt),
        });

        if (item.manualChangeContent) {
          nodes.push({
            id: `${id}-manual`,
            type: 'manual_change',
            title: '人工改判',
            content: item.manualChangeContent,
            operator: item.operator || DEFAULT_OPERATOR,
            timestamp: formatDateTime(item.createdAt),
          });
        }

        if (item.supplementContent) {
          nodes.push({
            id: `${id}-supplement`,
            type: 'supplement',
            title: '补充说明',
            content: item.supplementContent,
            operator: '现场补充',
            timestamp: formatDateTime(item.createdAt),
          });
        }

        if (item.status === 'awaiting_patch' && item.blockerReason) {
          nodes.push({
            id: `${id}-awaiting`,
            type: 'awaiting',
            title: '待补件 / 异常卡壳',
            content: item.blockerReason,
            operator: item.operator || DEFAULT_OPERATOR,
            timestamp: formatDateTime(item.updatedAt),
          });
        }

        if (item.status === 'confirmed' && item.confirmedAt) {
          nodes.push({
            id: `${id}-confirm`,
            type: 'confirm',
            title: `人工确认${item.confirmRemark ? '（备注）' : ''}`,
            content: item.confirmRemark || '已核对无误，交底下发执行。',
            operator: item.operator || DEFAULT_OPERATOR,
            timestamp: formatDateTime(item.confirmedAt),
          });
        }

        if (item.status === 'reverted' && item.revertedAt) {
          nodes.push({
            id: `${id}-revert`,
            type: 'revert',
            title: `撤回退回`,
            content: item.revertReason || '撤回原因未填写',
            operator: item.operator || DEFAULT_OPERATOR,
            timestamp: formatDateTime(item.revertedAt),
          });
        }

        return nodes;
      },

      computeDiff: (id) => {
        const item = get().getItemById(id);
        if (!item || !item.contentBefore || !item.contentAfter) return null;
        return computeTextDiff(item.contentBefore, item.contentAfter);
      },

      confirmItem: (id, remark, contentAfter) => {
        const item = get().getItemById(id);
        if (!item) return undefined;
        const now = new Date().toISOString();
        const contentBefore = item.content;
        const diff = computeTextDiff(contentBefore, contentAfter);
        const diffMeta = serializeDiffResult(diff);
        const updated: DisclosureItem = {
          ...item,
          status: 'confirmed',
          content: contentAfter,
          contentBefore,
          contentAfter,
          diffMetadata: diffMeta,
          confirmRemark: remark,
          confirmedAt: now,
          updatedAt: now,
          operator: get().lastOperator,
          offsetRiskLevel: assessOffsetRisk(item.coordinateOffset),
        };
        set({
          items: get().items.map((i) => (i.id === id ? updated : i)),
          lastSyncAt: now,
        });
        return updated;
      },

      revertItem: (id, reason) => {
        const item = get().getItemById(id);
        if (!item) return undefined;
        const now = new Date().toISOString();
        const updated: DisclosureItem = {
          ...item,
          status: 'reverted',
          revertReason: reason,
          revertedAt: now,
          updatedAt: now,
          operator: get().lastOperator,
        };
        set({
          items: get().items.map((i) => (i.id === id ? updated : i)),
          lastSyncAt: now,
        });
        return updated;
      },

      flagAwaitingPatch: (id, blockerReason, contactInfo) => {
        const item = get().getItemById(id);
        if (!item) return undefined;
        const now = new Date().toISOString();
        const info = contactInfo || getContactInfoForZone(item.fireZone);
        const updated: DisclosureItem = {
          ...item,
          status: 'awaiting_patch',
          blockerReason,
          nextContact: info.nextContact,
          nextContactRole: info.nextContactRole,
          nextContactPhone: info.nextContactPhone,
          updatedAt: now,
          operator: get().lastOperator,
        };
        set({
          items: get().items.map((i) => (i.id === id ? updated : i)),
          lastSyncAt: now,
        });
        return updated;
      },

      checkOffsetAndNotify: (id) => {
        const item = get().getItemById(id);
        if (!item) return { isBlocker: false };
        if (!isOffsetBlocker(item.coordinateOffset)) return { isBlocker: false };
        return {
          isBlocker: true,
          blockerReason: buildBlockerReason(item.coordinateOffset, item.fireZone),
          contactInfo: getContactInfoForZone(item.fireZone),
        };
      },

      resetAll: () => {
        set({
          items: [],
          lastSyncAt: new Date(0).toISOString(),
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        lastOperator: state.lastOperator,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);
