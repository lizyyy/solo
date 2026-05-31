import { create } from "zustand"
import type { CommissionRecord, LinkedFile } from "@/types"

const mockFiles: Record<string, LinkedFile[]> = {
  rec_01: [
    { id: "f_01a", name: "春节系列_授权书_v2.pdf", type: "authorization", uploadDate: "2026-03-01", isLateArrival: false, isDuplicate: false },
    { id: "f_01b", name: "春节系列_素材包.zip", type: "asset_pack", uploadDate: "2026-03-03", isLateArrival: false, isDuplicate: false },
    { id: "f_01c", name: "春节系列_版式稿_v1.fig", type: "layout_draft", uploadDate: "2026-03-05", isLateArrival: false, isDuplicate: false },
  ],
  rec_02: [
    { id: "f_02a", name: "品牌周年庆_授权协议.pdf", type: "authorization", uploadDate: "2026-03-10", isLateArrival: false, isDuplicate: false },
    { id: "f_02b", name: "周年庆_素材包_终版.zip", type: "asset_pack", uploadDate: "2026-03-12", isLateArrival: false, isDuplicate: false },
    { id: "f_02c", name: "周年庆_版式稿_v3.fig", type: "layout_draft", uploadDate: "2026-03-14", isLateArrival: false, isDuplicate: false },
  ],
  rec_03: [
    { id: "f_03a", name: "电商首页Banner_授权函.pdf", type: "authorization", uploadDate: "2026-03-15", isLateArrival: false, isDuplicate: false },
    { id: "f_03b", name: "电商Banner_素材包.zip", type: "asset_pack", uploadDate: "2026-03-16", isLateArrival: false, isDuplicate: false },
    { id: "f_03c", name: "电商Banner_版式稿_v2.fig", type: "layout_draft", uploadDate: "2026-03-18", isLateArrival: false, isDuplicate: false },
  ],
  rec_04: [
    { id: "f_04a", name: "夏日限定包装_授权书.pdf", type: "authorization", uploadDate: "2026-04-01", isLateArrival: false, isDuplicate: false },
    { id: "f_04b", name: "夏日包装_素材包.zip", type: "asset_pack", uploadDate: "2026-04-08", isLateArrival: true, isDuplicate: false },
  ],
  rec_05: [
    { id: "f_05a", name: "中秋礼盒_授权协议.pdf", type: "authorization", uploadDate: "2026-04-10", isLateArrival: false, isDuplicate: false },
  ],
  rec_06: [
    { id: "f_06a", name: "会员日推送_授权函.pdf", type: "authorization", uploadDate: "2026-04-15", isLateArrival: false, isDuplicate: false },
    { id: "f_06b", name: "会员日推送_版式稿_v1.fig", type: "layout_draft", uploadDate: "2026-04-18", isLateArrival: false, isDuplicate: false },
  ],
  rec_07: [
    { id: "f_07a", name: "国庆促销_授权书.pdf", type: "authorization", uploadDate: "2026-04-20", isLateArrival: false, isDuplicate: false },
    { id: "f_07b", name: "国庆促销_素材包.zip", type: "asset_pack", uploadDate: "2026-04-21", isLateArrival: false, isDuplicate: false },
    { id: "f_07c", name: "国庆促销_素材包_副本.zip", type: "asset_pack", uploadDate: "2026-04-21", isLateArrival: false, isDuplicate: true },
    { id: "f_07d", name: "国庆促销_版式稿_v2.fig", type: "layout_draft", uploadDate: "2026-04-23", isLateArrival: false, isDuplicate: false },
  ],
  rec_08: [
    { id: "f_08a", name: "双十一主视觉_授权协议.pdf", type: "authorization", uploadDate: "2026-04-25", isLateArrival: false, isDuplicate: false },
    { id: "f_08b", name: "双十一_素材包_v2.zip", type: "asset_pack", uploadDate: "2026-05-01", isLateArrival: false, isDuplicate: false },
    { id: "f_08c", name: "双十一_版式稿_v1.fig", type: "layout_draft", uploadDate: "2026-04-28", isLateArrival: false, isDuplicate: false },
  ],
  rec_09: [
    { id: "f_09a", name: "年终总结_授权书.pdf", type: "authorization", uploadDate: "2026-05-05", isLateArrival: false, isDuplicate: false },
    { id: "f_09b", name: "年终总结_授权书_签章版.pdf", type: "authorization", uploadDate: "2026-05-06", isLateArrival: false, isDuplicate: true },
    { id: "f_09c", name: "年终总结_素材包.zip", type: "asset_pack", uploadDate: "2026-05-08", isLateArrival: false, isDuplicate: false },
  ],
}

const mockRecords: CommissionRecord[] = [
  {
    id: "rec_01",
    title: "春节系列插画",
    date: "2026-03-05",
    status: "confirmed",
    linkedFiles: mockFiles.rec_01,
  },
  {
    id: "rec_02",
    title: "品牌周年庆海报",
    date: "2026-03-14",
    status: "confirmed",
    linkedFiles: mockFiles.rec_02,
  },
  {
    id: "rec_03",
    title: "电商首页Banner",
    date: "2026-03-18",
    status: "confirmed",
    linkedFiles: mockFiles.rec_03,
  },
  {
    id: "rec_04",
    title: "夏日限定包装",
    date: "2026-04-05",
    status: "pending",
    linkedFiles: mockFiles.rec_04,
    processingCaliber: "素材包于4月8日补交，版式稿待设计团队确认后上传",
  },
  {
    id: "rec_05",
    title: "中秋礼盒视觉",
    date: "2026-04-12",
    status: "pending",
    linkedFiles: mockFiles.rec_05,
    processingCaliber: "仅收到授权文件，素材包和版式稿待供应商交付，预计4月20日前补齐",
  },
  {
    id: "rec_06",
    title: "会员日推送图",
    date: "2026-04-18",
    status: "pending",
    linkedFiles: mockFiles.rec_06,
    processingCaliber: "素材包标记为晚到附件，需品牌团队确认素材完整性后方可编排版式",
  },
  {
    id: "rec_07",
    title: "国庆促销物料",
    date: "2026-04-23",
    status: "manual_corrected",
    linkedFiles: mockFiles.rec_07,
    correctionNote: "素材包存在重复上传（副本），已人工剔除重复项，保留原始上传版本",
  },
  {
    id: "rec_08",
    title: "双十一主视觉",
    date: "2026-05-01",
    status: "manual_corrected",
    linkedFiles: mockFiles.rec_08,
    correctionNote: "版式稿早于素材包上传，时间线顺序已人工调整为先素材后版式",
  },
  {
    id: "rec_09",
    title: "年终总结长图",
    date: "2026-05-08",
    status: "manual_corrected",
    linkedFiles: mockFiles.rec_09,
    correctionNote: "授权文件存在两个版本（原件与签章版），已确认以签章版为准，原件标记为重复",
  },
]

interface StoreState {
  records: CommissionRecord[]
  selectedFileId: string | null
  selectedRecordId: string | null
  sidePanelOpen: boolean
  statusFilter: string
  searchQuery: string

  setSelectedFile: (fileId: string | null, recordId: string | null) => void
  closeSidePanel: () => void
  setStatusFilter: (filter: string) => void
  setSearchQuery: (query: string) => void
}

export const useStore = create<StoreState>((set) => ({
  records: mockRecords,
  selectedFileId: null,
  selectedRecordId: null,
  sidePanelOpen: false,
  statusFilter: "all",
  searchQuery: "",

  setSelectedFile: (fileId, recordId) =>
    set({ selectedFileId: fileId, selectedRecordId: recordId, sidePanelOpen: true }),

  closeSidePanel: () =>
    set({ selectedFileId: null, selectedRecordId: null, sidePanelOpen: false }),

  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
