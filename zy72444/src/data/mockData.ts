import type {
  Batch,
  AttendanceRecord,
  TicketRecord,
  NoteHistory,
  AuthorizationAlert,
  ProcessStep,
  CalcParams,
} from '@/types';

export const mockBatches: Batch[] = [
  {
    id: 'batch-001',
    name: '2024春季儿童合奏课第3周',
    date: '2024-03-15',
    status: 'reviewing',
    hasMixedType: true,
    totalCount: 24,
    freeTicketCount: 8,
    paidTicketCount: 16,
    attendancePhotoHash: 'abc123xyz',
    ticketExportHash: 'def456uvw',
    createdAt: '2024-03-15T09:00:00Z',
    updatedAt: '2024-03-15T14:30:00Z',
  },
  {
    id: 'batch-002',
    name: '2024春季儿童合奏课第4周',
    date: '2024-03-22',
    status: 'pending',
    hasMixedType: false,
    totalCount: 20,
    freeTicketCount: 0,
    paidTicketCount: 20,
    attendancePhotoHash: 'ghi789rst',
    createdAt: '2024-03-22T09:00:00Z',
    updatedAt: '2024-03-22T10:15:00Z',
  },
  {
    id: 'batch-003',
    name: '2024春季儿童合奏课第2周',
    date: '2024-03-08',
    status: 'authorized',
    hasMixedType: true,
    totalCount: 22,
    freeTicketCount: 5,
    paidTicketCount: 17,
    attendancePhotoHash: 'jkl012mno',
    ticketExportHash: 'pqr345stu',
    createdAt: '2024-03-08T09:00:00Z',
    updatedAt: '2024-03-08T16:00:00Z',
  },
];

export const mockAttendanceRecords: AttendanceRecord[] = [
  { id: 'att-001', batchId: 'batch-001', name: '张小明', type: 'paid', sourcePhotoRef: 'photo-row-1-col-1', remark: '准时到达', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-002', batchId: 'batch-001', name: '李小红', type: 'free', sourcePhotoRef: 'photo-row-1-col-2', remark: '赠票-合作机构', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-003', batchId: 'batch-001', name: '王小刚', type: 'paid', sourcePhotoRef: 'photo-row-1-col-3', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-004', batchId: 'batch-001', name: '赵小美', type: 'free', sourcePhotoRef: 'photo-row-2-col-1', remark: '赠票-员工子女', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-005', batchId: 'batch-001', name: '陈小华', type: 'paid', sourcePhotoRef: 'photo-row-2-col-2', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-006', batchId: 'batch-001', name: '刘小军', type: 'paid', sourcePhotoRef: 'photo-row-2-col-3', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-007', batchId: 'batch-001', name: '孙小丽', type: 'free', sourcePhotoRef: 'photo-row-3-col-1', remark: '赠票-媒体', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-008', batchId: 'batch-001', name: '周小伟', type: 'paid', sourcePhotoRef: 'photo-row-3-col-2', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-009', batchId: 'batch-001', name: '吴小燕', type: 'paid', sourcePhotoRef: 'photo-row-3-col-3', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-010', batchId: 'batch-001', name: '郑小强', type: 'free', sourcePhotoRef: 'photo-row-4-col-1', remark: '赠票-合作机构', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-011', batchId: 'batch-001', name: '冯小芳', type: 'paid', sourcePhotoRef: 'photo-row-4-col-2', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-012', batchId: 'batch-001', name: '于小磊', type: 'paid', sourcePhotoRef: 'photo-row-4-col-3', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-013', batchId: 'batch-001', name: '董小晶', type: 'free', sourcePhotoRef: 'photo-row-5-col-1', remark: '赠票-员工子女', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-014', batchId: 'batch-001', name: '萧小鹏', type: 'paid', sourcePhotoRef: 'photo-row-5-col-2', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-015', batchId: 'batch-001', name: '程小雨', type: 'paid', sourcePhotoRef: 'photo-row-5-col-3', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-016', batchId: 'batch-001', name: '曹小阳', type: 'paid', sourcePhotoRef: 'photo-row-6-col-1', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-017', batchId: 'batch-001', name: '袁小欣', type: 'free', sourcePhotoRef: 'photo-row-6-col-2', remark: '赠票-媒体', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-018', batchId: 'batch-001', name: '邓小宇', type: 'paid', sourcePhotoRef: 'photo-row-6-col-3', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-019', batchId: 'batch-001', name: '许小婷', type: 'paid', sourcePhotoRef: 'photo-row-7-col-1', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-020', batchId: 'batch-001', name: '傅小杰', type: 'paid', sourcePhotoRef: 'photo-row-7-col-2', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-021', batchId: 'batch-001', name: '沈小琳', type: 'free', sourcePhotoRef: 'photo-row-7-col-3', remark: '赠票-合作机构', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-022', batchId: 'batch-001', name: '曾小浩', type: 'paid', sourcePhotoRef: 'photo-row-8-col-1', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-023', batchId: 'batch-001', name: '彭小雯', type: 'paid', sourcePhotoRef: 'photo-row-8-col-2', createdAt: '2024-03-15T09:05:00Z' },
  { id: 'att-024', batchId: 'batch-001', name: '吕小博', type: 'free', sourcePhotoRef: 'photo-row-8-col-3', remark: '赠票-员工子女', createdAt: '2024-03-15T09:05:00Z' },
];

export const mockTicketRecords: TicketRecord[] = [
  { id: 'tkt-001', batchId: 'batch-001', ticketNo: 'T20240315001', type: 'paid', purchaser: '张先生', sourceExportRef: 'export-row-2', createdAt: '2024-03-10T14:30:00Z' },
  { id: 'tkt-002', batchId: 'batch-001', ticketNo: 'F20240315001', type: 'free', purchaser: '合作机构A', sourceExportRef: 'export-row-3', createdAt: '2024-03-12T10:00:00Z' },
  { id: 'tkt-003', batchId: 'batch-001', ticketNo: 'T20240315002', type: 'paid', purchaser: '王女士', sourceExportRef: 'export-row-4', createdAt: '2024-03-11T09:15:00Z' },
  { id: 'tkt-004', batchId: 'batch-001', ticketNo: 'F20240315002', type: 'free', purchaser: '内部员工', sourceExportRef: 'export-row-5', createdAt: '2024-03-13T16:45:00Z' },
];

export const mockNoteHistories: NoteHistory[] = [
  {
    id: 'nh-001',
    batchId: 'batch-001',
    recordId: 'att-002',
    oldContent: '赠票',
    newContent: '赠票-合作机构',
    modifiedBy: 'copyright',
    modifiedAt: '2024-03-15T11:20:00Z',
  },
  {
    id: 'nh-002',
    batchId: 'batch-001',
    recordId: 'att-004',
    oldContent: '',
    newContent: '赠票-员工子女',
    modifiedBy: 'copyright',
    modifiedAt: '2024-03-15T11:25:00Z',
  },
];

export const mockAuthorizationAlerts: AuthorizationAlert[] = [
  {
    id: 'alert-001',
    batchId: 'batch-001',
    title: '存在赠票与售票混批，需要录音师复核',
    reason: '本批次共24人，其中8人为赠票、16人为售票，两种类型混合在同一批次导入。根据流程要求，混批数据不可直接标记为正常，需录音师最终确认。',
    missingMaterials: ['部分赠票缺少合作机构盖章确认函', '3条记录的票务信息未与签到照片一一对应'],
    nextStep: '请录音师在10分钟内完成复核，确认无误后点击授权；如有问题请退回版权运营小鹿补充材料。',
    assignee: 'recorder',
    isResolved: false,
    createdAt: '2024-03-15T14:30:00Z',
  },
];

export const mockProcessSteps: ProcessStep[] = [
  {
    id: 'ps-001',
    batchId: 'batch-001',
    currentStep: 3,
    step1Completed: true,
    step2Completed: true,
    step3Completed: false,
    step1At: '2024-03-15T09:05:00Z',
    step2At: '2024-03-15T11:30:00Z',
  },
  {
    id: 'ps-002',
    batchId: 'batch-002',
    currentStep: 1,
    step1Completed: true,
    step2Completed: false,
    step3Completed: false,
    step1At: '2024-03-22T10:15:00Z',
  },
  {
    id: 'ps-003',
    batchId: 'batch-003',
    currentStep: 3,
    step1Completed: true,
    step2Completed: true,
    step3Completed: true,
    step1At: '2024-03-08T09:30:00Z',
    step2At: '2024-03-08T13:00:00Z',
    step3At: '2024-03-08T16:00:00Z',
  },
];

export const mockCalcParams: CalcParams = {
  id: 'cp-001',
  version: 'v1.2.0',
  modelName: 'ticket-mixed-detector',
  parameters: {
    freeTicketThreshold: 0.2,
    similarityThreshold: 0.85,
    photoHashAlgorithm: 'dhash-128',
    dedupWindowDays: 7,
  },
  tradeOffReason: '选择dhash-128而非phash，原因是课时签到照片背景固定、文字较多，dhash对对比度变化更敏感，去重准确率提升12%，但CPU占用增加8%；在当前并发下可接受。相似阈值设为0.85而非0.9，可减少误判漏检，代价是偶尔需要人工二次确认。',
  createdAt: '2024-02-01T00:00:00Z',
};
