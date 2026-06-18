import type { Remark } from '../types';

export const remarksData: Record<string, Remark[]> = {
  'rec-st-001-0008': [
    {
      id: 'rm-001',
      recordId: 'rec-st-001-0008',
      content: '这个值看起来不太对，像噪声但不能直接删，等周一早会讨论',
      author: '小宋',
      time: '2026-06-17T08:30:00',
      isVerbal: false,
    },
    {
      id: 'rm-002',
      recordId: 'rec-st-001-0008',
      content: '隔壁站也有类似突增，可能是风暴潮影响',
      author: '张工',
      time: '2026-06-17T09:15:00',
      isVerbal: true,
    },
  ],
  'rec-st-001-0015': [
    {
      id: 'rm-003',
      recordId: 'rec-st-001-0015',
      content: '单位不对，这是从老系统导的厘米数据',
      author: '老李',
      time: '2026-06-16T14:20:00',
      isVerbal: true,
    },
  ],
  'rec-st-001-0022': [
    {
      id: 'rm-004',
      recordId: 'rec-st-001-0022',
      content: '旧版编号，需要对照转换表更新',
      author: '小宋',
      time: '2026-06-17T10:00:00',
      isVerbal: false,
    },
  ],
  'rec-st-001-0030': [
    {
      id: 'rm-005',
      recordId: 'rec-st-001-0030',
      content: '已电话确认张工的改判，附照片在共享盘/202606/现场照',
      author: '小宋',
      time: '2026-06-16T16:30:00',
      isVerbal: false,
    },
  ],
};

export function getRemarks(recordId: string): Remark[] {
  return remarksData[recordId] || [];
}
