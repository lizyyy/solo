import { Photo } from '@/types';

export const mockPhotos: Photo[] = [
  {
    id: 'photo-001',
    pointId: 'rc-001',
    url: 'https://picsum.photos/seed/rc001/400/300',
    description: 'RC-001 主舞台左侧，安装到位',
    takenAt: '2024-12-01 14:30',
    markedCoordinates: '(3.5, 2.0, 2.0)'
  },
  {
    id: 'photo-002',
    pointId: 'rc-002',
    url: 'https://picsum.photos/seed/rc002/400/300',
    description: 'RC-002 主舞台右侧，角度正常',
    takenAt: '2024-12-01 14:35',
    markedCoordinates: '(6.5, 2.0, 2.0)'
  },
  {
    id: 'photo-007',
    pointId: 'rc-007',
    url: 'https://picsum.photos/seed/rc007/400/300',
    description: 'RC-007 这个位置好像跟图纸有点差...',
    takenAt: '2024-12-04 10:20',
    markedCoordinates: '(3.2, 1.8, 3.0)'
  },
  {
    id: 'photo-009',
    pointId: 'rc-009',
    url: 'https://picsum.photos/seed/rc009/400/300',
    description: 'RC-009 墙边这个，是不是太靠边了？',
    takenAt: '2024-12-05 16:45',
    markedCoordinates: '(9.8, 0.1, 4.9)'
  }
];
