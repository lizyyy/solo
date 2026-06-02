import { ProcessRecord, ShelterStatus } from '../types';

export const mockRecords: ProcessRecord[] = [
  {
    id: 'r1',
    shelterId: 's1',
    operator: '阿宁',
    operateTime: '2026-06-01 10:00:00',
    action: '初次审核',
    newStatus: ShelterStatus.PROCESSED,
    remark: '早高峰150人，设计容量200人，容量充足，无异常。'
  },
  {
    id: 'r2',
    shelterId: 's2',
    operator: '阿宁',
    operateTime: '2026-06-01 23:00:00',
    action: '接收投诉',
    newStatus: ShelterStatus.PENDING_VERIFY,
    remark: '李先生反馈晚高峰420人，设计容量300人，存在超限，需核实。同时发现坐标偏移约80米，待确认。'
  },
  {
    id: 'r3',
    shelterId: 's2',
    operator: '阿宁',
    operateTime: '2026-06-02 09:00:00',
    action: '重复投诉识别',
    oldStatus: ShelterStatus.PENDING_VERIFY,
    newStatus: ShelterStatus.PENDING_VERIFY,
    remark: '识别到李先生第二条反馈（东门口交叉口，380人）为同一地点同一时段的重复投诉，已合并处理。累计反馈人数取最大值420人。'
  },
  {
    id: 'r4',
    shelterId: 's3',
    operator: '阿宁',
    operateTime: '2026-06-01 21:00:00',
    action: '数据冲突检测',
    newStatus: ShelterStatus.PENDING_VERIFY,
    remark: '发现容量标准冲突：2020年旧口径500人，2024年翻新后新口径350人。居民反馈400人，按新标准已超限14%，按旧标准仅80%。需人工确认采信哪版标准。'
  },
  {
    id: 'r5',
    shelterId: 's4',
    operator: '阿宁',
    operateTime: '2026-06-02 13:00:00',
    action: '初次审核',
    newStatus: ShelterStatus.PROCESSED,
    remark: '午间120人，设计容量200人，正常。居民描述"社区广场"已自动归一化为标准名"中心广场"。'
  },
  {
    id: 'r6',
    shelterId: 's5',
    operator: '阿宁',
    operateTime: '2026-06-02 10:30:00',
    action: '初次审核',
    newStatus: ShelterStatus.PROCESSED,
    remark: '早高峰250人，设计容量300人，利用率83%，正常。居民描述"二中体育馆"已自动归一化为标准名"第二中学体育馆"。'
  },
  {
    id: 'r7',
    shelterId: 's2',
    operator: '阿宁',
    operateTime: '2026-06-02 10:00:00',
    action: '补充材料',
    oldStatus: ShelterStatus.PENDING_VERIFY,
    newStatus: ShelterStatus.ONSITE_CHECK,
    remark: '从历史居民反馈表中补充发现2026-05-28类似记录，当时反馈人数350人，已连续3天超容。建议现场复看确认实际情况。',
    supplementMaterial: '2026-05-28历史反馈记录：孙师傅反馈东门路口约350人，当时未深入处理。'
  }
];
