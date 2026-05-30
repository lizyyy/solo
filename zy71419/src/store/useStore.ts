import { create } from "zustand";
import type {
  TriggerEvent,
  ContractTerms,
  CreditEventAnnouncement,
  CommitteeVote,
  EvidenceNode,
  PayoutCalculation,
  StatusTransition,
  ManualSupplement,
  EventStatus,
} from "@/types";
import {
  mockEvents,
  mockContractTerms,
  mockAnnouncements,
  mockVotes,
  mockEvidenceNodes,
  mockPayouts,
  mockStatusTransitions,
  mockManualSupplements,
} from "@/data/mockData";

interface FilterState {
  statusFilter: EventStatus | "all";
  productFilter: string;
  searchQuery: string;
}

interface StoreState {
  events: TriggerEvent[];
  contractTerms: ContractTerms[];
  announcements: CreditEventAnnouncement[];
  votes: CommitteeVote[];
  evidenceNodes: EvidenceNode[];
  payouts: PayoutCalculation[];
  statusTransitions: StatusTransition[];
  manualSupplements: ManualSupplement[];
  filters: FilterState;

  setStatusFilter: (status: EventStatus | "all") => void;
  setProductFilter: (product: string) => void;
  setSearchQuery: (query: string) => void;

  getFilteredEvents: () => TriggerEvent[];
  getEventById: (id: string) => TriggerEvent | undefined;
  getContractTermsByEventId: (eventId: string) => ContractTerms[];
  getAnnouncementsByEventId: (eventId: string) => CreditEventAnnouncement[];
  getVotesByEventId: (eventId: string) => CommitteeVote[];
  getEvidenceByEventId: (eventId: string) => EvidenceNode[];
  getPayoutByEventId: (eventId: string) => PayoutCalculation | undefined;
  getTransitionsByEventId: (eventId: string) => StatusTransition[];
  getSupplementsByEventId: (eventId: string) => ManualSupplement[];

  getStatusDistribution: () => { status: EventStatus; count: number }[];
  getStats: () => {
    total: number;
    pendingReview: number;
    thisWeekNew: number;
    manualSupplementCount: number;
  };

  exportReviewResult: (eventId: string) => string;
}

export const useStore = create<StoreState>((set, get) => ({
  events: mockEvents,
  contractTerms: mockContractTerms,
  announcements: mockAnnouncements,
  votes: mockVotes,
  evidenceNodes: mockEvidenceNodes,
  payouts: mockPayouts,
  statusTransitions: mockStatusTransitions,
  manualSupplements: mockManualSupplements,
  filters: {
    statusFilter: "all",
    productFilter: "all",
    searchQuery: "",
  },

  setStatusFilter: (status) =>
    set((state) => ({ filters: { ...state.filters, statusFilter: status } })),
  setProductFilter: (product) =>
    set((state) => ({ filters: { ...state.filters, productFilter: product } })),
  setSearchQuery: (query) =>
    set((state) => ({ filters: { ...state.filters, searchQuery: query } })),

  getFilteredEvents: () => {
    const { events, filters } = get();
    return events.filter((e) => {
      if (filters.statusFilter !== "all" && e.status !== filters.statusFilter) return false;
      if (filters.productFilter !== "all" && e.productType !== filters.productFilter) return false;
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        return (
          e.id.toLowerCase().includes(q) ||
          e.eventName.toLowerCase().includes(q) ||
          e.referenceEntity.toLowerCase().includes(q)
        );
      }
      return true;
    });
  },

  getEventById: (id) => get().events.find((e) => e.id === id),

  getContractTermsByEventId: (eventId) =>
    get().contractTerms.filter((c) => c.eventId === eventId),

  getAnnouncementsByEventId: (eventId) =>
    get().announcements.filter((a) => a.eventId === eventId).sort((a, b) => a.version - b.version),

  getVotesByEventId: (eventId) =>
    get().votes.filter((v) => v.eventId === eventId).sort((a, b) => a.votedAt.localeCompare(b.votedAt)),

  getEvidenceByEventId: (eventId) =>
    get().evidenceNodes.filter((e) => e.eventId === eventId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),

  getPayoutByEventId: (eventId) =>
    get().payouts.find((p) => p.eventId === eventId),

  getTransitionsByEventId: (eventId) =>
    get().statusTransitions.filter((t) => t.eventId === eventId).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),

  getSupplementsByEventId: (eventId) =>
    get().manualSupplements.filter((s) => s.eventId === eventId),

  getStatusDistribution: () => {
    const { events } = get();
    const dist: Record<string, number> = {};
    events.forEach((e) => {
      dist[e.status] = (dist[e.status] || 0) + 1;
    });
    return Object.entries(dist).map(([status, count]) => ({
      status: status as EventStatus,
      count,
    }));
  },

  getStats: () => {
    const { events, manualSupplements } = get();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return {
      total: events.length,
      pendingReview: events.filter((e) => e.status === "under_review").length,
      thisWeekNew: events.filter((e) => e.createdAt >= weekAgo).length,
      manualSupplementCount: manualSupplements.filter((s) => s.status === "pending").length,
    };
  },

  exportReviewResult: (eventId) => {
    const state = get();
    const event = state.events.find((e) => e.id === eventId);
    if (!event) return "";

    const terms = state.contractTerms.filter((c) => c.eventId === eventId);
    const announcements = state.announcements.filter((a) => a.eventId === eventId);
    const votes = state.votes.filter((v) => v.eventId === eventId);
    const evidence = state.evidenceNodes.filter((e) => e.eventId === eventId);
    const payout = state.payouts.find((p) => p.eventId === eventId);
    const transitions = state.statusTransitions.filter((t) => t.eventId === eventId);
    const supplements = state.manualSupplements.filter((s) => s.eventId === eventId);

    const lines: string[] = [];
    lines.push("=" .repeat(60));
    lines.push(`信用衍生品触发事件复核报告`);
    lines.push("=".repeat(60));
    lines.push("");
    lines.push(`事件编号: ${event.id}`);
    lines.push(`事件名称: ${event.eventName}`);
    lines.push(`产品类型: ${event.productType}`);
    lines.push(`标的实体: ${event.referenceEntity}`);
    lines.push(`当前状态: ${event.status}`);
    lines.push(`创建时间: ${event.createdAt}`);
    lines.push(`更新时间: ${event.updatedAt}`);
    lines.push(`需人工补资料: ${event.needsManualSupplement ? "是" : "否"}`);
    lines.push("");

    lines.push("--- 合约条款 ---");
    terms.forEach((t) => {
      lines.push(`[来源: ${t.source}, 版本: V${t.version}]`);
      lines.push(t.content);
      lines.push("");
    });

    lines.push("--- 信用事件公告 ---");
    announcements.forEach((a) => {
      lines.push(`[来源: ${a.source}, 机构: ${a.sourceInstitution}, 版本: V${a.version}${a.isCurrentVersion ? " (当前版本)" : " (历史版本)"}]`);
      if (a.previousVersionId) lines.push(`  更正自: ${a.previousVersionId}`);
      lines.push(a.content);
      lines.push("");
    });

    lines.push("--- 委员会投票 ---");
    votes.forEach((v) => {
      lines.push(`  ${v.voterName} (${v.voterRole}): ${v.voteResult} - ${v.voteBasis} [${v.votedAt}]`);
    });
    lines.push("");

    lines.push("--- 赔付试算 ---");
    if (payout) {
      lines.push(`  基于公告版本: ${payout.announcementVersionId}`);
      lines.push(`  基于投票结果: ${payout.voteResultId}`);
      lines.push(`  名义金额: ${payout.notionalAmount.toLocaleString()}`);
      lines.push(`  回收率: ${(payout.recoveryRate * 100).toFixed(2)}%`);
      lines.push(`  赔付价格: ${payout.payoutPrice != null ? payout.payoutPrice.toLocaleString() : "缺失"}`);
      lines.push(`  计算完成: ${payout.isComplete ? "是" : "否"}`);
      lines.push("");
      lines.push("  计算步骤:");
      payout.calculationSteps.forEach((s) => {
        lines.push(`    ${s.step}. ${s.description}: ${s.formula} = ${s.result != null ? s.result.toLocaleString() : "缺失"}`);
      });
    } else {
      lines.push("  无赔付试算记录");
    }
    lines.push("");

    lines.push("--- 状态流转历史 ---");
    transitions.forEach((t) => {
      lines.push(`  [${t.timestamp}] ${t.fromStatus ?? "初始"} → ${t.toStatus} (${t.operator}: ${t.reason})`);
    });
    lines.push("");

    lines.push("--- 证据链 ---");
    evidence.forEach((e) => {
      lines.push(`  [${e.timestamp}] [${e.nodeType}] ${e.summary} (来源: ${e.source}, 操作人: ${e.operator})`);
    });
    lines.push("");

    lines.push("--- 人工补资料记录 ---");
    supplements.forEach((s) => {
      lines.push(`  [${s.requestedAt}] ${s.supplementType}: ${s.description} (${s.status})`);
    });
    lines.push("");
    lines.push("=".repeat(60));
    lines.push(`导出时间: ${new Date().toISOString()}`);
    lines.push("=".repeat(60));

    return lines.join("\n");
  },
}));
