import type { BidRecord } from '../types/auction';

export const sampleBids: BidRecord[] = [
  { id: 'BID-001', itemId: 'ITEM-001', buyerId: 'BUY-001', buyerName: '张先生', bidAmount: 520000, bidDate: '2025-01-10', bidType: 'floor', isWinning: false, buyerActivity: 8, buyerHistory: 12 },
  { id: 'BID-002', itemId: 'ITEM-001', buyerId: 'BUY-002', buyerName: '李女士', bidAmount: 580000, bidDate: '2025-01-10', bidType: 'phone', isWinning: false, buyerActivity: 7, buyerHistory: 8 },
  { id: 'BID-003', itemId: 'ITEM-001', buyerId: 'BUY-003', buyerName: '王总', bidAmount: 650000, bidDate: '2025-01-10', bidType: 'floor', isWinning: true, buyerActivity: 9, buyerHistory: 25 },
  { id: 'BID-004', itemId: 'ITEM-001', buyerId: 'BUY-004', buyerName: '陈先生', bidAmount: 480000, bidDate: '2025-01-09', bidType: 'absentee', isWinning: false, buyerActivity: 5, buyerHistory: 3 },
  { id: 'BID-005', itemId: 'ITEM-001', buyerId: 'BUY-005', buyerName: '刘女士', bidAmount: 600000, bidDate: '2025-01-08', bidType: 'online', isWinning: false, buyerActivity: 6, buyerHistory: 6 },

  { id: 'BID-006', itemId: 'ITEM-002', buyerId: 'BUY-006', buyerName: '赵先生', bidAmount: 980000, bidDate: '2024-12-15', bidType: 'floor', isWinning: false, buyerActivity: 8, buyerHistory: 18 },
  { id: 'BID-007', itemId: 'ITEM-002', buyerId: 'BUY-007', buyerName: '孙女士', bidAmount: 1100000, bidDate: '2024-12-15', bidType: 'phone', isWinning: false, buyerActivity: 7, buyerHistory: 11 },
  { id: 'BID-008', itemId: 'ITEM-002', buyerId: 'BUY-008', buyerName: '周先生', bidAmount: 1280000, bidDate: '2024-12-15', bidType: 'floor', isWinning: true, buyerActivity: 10, buyerHistory: 32 },
  { id: 'BID-009', itemId: 'ITEM-002', buyerId: 'BUY-009', buyerName: '吴女士', bidAmount: 1050000, bidDate: '2024-12-14', bidType: 'absentee', isWinning: false, buyerActivity: 4, buyerHistory: 2 },

  { id: 'BID-010', itemId: 'ITEM-003', buyerId: 'BUY-010', buyerName: '郑先生', bidAmount: 68000, bidDate: '2025-01-20', bidType: 'floor', isWinning: false, buyerActivity: 6, buyerHistory: 5 },
  { id: 'BID-011', itemId: 'ITEM-003', buyerId: 'BUY-011', buyerName: '冯女士', bidAmount: 75000, bidDate: '2025-01-20', bidType: 'online', isWinning: false, buyerActivity: 7, buyerHistory: 9 },
  { id: 'BID-012', itemId: 'ITEM-003', buyerId: 'BUY-012', buyerName: '蒋先生', bidAmount: 88000, bidDate: '2025-01-20', bidType: 'floor', isWinning: true, buyerActivity: 5, buyerHistory: 4 },

  { id: 'BID-013', itemId: 'ITEM-004', buyerId: 'BUY-013', buyerName: '韩女士', bidAmount: 250000, bidDate: '2024-11-05', bidType: 'phone', isWinning: false, buyerActivity: 8, buyerHistory: 15 },
  { id: 'BID-014', itemId: 'ITEM-004', buyerId: 'BUY-014', buyerName: '杨先生', bidAmount: 290000, bidDate: '2024-11-05', bidType: 'floor', isWinning: false, buyerActivity: 7, buyerHistory: 10 },
  { id: 'BID-015', itemId: 'ITEM-004', buyerId: 'BUY-015', buyerName: '朱女士', bidAmount: 325000, bidDate: '2024-11-05', bidType: 'floor', isWinning: true, buyerActivity: 9, buyerHistory: 22 },

  { id: 'BID-016', itemId: 'ITEM-005', buyerId: 'BUY-016', buyerName: '秦先生', bidAmount: 360000, bidDate: '2024-10-18', bidType: 'floor', isWinning: false, buyerActivity: 7, buyerHistory: 7 },
  { id: 'BID-017', itemId: 'ITEM-005', buyerId: 'BUY-017', buyerName: '尤女士', bidAmount: 410000, bidDate: '2024-10-18', bidType: 'phone', isWinning: false, buyerActivity: 6, buyerHistory: 5 },
  { id: 'BID-018', itemId: 'ITEM-005', buyerId: 'BUY-018', buyerName: '许先生', bidAmount: 465000, bidDate: '2024-10-18', bidType: 'floor', isWinning: true, buyerActivity: 8, buyerHistory: 19 },

  { id: 'BID-019', itemId: 'ITEM-001', buyerId: 'BUY-019', buyerName: '何女士', bidAmount: 550000, bidDate: '2025-01-07', bidType: 'absentee', isWinning: false, buyerActivity: 5, buyerHistory: 4 },
  { id: 'BID-020', itemId: 'ITEM-002', buyerId: 'BUY-020', buyerName: '吕先生', bidAmount: 890000, bidDate: '2024-12-12', bidType: 'online', isWinning: false, buyerActivity: 4, buyerHistory: 1 },

  { id: 'BID-021', itemId: 'ITEM-001', buyerId: 'BUY-003', buyerName: '王总', bidAmount: 450000, bidDate: '2024-06-15', bidType: 'floor', isWinning: false, buyerActivity: 9, buyerHistory: 25 },
  { id: 'BID-022', itemId: 'ITEM-002', buyerId: 'BUY-008', buyerName: '周先生', bidAmount: 950000, bidDate: '2024-05-20', bidType: 'floor', isWinning: true, buyerActivity: 10, buyerHistory: 32 },
  { id: 'BID-023', itemId: 'ITEM-004', buyerId: 'BUY-015', buyerName: '朱女士', bidAmount: 280000, bidDate: '2024-04-10', bidType: 'phone', isWinning: true, buyerActivity: 9, buyerHistory: 22 },
  { id: 'BID-024', itemId: 'ITEM-005', buyerId: 'BUY-018', buyerName: '许先生', bidAmount: 380000, bidDate: '2024-03-25', bidType: 'floor', isWinning: false, buyerActivity: 8, buyerHistory: 19 },
];
