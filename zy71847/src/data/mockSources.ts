import { DataSource } from '@/types';

export const mockSources: DataSource[] = [
  {
    id: 's001',
    type: 'inspection_photo',
    name: '2024-05-20 A机房巡检照片',
    uploader: '李明',
    uploadDate: '2024-05-20T10:30:00Z',
    description: 'A机房全机柜巡检拍摄，共128张照片',
  },
  {
    id: 's002',
    type: 'walkthrough',
    name: '2024-05-15 客户讲解路线记录',
    uploader: '王芳',
    uploadDate: '2024-05-15T14:00:00Z',
    description: '陪同客户参观时记录的线缆走向',
  },
  {
    id: 's003',
    type: 'inspection_photo',
    name: '2024-05-10 B机房巡检照片',
    uploader: '陈静',
    uploadDate: '2024-05-10T09:15:00Z',
    description: 'B机房例行巡检，重点检查B01-B04机柜',
  },
  {
    id: 's004',
    type: 'manual',
    name: '人工补录-2024-05-01',
    uploader: '张伟',
    uploadDate: '2024-05-01T16:45:00Z',
    description: '根据纸质记录人工补录的数据',
  },
  {
    id: 's005',
    type: 'walkthrough',
    name: '2024-04-25 新员工培训路线',
    uploader: '刘洋',
    uploadDate: '2024-04-25T11:00:00Z',
    description: '新员工入职培训时记录的讲解路线',
  },
];

export const findSourceById = (id: string): DataSource | undefined =>
  mockSources.find(s => s.id === id);
