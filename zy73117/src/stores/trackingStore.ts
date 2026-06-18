import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackingRecord, FilterState, NoteRecord, ScreenshotRecord, PendingSummary } from '@/types/tracking';

type ImportRecordInput = Partial<TrackingRecord> & Pick<TrackingRecord, 'recordNo' | 'title' | 'building' | 'status' | 'source' | 'currentConclusion' | 'priority'>;

const generateId = () => Math.random().toString(36).substring(2, 10);

const mockInitialRecords: TrackingRecord[] = [
  {
    id: 'rec-001',
    recordNo: 'CL-2024-001',
    title: '3号楼北侧墙体裂缝测绘',
    building: '3号楼',
    status: 'completed',
    source: 'old-material',
    createdAt: '2024-01-15 09:00:00',
    updatedAt: '2024-01-20 14:30:00',
    currentConclusion: '墙体裂缝宽度0.3mm，属正常沉降，需定期观测',
    isAbnormal: false,
    relatedRecords: [],
    notes: [
      {
        id: 'note-001',
        content: '初次测绘记录，已归档',
        createdAt: '2024-01-15 10:00:00',
        author: '张工',
      },
    ],
    screenshots: [
      {
        id: 'shot-001',
        url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=building%20wall%20crack%20survey%20measurement%20technical%20drawing&image_size=square',
        description: '墙体裂缝测绘现场照片',
        uploadedAt: '2024-01-15 11:00:00',
        uploader: '张工',
      },
    ],
    priority: 'low',
    handler: '李工',
  },
  {
    id: 'rec-002',
    recordNo: 'CL-2024-002',
    title: '5号楼地基沉降观测',
    building: '5号楼',
    status: 'processing',
    source: 'on-site',
    createdAt: '2024-02-10 08:30:00',
    updatedAt: '2024-02-15 16:00:00',
    currentConclusion: '沉降速率略高于预期，需持续监测',
    isAbnormal: true,
    abnormalReason: '沉降速率超出正常值15%',
    conclusionChangeReason: '第二次观测数据显示沉降加速，原结论需修正',
    relatedRecords: ['rec-001'],
    notes: [
      {
        id: 'note-002',
        content: '现场签证单已确认',
        createdAt: '2024-02-10 12:00:00',
        author: '王工',
      },
      {
        id: 'note-003',
        content: '补充观测点，加密监测频率',
        createdAt: '2024-02-15 16:30:00',
        author: '李工',
      },
    ],
    screenshots: [
      {
        id: 'shot-002',
        url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=building%20foundation%20settlement%20observation%20point%20survey&image_size=square',
        description: '沉降观测点布设照片',
        uploadedAt: '2024-02-10 09:30:00',
        uploader: '王工',
      },
      {
        id: 'shot-003',
        url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=survey%20leveling%20instrument%20construction%20site&image_size=square',
        description: '第二次观测现场照',
        uploadedAt: '2024-02-15 14:00:00',
        uploader: '李工',
      },
    ],
    priority: 'high',
    handler: '李工',
  },
  {
    id: 'rec-003',
    recordNo: 'CL-2024-003',
    title: '2号楼结构加固变更单',
    building: '2号楼',
    status: 'delayed',
    source: 'change-order',
    createdAt: '2024-02-20 10:00:00',
    updatedAt: '2024-02-25 09:00:00',
    currentConclusion: '等待变更单确认',
    isAbnormal: false,
    relatedRecords: [],
    notes: [
      {
        id: 'note-004',
        content: '变更单已提交，设计院审核中',
        createdAt: '2024-02-20 15:00:00',
        author: '赵工',
      },
    ],
    screenshots: [],
    changeOrderDueDate: '2024-02-28',
    nextStepSuggestion: '1. 联系设计院确认审核进度；2. 提前准备加固方案备选材料；3. 若超期3天以上，启动加急流程',
    priority: 'high',
    handler: '赵工',
  },
  {
    id: 'rec-004',
    recordNo: 'CL-2024-004',
    title: '4号楼外墙饰面脱落测绘（已撤回）',
    building: '4号楼',
    status: 'withdrawn',
    source: 'withdrawal',
    createdAt: '2024-01-20 14:00:00',
    updatedAt: '2024-02-05 11:00:00',
    currentConclusion: '原测绘结论已撤回，最终以复测结论为准',
    isAbnormal: true,
    abnormalReason: '初次测绘数据有误，已撤回重测',
    conclusionChangeReason: '经复核，原饰面脱落面积计算错误，撤回原结论重新测绘',
    relatedRecords: ['rec-005'],
    withdrawalRecordId: 'rec-005',
    notes: [
      {
        id: 'note-005',
        content: '初次测绘记录，后因数据不准确撤回',
        createdAt: '2024-01-20 16:00:00',
        author: '孙工',
      },
      {
        id: 'note-006',
        content: '撤回原因：面积测算方法有误，已重新培训测量人员',
        createdAt: '2024-02-05 11:30:00',
        author: '技术负责人',
      },
    ],
    screenshots: [
      {
        id: 'shot-004',
        url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=building%20exterior%20wall%20tile%20falling%20off%20damage&image_size=square',
        description: '外墙饰面脱落现场（原测绘照片）',
        uploadedAt: '2024-01-20 15:00:00',
        uploader: '孙工',
      },
    ],
    priority: 'medium',
    handler: '孙工',
  },
  {
    id: 'rec-005',
    recordNo: 'CL-2024-005',
    title: '4号楼外墙饰面脱落复测',
    building: '4号楼',
    status: 'completed',
    source: 'withdrawal',
    createdAt: '2024-02-05 13:00:00',
    updatedAt: '2024-02-10 10:00:00',
    currentConclusion: '饰面脱落面积共2.5平方米，属局部老化，建议局部修补',
    isAbnormal: false,
    relatedRecords: ['rec-004'],
    notes: [
      {
        id: 'note-007',
        content: '复测完成，数据已复核',
        createdAt: '2024-02-10 14:00:00',
        author: '李工',
      },
    ],
    screenshots: [
      {
        id: 'shot-005',
        url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=building%20wall%20re-survey%20measurement%20tape%20professional&image_size=square',
        description: '复测现场照片',
        uploadedAt: '2024-02-05 15:00:00',
        uploader: '李工',
      },
      {
        id: 'shot-006',
        url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=survey%20report%20data%20sheet%20technical%20document&image_size=square',
        description: '复测数据记录',
        uploadedAt: '2024-02-10 11:00:00',
        uploader: '李工',
      },
    ],
    priority: 'medium',
    handler: '李工',
  },
  {
    id: 'rec-006',
    recordNo: 'CL-2024-006',
    title: '1号楼屋面防水测绘',
    building: '1号楼',
    status: 'pending',
    source: 'old-material',
    createdAt: '2024-02-28 08:00:00',
    updatedAt: '2024-02-28 08:00:00',
    currentConclusion: '待现场确认',
    isAbnormal: false,
    relatedRecords: [],
    notes: [],
    screenshots: [],
    priority: 'medium',
    handler: '周工',
  },
];

interface TrackingState {
  records: TrackingRecord[];
  filters: FilterState;
  selectedRecordId: string | null;
  searchKeyword: string;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  selectRecord: (id: string | null) => void;
  addNote: (recordId: string, content: string, author: string) => void;
  addScreenshot: (recordId: string, url: string, description: string, uploader: string) => void;
  addRecord: (record: Omit<TrackingRecord, 'id' | 'createdAt' | 'updatedAt' | 'notes' | 'screenshots' | 'relatedRecords'>) => void;
  addWithdrawalRecord: (originalRecordId: string, newRecord: Partial<TrackingRecord>, reason: string) => void;
  updateRecordStatus: (id: string, status: TrackingRecord['status']) => void;
  getFilteredRecords: () => TrackingRecord[];
  getPendingSummary: () => PendingSummary;
  getRelatedRecords: (recordId: string) => TrackingRecord[];
  getWithdrawalFinalRecord: (recordId: string) => TrackingRecord | null;
  importOldMaterial: (records: ImportRecordInput[]) => void;
}

export const useTrackingStore = create<TrackingState>()(
  persist(
    (set, get) => ({
      records: mockInitialRecords,
      filters: {
        status: 'all',
        source: 'all',
        building: '',
        keyword: '',
        isAbnormal: 'all',
      },
      selectedRecordId: null,
      searchKeyword: '',

      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      resetFilters: () =>
        set({
          filters: {
            status: 'all',
            source: 'all',
            building: '',
            keyword: '',
            isAbnormal: 'all',
          },
        }),

      selectRecord: (id) => set({ selectedRecordId: id }),

      addNote: (recordId, content, author) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  notes: [
                    ...r.notes,
                    {
                      id: generateId(),
                      content,
                      author,
                      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                    },
                  ],
                  updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                }
              : r
          ),
        })),

      addScreenshot: (recordId, url, description, uploader) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  screenshots: [
                    ...r.screenshots,
                    {
                      id: generateId(),
                      url,
                      description,
                      uploader,
                      uploadedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                    },
                  ],
                  updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                }
              : r
          ),
        })),

      addRecord: (record) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        set((state) => ({
          records: [
            ...state.records,
            {
              ...record,
              id: generateId(),
              createdAt: now,
              updatedAt: now,
              notes: [],
              screenshots: [],
              relatedRecords: [],
            },
          ],
        }));
      },

      addWithdrawalRecord: (originalRecordId, newRecord, reason) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        const newId = generateId();

        set((state) => ({
          records: state.records.map((r) => {
            if (r.id === originalRecordId) {
              return {
                ...r,
                status: 'withdrawn' as const,
                isAbnormal: true,
                abnormalReason: reason,
                conclusionChangeReason: reason,
                withdrawalRecordId: newId,
                relatedRecords: [...r.relatedRecords, newId],
                updatedAt: now,
                currentConclusion: '原结论已撤回，请查看最新复测记录',
                notes: [
                  ...r.notes,
                  {
                    id: generateId(),
                    content: `撤回原因：${reason}`,
                    createdAt: now,
                    author: '系统',
                  },
                ],
              };
            }
            return r;
          }),
        }));

        const originalRecord = get().records.find((r) => r.id === originalRecordId);
        if (!originalRecord) return;

        set((state) => ({
          records: [
            ...state.records,
            {
              id: newId,
              recordNo: `${originalRecord.recordNo}-R`,
              title: `${originalRecord.title}（复测）`,
              building: originalRecord.building,
              status: 'pending',
              source: 'withdrawal',
              createdAt: now,
              updatedAt: now,
              currentConclusion: newRecord.currentConclusion || '待复测确认',
              isAbnormal: false,
              relatedRecords: [originalRecordId],
              notes: [
                {
                  id: generateId(),
                  content: `由原记录 ${originalRecord.recordNo} 撤回后生成复测记录`,
                  createdAt: now,
                  author: '系统',
                },
              ],
              screenshots: [],
              priority: originalRecord.priority,
              handler: newRecord.handler || originalRecord.handler,
              ...newRecord,
            },
          ],
        }));
      },

      updateRecordStatus: (id, status) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                }
              : r
          ),
        })),

      getFilteredRecords: () => {
        const { records, filters } = get();
        return records.filter((r) => {
          if (filters.status !== 'all' && r.status !== filters.status) return false;
          if (filters.source !== 'all' && r.source !== filters.source) return false;
          if (filters.building && r.building !== filters.building) return false;
          if (filters.isAbnormal !== 'all' && r.isAbnormal !== filters.isAbnormal) return false;
          if (filters.keyword) {
            const kw = filters.keyword.toLowerCase();
            if (
              !r.title.toLowerCase().includes(kw) &&
              !r.recordNo.toLowerCase().includes(kw) &&
              !r.currentConclusion.toLowerCase().includes(kw)
            ) {
              return false;
            }
          }
          return true;
        });
      },

      getPendingSummary: () => {
        const { records } = get();
        const pendingRecords = records.filter(
          (r) => r.status === 'pending' || r.status === 'processing' || r.status === 'delayed'
        );
        return {
          total: pendingRecords.length,
          highPriority: pendingRecords.filter((r) => r.priority === 'high').length,
          delayed: pendingRecords.filter((r) => r.status === 'delayed').length,
          abnormal: pendingRecords.filter((r) => r.isAbnormal).length,
        };
      },

      getRelatedRecords: (recordId) => {
        const { records } = get();
        const record = records.find((r) => r.id === recordId);
        if (!record) return [];
        return records.filter((r) => record.relatedRecords.includes(r.id));
      },

      getWithdrawalFinalRecord: (recordId) => {
        const { records } = get();
        const record = records.find((r) => r.id === recordId);
        if (!record || !record.withdrawalRecordId) return null;
        return records.find((r) => r.id === record.withdrawalRecordId) || null;
      },

      importOldMaterial: (records) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        set((state) => ({
          records: [
            ...state.records,
            ...records.map((r) => ({
              isAbnormal: false,
              relatedRecords: [],
              notes: [],
              screenshots: [],
              ...r,
              id: generateId(),
              createdAt: r.createdAt || now,
              updatedAt: r.updatedAt || now,
            })) as TrackingRecord[],
          ],
        }));
      },
    }),
    {
      name: 'old-building-tracking-storage',
    }
  )
);
