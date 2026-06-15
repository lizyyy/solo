import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Record,
  PhoneExposure,
  KnowledgeLink,
  FeedbackTicket,
  ExportSnapshot,
  ExportContent,
  HistoryEntry,
} from '@/types'

const baseTime = new Date('2026-06-15T09:00:00').getTime()
const dayMs = 86400000
const time0 = new Date(baseTime - dayMs * 2).toISOString()
const time1 = new Date(baseTime - dayMs).toISOString()
const time2 = new Date(baseTime).toISOString()

const initialRecords: Record[] = [
  {
    id: 'rec-1',
    title: '产品发布会-开场白',
    chapterType: '演讲',
    status: 'warning',
    createdAt: time0,
  },
  {
    id: 'rec-2',
    title: '技术分享-架构设计',
    chapterType: '技术',
    status: 'normal',
    createdAt: time1,
  },
  {
    id: 'rec-3',
    title: '用户访谈-反馈收集',
    chapterType: '访谈',
    status: 'danger',
    createdAt: time2,
  },
]

const initialPhoneExposures: PhoneExposure[] = [
  {
    id: 'pe-1',
    recordId: 'rec-1',
    originalPhone: '13812345678',
    maskedPhone: '138****5678',
    isLeaked: true,
    retainReason: '疑似客服号码，需确认是否属于公开业务联系方式',
    missingMaterials: '客服号码公开声明或业务登记证明',
    nextStep: '联系业务方确认号码性质',
    assignee: '算法同事',
    paramVersion: 'v2.1.3-phone-mask',
    tradeoffReason: '该号码出现于产品介绍页，可能为公开客服热线，暂保留待确认',
    reviewStatus: 'pending',
  },
  {
    id: 'pe-3a',
    recordId: 'rec-3',
    originalPhone: '13912341234',
    maskedPhone: '139****1234',
    isLeaked: true,
    retainReason: '受访者在视频中主动公开个人号码',
    missingMaterials: '受访者公开授权书',
    nextStep: '补录受访者授权文件',
    assignee: '算法运营老唐',
    paramVersion: 'v2.1.3-phone-mask',
    tradeoffReason: '口述公开不等同书面授权，需补充书面材料',
    reviewStatus: 'pending',
  },
  {
    id: 'pe-3b',
    recordId: 'rec-3',
    originalPhone: '13698769876',
    maskedPhone: '136****9876',
    isLeaked: true,
    retainReason: '待确认是否为工作号码',
    missingMaterials: '号码归属方身份确认',
    nextStep: '算法同事复核号码类型',
    assignee: '算法同事',
    paramVersion: 'v2.1.3-phone-mask',
    tradeoffReason: '号码出现于工作场景片段，但无法确认归属',
    reviewStatus: 'pending',
  },
]

const initialKnowledgeLinks: KnowledgeLink[] = [
  {
    id: 'kl-1',
    recordId: 'rec-1',
    url: 'https://wiki.internal/docs/phone-masking-policy-v2',
    title: '手机号遮盖策略规范 v2',
    note: '定义了公开号码与隐私号码的判定标准',
    addedBy: '系统导入',
    addedAt: time0,
  },
  {
    id: 'kl-2',
    recordId: 'rec-1',
    url: 'https://wiki.internal/docs/customer-service-registry',
    title: '客服号码登记表',
    note: '已登记的公开客服号码列表',
    addedBy: '系统导入',
    addedAt: time0,
  },
  {
    id: 'kl-3',
    recordId: 'rec-2',
    url: 'https://wiki.internal/docs/tech-talk-masking-guide',
    title: '技术分享类视频遮盖指南',
    note: '技术分享中号码一般为示例号码，可按规则遮盖',
    addedBy: '系统导入',
    addedAt: time1,
  },
]

const initialFeedbackTickets: FeedbackTicket[] = [
  {
    id: 'ft-1',
    recordId: 'rec-1',
    ticketNo: 'FB-2024-0042',
    title: '开场白中出现未遮盖手机号',
    status: 'open',
  },
  {
    id: 'ft-2',
    recordId: 'rec-3',
    ticketNo: 'FB-2024-0058',
    title: '访谈片段多个手机号未遮盖',
    status: 'in_progress',
  },
]

function buildExportContent(
  recordId: string,
  exposures: PhoneExposure[],
  links: KnowledgeLink[],
  tickets: FeedbackTicket[]
): ExportContent[] {
  const recordExposures = exposures.filter((e) => e.recordId === recordId)
  const recordLinks = links.filter((l) => l.recordId === recordId)
  const recordTickets = tickets.filter((t) => t.recordId === recordId)

  return recordExposures.map((exp) => ({
    phoneExposureId: exp.id,
    originalPhone: exp.originalPhone,
    maskedPhone: exp.maskedPhone,
    isLeaked: exp.isLeaked,
    retainReason: exp.retainReason,
    missingMaterials: exp.missingMaterials,
    nextStep: exp.nextStep,
    assignee: exp.assignee,
    knowledgeLinks: recordLinks.map((l) => l.url),
    ticketNos: recordTickets.map((t) => t.ticketNo),
    paramVersion: exp.paramVersion,
    tradeoffReason: exp.tradeoffReason,
  }))
}

const initialExports: ExportSnapshot[] = [
  {
    id: 'exp-1',
    recordId: 'rec-1',
    generatedAt: time0,
    content: buildExportContent('rec-1', initialPhoneExposures, initialKnowledgeLinks, initialFeedbackTickets),
    version: '1',
  },
  {
    id: 'exp-2',
    recordId: 'rec-2',
    generatedAt: time1,
    content: buildExportContent('rec-2', initialPhoneExposures, initialKnowledgeLinks, initialFeedbackTickets),
    version: '1',
  },
]

const initialHistory: HistoryEntry[] = [
  {
    id: 'h-1',
    recordId: 'rec-1',
    action: 'link_added',
    field: 'knowledgeLinks',
    oldValue: '',
    newValue: '手机号遮盖策略规范 v2, 客服号码登记表',
    operator: '系统导入',
    timestamp: time0,
    paramVersion: 'v2.1.3-phone-mask',
    tradeoffReason: '',
  },
  {
    id: 'h-2',
    recordId: 'rec-2',
    action: 'link_added',
    field: 'knowledgeLinks',
    oldValue: '',
    newValue: '技术分享类视频遮盖指南',
    operator: '系统导入',
    timestamp: time1,
    paramVersion: 'v2.1.3-phone-mask',
    tradeoffReason: '',
  },
  {
    id: 'h-3',
    recordId: 'rec-1',
    action: 'export_regenerated',
    field: 'export',
    oldValue: '无',
    newValue: '首次生成，含1条漏遮',
    operator: '系统',
    timestamp: time0,
    paramVersion: 'v2.1.3-phone-mask',
    tradeoffReason: '',
  },
  {
    id: 'h-4',
    recordId: 'rec-2',
    action: 'export_regenerated',
    field: 'export',
    oldValue: '无',
    newValue: '首次生成，全部遮盖',
    operator: '系统',
    timestamp: time1,
    paramVersion: 'v2.1.3-phone-mask',
    tradeoffReason: '',
  },
]

interface StoreState {
  records: Record[]
  phoneExposures: PhoneExposure[]
  knowledgeLinks: KnowledgeLink[]
  feedbackTickets: FeedbackTicket[]
  exportSnapshots: ExportSnapshot[]
  history: HistoryEntry[]
  idCounter: number

  addKnowledgeLink: (recordId: string, url: string, title: string, note: string) => { success: boolean; message: string }
  editLinkNote: (linkId: string, newNote: string) => void
  removeKnowledgeLink: (linkId: string) => void
  regenerateExport: (recordId: string) => void
  changeReviewStatus: (exposureId: string, status: 'pending' | 'confirmed' | 'rejected') => void
  reset: () => void
}

function nextId(prefix: string, counter: number): string {
  return `${prefix}-${counter}`
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      records: initialRecords,
      phoneExposures: initialPhoneExposures,
      knowledgeLinks: initialKnowledgeLinks,
      feedbackTickets: initialFeedbackTickets,
      exportSnapshots: initialExports,
      history: initialHistory,
      idCounter: 100,

      addKnowledgeLink: (recordId, url, title, note) => {
        const existing = get().knowledgeLinks.filter((l) => l.recordId === recordId)
        if (existing.some((l) => l.url === url)) {
          return { success: false, message: '该知识库链接已存在，不会重复添加' }
        }

        const counter = get().idCounter
        const newCounter = counter + 1

        const newLink: KnowledgeLink = {
          id: nextId('kl', newCounter),
          recordId,
          url,
          title,
          note,
          addedBy: '小乔',
          addedAt: new Date().toISOString(),
        }

        const entry: HistoryEntry = {
          id: nextId('h', newCounter + 1),
          recordId,
          action: 'link_added',
          field: 'knowledgeLinks',
          oldValue: '',
          newValue: `${title} (${url})`,
          operator: '小乔',
          timestamp: new Date().toISOString(),
          paramVersion: 'v2.1.3-phone-mask',
          tradeoffReason: '',
        }

        set((state) => ({
          knowledgeLinks: [...state.knowledgeLinks, newLink],
          history: [...state.history, entry],
          idCounter: newCounter + 1,
        }))

        return { success: true, message: '知识库链接补录成功' }
      },

      editLinkNote: (linkId, newNote) => {
        const link = get().knowledgeLinks.find((l) => l.id === linkId)
        if (!link) return

        const counter = get().idCounter
        const newCounter = counter + 1

        const entry: HistoryEntry = {
          id: nextId('h', newCounter),
          recordId: link.recordId,
          action: 'link_note_edited',
          field: `linkNote.${link.title}`,
          oldValue: link.note,
          newValue: newNote,
          operator: '小乔',
          timestamp: new Date().toISOString(),
          paramVersion: '',
          tradeoffReason: '',
        }

        set((state) => ({
          knowledgeLinks: state.knowledgeLinks.map((l) =>
            l.id === linkId ? { ...l, note: newNote } : l
          ),
          history: [...state.history, entry],
          idCounter: newCounter,
        }))
      },

      removeKnowledgeLink: (linkId) => {
        const link = get().knowledgeLinks.find((l) => l.id === linkId)
        if (!link) return

        const counter = get().idCounter
        const newCounter = counter + 1

        const entry: HistoryEntry = {
          id: nextId('h', newCounter),
          recordId: link.recordId,
          action: 'link_removed',
          field: 'knowledgeLinks',
          oldValue: `${link.title} (${link.url})`,
          newValue: '',
          operator: '小乔',
          timestamp: new Date().toISOString(),
          paramVersion: '',
          tradeoffReason: '',
        }

        set((state) => ({
          knowledgeLinks: state.knowledgeLinks.filter((l) => l.id !== linkId),
          history: [...state.history, entry],
          idCounter: newCounter,
        }))
      },

      regenerateExport: (recordId) => {
        const { phoneExposures, knowledgeLinks, feedbackTickets, exportSnapshots, idCounter } = get()
        const existing = exportSnapshots.filter((e) => e.recordId === recordId)
        const prevVersion = existing.length > 0 ? String(existing.length) : '0'
        const newVersion = String(existing.length + 1)

        const newContent = buildExportContent(recordId, phoneExposures, knowledgeLinks, feedbackTickets)
        const leakedCount = newContent.filter((c) => c.isLeaked).length
        const linkCount = knowledgeLinks.filter((l) => l.recordId === recordId).length

        const newCounter = idCounter + 1

        const newSnapshot: ExportSnapshot = {
          id: nextId('exp', newCounter),
          recordId,
          generatedAt: new Date().toISOString(),
          content: newContent,
          version: newVersion,
        }

        const entry: HistoryEntry = {
          id: nextId('h', newCounter + 1),
          recordId,
          action: 'export_regenerated',
          field: 'export',
          oldValue: `版本${prevVersion}`,
          newValue: `版本${newVersion}，含${leakedCount}条漏遮，知识库链接${linkCount}条`,
          operator: '小乔',
          timestamp: new Date().toISOString(),
          paramVersion: 'v2.1.3-phone-mask',
          tradeoffReason: '基于最新补录链接和备注重新生成',
        }

        set((state) => ({
          exportSnapshots: [...state.exportSnapshots, newSnapshot],
          history: [...state.history, entry],
          idCounter: newCounter + 1,
        }))
      },

      changeReviewStatus: (exposureId, status) => {
        const exposure = get().phoneExposures.find((e) => e.id === exposureId)
        if (!exposure) return

        const counter = get().idCounter
        const newCounter = counter + 1

        const entry: HistoryEntry = {
          id: nextId('h', newCounter),
          recordId: exposure.recordId,
          action: 'review_status_changed',
          field: `reviewStatus.${exposure.maskedPhone}`,
          oldValue: exposure.reviewStatus,
          newValue: status,
          operator: status === 'confirmed' ? '算法同事' : '算法运营老唐',
          timestamp: new Date().toISOString(),
          paramVersion: exposure.paramVersion,
          tradeoffReason: status === 'rejected' ? '复核不通过，需重新评估' : '复核通过',
        }

        set((state) => ({
          phoneExposures: state.phoneExposures.map((e) =>
            e.id === exposureId ? { ...e, reviewStatus: status } : e
          ),
          history: [...state.history, entry],
          idCounter: newCounter,
        }))
      },

      reset: () => {
        set({
          records: initialRecords,
          phoneExposures: initialPhoneExposures,
          knowledgeLinks: initialKnowledgeLinks,
          feedbackTickets: initialFeedbackTickets,
          exportSnapshots: initialExports,
          history: initialHistory,
          idCounter: 100,
        })
      },
    }),
    {
      name: 'video-chapter-store',
    }
  )
)
