import type { TransactionRecord } from '../types/auction';

export const sampleTransactions: TransactionRecord[] = [
  { id: 'TRX-001', itemId: 'ITEM-001', itemName: '清乾隆粉彩缠枝莲纹瓶', salePrice: 650000, reservePrice: 550000, saleDate: '2025-01-10', buyerId: 'BUY-003', commissionRate: 15, commissionAmount: 97500, auctionHouse: '北京保利', notes: '竞争激烈，超过估价成交' },
  { id: 'TRX-002', itemId: 'ITEM-002', itemName: '张大千《山水四条屏》', salePrice: 1280000, reservePrice: 1000000, saleDate: '2024-12-15', buyerId: 'BUY-008', commissionRate: 12, commissionAmount: 153600, auctionHouse: '中国嘉德', notes: '夜场精品，多位藏家竞争' },
  { id: 'TRX-003', itemId: 'ITEM-003', itemName: '和田白玉籽料把件', salePrice: 88000, reservePrice: 70000, saleDate: '2025-01-20', buyerId: 'BUY-012', commissionRate: 20, commissionAmount: 17600, auctionHouse: '西泠印社', notes: '玉器专场成交' },
  { id: 'TRX-004', itemId: 'ITEM-004', itemName: '明宣德铜鎏金释迦牟尼像', salePrice: 325000, reservePrice: 280000, saleDate: '2024-11-05', buyerId: 'BUY-015', commissionRate: 15, commissionAmount: 48750, auctionHouse: '北京保利', notes: '宗教艺术品专场' },
  { id: 'TRX-005', itemId: 'ITEM-005', itemName: '清代紫檀木雕龙纹宝座', salePrice: 465000, reservePrice: 380000, saleDate: '2024-10-18', buyerId: 'BUY-018', commissionRate: 15, commissionAmount: 69750, auctionHouse: '中国嘉德', notes: '家具专场重器' },

  { id: 'TRX-006', itemId: 'ITEM-006', itemName: '清雍正青花缠枝莲纹盘', salePrice: 185000, reservePrice: 150000, saleDate: '2024-09-20', buyerId: 'BUY-021', commissionRate: 20, commissionAmount: 37000, auctionHouse: '北京翰海' },
  { id: 'TRX-007', itemId: 'ITEM-007', itemName: '齐白石《虾趣图》', salePrice: 520000, reservePrice: 420000, saleDate: '2024-08-15', buyerId: 'BUY-022', commissionRate: 15, commissionAmount: 78000, auctionHouse: '北京荣宝' },
  { id: 'TRX-008', itemId: 'ITEM-008', itemName: '翡翠冰种观音挂件', salePrice: 125000, reservePrice: 100000, saleDate: '2024-07-28', buyerId: 'BUY-023', commissionRate: 20, commissionAmount: 25000, auctionHouse: '香港苏富比' },
  { id: 'TRX-009', itemId: 'ITEM-009', itemName: '商代青铜饕餮纹鼎', salePrice: 890000, reservePrice: 750000, saleDate: '2024-06-10', buyerId: 'BUY-024', commissionRate: 12, commissionAmount: 106800, auctionHouse: '佳士得上海' },
  { id: 'TRX-010', itemId: 'ITEM-010', itemName: '黄花梨雕螭龙纹条案', salePrice: 780000, reservePrice: 650000, saleDate: '2024-05-18', buyerId: 'BUY-025', commissionRate: 15, commissionAmount: 117000, auctionHouse: '南京经典' },

  { id: 'TRX-011', itemId: 'ITEM-002', itemName: '张大千《青绿山水》', salePrice: 950000, reservePrice: 800000, saleDate: '2024-05-20', buyerId: 'BUY-008', commissionRate: 15, commissionAmount: 142500, auctionHouse: '中国嘉德' },
  { id: 'TRX-012', itemId: 'ITEM-004', itemName: '明永乐铜鎏金佛像', salePrice: 280000, reservePrice: 220000, saleDate: '2024-04-10', buyerId: 'BUY-015', commissionRate: 15, commissionAmount: 42000, auctionHouse: '北京保利' },
  { id: 'TRX-013', itemId: 'ITEM-011', itemName: '清康熙五彩人物故事棒槌瓶', salePrice: 365000, reservePrice: 300000, saleDate: '2024-03-15', buyerId: 'BUY-026', commissionRate: 15, commissionAmount: 54750, auctionHouse: '中贸圣佳' },
  { id: 'TRX-014', itemId: 'ITEM-012', itemName: '徐悲鸿《奔马图》', salePrice: 680000, reservePrice: 550000, saleDate: '2024-02-20', buyerId: 'BUY-027', commissionRate: 15, commissionAmount: 102000, auctionHouse: '北京保利' },
  { id: 'TRX-015', itemId: 'ITEM-013', itemName: '田黄冻石薄意雕印章', salePrice: 420000, reservePrice: 350000, saleDate: '2024-01-25', buyerId: 'BUY-028', commissionRate: 15, commissionAmount: 63000, auctionHouse: '西泠印社' },

  { id: 'TRX-016', itemId: 'ITEM-014', itemName: '清乾隆剔红雕漆龙纹盒', salePrice: 158000, reservePrice: 120000, saleDate: '2023-12-18', buyerId: 'BUY-029', commissionRate: 20, commissionAmount: 31600, auctionHouse: '北京翰海' },
  { id: 'TRX-017', itemId: 'ITEM-015', itemName: '傅抱石《山水清音》', salePrice: 2100000, reservePrice: 1800000, saleDate: '2023-11-25', buyerId: 'BUY-030', commissionRate: 12, commissionAmount: 252000, auctionHouse: '中国嘉德', notes: '秋拍夜场最高价' },
  { id: 'TRX-018', itemId: 'ITEM-016', itemName: '和田羊脂白玉手镯', salePrice: 95000, reservePrice: 75000, saleDate: '2023-10-30', buyerId: 'BUY-031', commissionRate: 20, commissionAmount: 19000, auctionHouse: '新疆品臻' },
  { id: 'TRX-019', itemId: 'ITEM-017', itemName: '战国青铜错金银剑', salePrice: 560000, reservePrice: 480000, saleDate: '2023-09-15', buyerId: 'BUY-032', commissionRate: 15, commissionAmount: 84000, auctionHouse: '佳士得香港' },
  { id: 'TRX-020', itemId: 'ITEM-018', itemName: '明代沉香雕观音像', salePrice: 320000, reservePrice: 260000, saleDate: '2023-08-20', buyerId: 'BUY-033', commissionRate: 15, commissionAmount: 48000, auctionHouse: '福建东南' },
];
