import type { PhotoPoint, CoordinateTableEntry, OcclusionEntry } from '../types';

export const mockPhotoPoints: PhotoPoint[] = [
  { id: 'pp001', photoNumber: 'P2024-001', hasPoint: true, pixelX: 120, pixelY: 80 },
  { id: 'pp002', photoNumber: 'P2024-002', hasPoint: true, pixelX: 250, pixelY: 160 },
  { id: 'pp003', photoNumber: 'P2024-003', hasPoint: true, pixelX: 180, pixelY: 220 },
  { id: 'pp004', photoNumber: 'P2024-004', hasPoint: true, pixelX: 310, pixelY: 95 },
];

export const mockCoordinateTable: CoordinateTableEntry[] = [
  { id: 'ct001', photoPointId: 'pp001', x: 10.5, y: 2.3, z: 5.1 },
  { id: 'ct002', photoPointId: 'pp002', x: 12.8, y: 2.5, z: 5.3 },
  { id: 'ct004', photoPointId: 'pp004', x: 15.2, y: 2.1, z: 4.9 },
];

export const mockOcclusionList: OcclusionEntry[] = [
  { id: 'oc001', photoPointId: 'pp001', isOccluded: false, updatedAt: Date.now() },
  { id: 'oc002', photoPointId: 'pp002', isOccluded: false, updatedAt: Date.now() },
  { id: 'oc003', photoPointId: 'pp003', isOccluded: true, updatedAt: Date.now() },
  { id: 'oc004', photoPointId: 'pp004', isOccluded: false, updatedAt: Date.now() },
];

export const MOCK_COORDINATE_ORIGIN_CSV = `行号,照片点位ID,照片编号,X坐标,Y坐标,Z坐标
1,pp001,P2024-001,10.5,2.3,5.1
2,pp002,P2024-002,12.8,2.5,5.3
3,pp003,,
4,pp004,P2024-004,15.2,2.1,4.9
`;
