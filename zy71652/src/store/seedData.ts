import type { Order, Location } from '@/types'

const now = Date.now()

export const seedLocations: Location[] = [
  { id: 'loc-01', code: 'A01', x: 2, y: 3, isDuplicate: false },
  { id: 'loc-02', code: 'A02', x: 4, y: 6, isDuplicate: false },
  { id: 'loc-03', code: 'A03', x: 5, y: 8, isDuplicate: true },
  { id: 'loc-04', code: 'B01', x: 8, y: 2, isDuplicate: false },
  { id: 'loc-05', code: 'B02', x: 9, y: 5, isDuplicate: false },
  { id: 'loc-06', code: 'B03', x: 7, y: 9, isDuplicate: false },
  { id: 'loc-07', code: 'B07', x: 5, y: 8, isDuplicate: true },
  { id: 'loc-08', code: 'C01', x: 3, y: 1, isDuplicate: false },
  { id: 'loc-09', code: 'C02', x: 6, y: 4, isDuplicate: false },
  { id: 'loc-10', code: 'C05', x: 10, y: 7, isDuplicate: false },
  { id: 'loc-11', code: 'D02', x: 12, y: 3, isDuplicate: true },
  { id: 'loc-12', code: 'D05', x: 14, y: 6, isDuplicate: false },
  { id: 'loc-13', code: 'E03', x: 11, y: 9, isDuplicate: false },
  { id: 'loc-14', code: 'E08', x: 15, y: 1, isDuplicate: false },
  { id: 'loc-15', code: 'E11', x: 12, y: 3, isDuplicate: true },
]

export const seedOrders: Order[] = [
  {
    id: 'ord-01',
    orderNo: 'WH-20260530-001',
    pickerId: 'picker-01',
    deadline: now + 30 * 60000,
    status: 'confirmed',
    notes: '常规日用品拣货',
    createdAt: now - 15 * 60000,
    items: [
      { id: 'item-0101', orderId: 'ord-01', sku: 'SKU-10021', locationId: 'loc-01', quantity: 2, coldChain: false, coldChainMaxMin: 0 },
      { id: 'item-0102', orderId: 'ord-01', sku: 'SKU-10034', locationId: 'loc-04', quantity: 1, coldChain: false, coldChainMaxMin: 0 },
    ],
  },
  {
    id: 'ord-02',
    orderNo: 'WH-20260530-002',
    pickerId: 'picker-01',
    deadline: now + 45 * 60000,
    status: 'confirmed',
    notes: '冷链食品订单',
    createdAt: now - 12 * 60000,
    items: [
      { id: 'item-0201', orderId: 'ord-02', sku: 'SKU-20015', locationId: 'loc-03', quantity: 3, coldChain: true, coldChainMaxMin: 30 },
      { id: 'item-0202', orderId: 'ord-02', sku: 'SKU-20022', locationId: 'loc-06', quantity: 1, coldChain: true, coldChainMaxMin: 25 },
    ],
  },
  {
    id: 'ord-03',
    orderNo: 'WH-20260530-003',
    pickerId: 'picker-01',
    deadline: now + 60 * 60000,
    status: 'confirmed',
    notes: '电子配件拣货',
    createdAt: now - 10 * 60000,
    items: [
      { id: 'item-0301', orderId: 'ord-03', sku: 'SKU-30011', locationId: 'loc-09', quantity: 5, coldChain: false, coldChainMaxMin: 0 },
      { id: 'item-0302', orderId: 'ord-03', sku: 'SKU-30018', locationId: 'loc-12', quantity: 2, coldChain: false, coldChainMaxMin: 0 },
      { id: 'item-0303', orderId: 'ord-03', sku: 'SKU-30025', locationId: 'loc-02', quantity: 1, coldChain: false, coldChainMaxMin: 0 },
    ],
  },
  {
    id: 'ord-04',
    orderNo: 'WH-20260530-004',
    pickerId: 'picker-01',
    deadline: now + 75 * 60000,
    status: 'confirmed',
    notes: '冷藏药品订单',
    createdAt: now - 8 * 60000,
    items: [
      { id: 'item-0401', orderId: 'ord-04', sku: 'SKU-40009', locationId: 'loc-11', quantity: 1, coldChain: true, coldChainMaxMin: 20 },
      { id: 'item-0402', orderId: 'ord-04', sku: 'SKU-40016', locationId: 'loc-08', quantity: 4, coldChain: false, coldChainMaxMin: 0 },
    ],
  },
  {
    id: 'ord-05',
    orderNo: 'WH-20260530-005',
    pickerId: 'picker-01',
    deadline: now + 90 * 60000,
    status: 'confirmed',
    notes: '文具办公用品',
    createdAt: now - 6 * 60000,
    items: [
      { id: 'item-0501', orderId: 'ord-05', sku: 'SKU-50007', locationId: 'loc-05', quantity: 10, coldChain: false, coldChainMaxMin: 0 },
      { id: 'item-0502', orderId: 'ord-05', sku: 'SKU-50013', locationId: 'loc-10', quantity: 3, coldChain: false, coldChainMaxMin: 0 },
    ],
  },
  {
    id: 'ord-06',
    orderNo: 'WH-20260530-006',
    pickerId: 'picker-01',
    deadline: now + 100 * 60000,
    status: 'confirmed',
    notes: '混合商品订单',
    createdAt: now - 5 * 60000,
    items: [
      { id: 'item-0601', orderId: 'ord-06', sku: 'SKU-60003', locationId: 'loc-13', quantity: 2, coldChain: false, coldChainMaxMin: 0 },
      { id: 'item-0602', orderId: 'ord-06', sku: 'SKU-60019', locationId: 'loc-07', quantity: 1, coldChain: false, coldChainMaxMin: 0 },
      { id: 'item-0603', orderId: 'ord-06', sku: 'SKU-60028', locationId: 'loc-15', quantity: 6, coldChain: false, coldChainMaxMin: 0 },
    ],
  },
  {
    id: 'ord-07',
    orderNo: 'WH-20260530-007',
    pickerId: 'picker-01',
    deadline: now + 110 * 60000,
    status: 'confirmed',
    notes: '冷链生鲜订单',
    createdAt: now - 3 * 60000,
    items: [
      { id: 'item-0701', orderId: 'ord-07', sku: 'SKU-70004', locationId: 'loc-14', quantity: 2, coldChain: true, coldChainMaxMin: 15 },
      { id: 'item-0702', orderId: 'ord-07', sku: 'SKU-70011', locationId: 'loc-03', quantity: 1, coldChain: false, coldChainMaxMin: 0 },
    ],
  },
  {
    id: 'ord-08',
    orderNo: 'WH-20260530-008',
    pickerId: '',
    deadline: now + 50 * 60000,
    status: 'draft',
    notes: '迟到的紧急订单-需优先处理',
    createdAt: now - 2 * 60000,
    items: [
      { id: 'item-0801', orderId: 'ord-08', sku: 'SKU-80005', locationId: 'loc-02', quantity: 8, coldChain: false, coldChainMaxMin: 0 },
      { id: 'item-0802', orderId: 'ord-08', sku: 'SKU-80012', locationId: 'loc-09', quantity: 4, coldChain: false, coldChainMaxMin: 0 },
    ],
  },
  {
    id: 'ord-09',
    orderNo: 'WH-20260530-009',
    pickerId: '',
    deadline: now + 55 * 60000,
    status: 'draft',
    notes: '迟到的冷链紧急订单-需优先处理',
    createdAt: now - 1 * 60000,
    items: [
      { id: 'item-0901', orderId: 'ord-09', sku: 'SKU-90002', locationId: 'loc-06', quantity: 3, coldChain: true, coldChainMaxMin: 20 },
      { id: 'item-0902', orderId: 'ord-09', sku: 'SKU-90018', locationId: 'loc-11', quantity: 2, coldChain: false, coldChainMaxMin: 0 },
    ],
  },
  {
    id: 'ord-10',
    orderNo: 'WH-20260530-010',
    pickerId: 'picker-01',
    deadline: now + 120 * 60000,
    status: 'confirmed',
    notes: '常规补货订单',
    createdAt: now - 20 * 60000,
    items: [
      { id: 'item-1001', orderId: 'ord-10', sku: 'SKU-10006', locationId: 'loc-01', quantity: 20, coldChain: false, coldChainMaxMin: 0 },
      { id: 'item-1002', orderId: 'ord-10', sku: 'SKU-10014', locationId: 'loc-08', quantity: 15, coldChain: false, coldChainMaxMin: 0 },
      { id: 'item-1003', orderId: 'ord-10', sku: 'SKU-10029', locationId: 'loc-14', quantity: 7, coldChain: false, coldChainMaxMin: 0 },
    ],
  },
]

export const seedPickers: string[] = ['张伟']
