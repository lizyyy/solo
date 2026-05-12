import { ImportData, Promotion, TagPrintRecord, TagScan } from './types';
import { v4 as uuidv4 } from 'uuid';
import { generateHash } from './price-calculator';

function createDate(daysOffset: number, timeStr: string): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().replace('T', ' ').substring(0, 10) + ' ' + timeStr;
}

function days(relativeDays: number): string {
  return createDate(relativeDays, '00:00:00');
}

export function createSampleData(): ImportData {
  return {
    stores: [
      { id: 'STORE_001', name: '中关村店' },
      { id: 'STORE_002', name: '朝阳门店' },
      { id: 'STORE_003', name: '通州万达店' }
    ],
    
    products: [
      { sku: 'FRESH_001', name: '有机西兰花', category: '生鲜-蔬菜', unit: '500g', base_price: 8.9 },
      { sku: 'FRESH_002', name: '新鲜草莓', category: '生鲜-水果', unit: '盒', base_price: 25.8 },
      { sku: 'FRESH_003', name: '冰鲜三文鱼', category: '生鲜-水产', unit: '500g', base_price: 68.0 },
      
      { sku: 'DAILY_001', name: '海飞丝洗发露750ml', category: '日化-洗发', unit: '瓶', base_price: 59.9 },
      { sku: 'DAILY_002', name: '蓝月亮洗衣液3kg', category: '日化-洗衣', unit: '桶', base_price: 45.0 },
      { sku: 'DAILY_003', name: '清风抽纸120抽*3包', category: '日化-纸品', unit: '提', base_price: 28.5 },
      
      { sku: 'ELEC_001', name: '小米智能电视55寸', category: '家电-电视', unit: '台', base_price: 2999.0 },
      { sku: 'ELEC_002', name: '美的空调1.5匹', category: '家电-空调', unit: '台', base_price: 3299.0 },
      { sku: 'ELEC_003', name: '海尔冰箱216L', category: '家电-冰箱', unit: '台', base_price: 2599.0 }
    ],
    
    store_prices: [
      {
        id: uuidv4(),
        store_id: 'STORE_001',
        sku: 'FRESH_001',
        price: 7.9,
        effective_from: days(-7),
        effective_to: days(30)
      },
      {
        id: uuidv4(),
        store_id: 'STORE_001',
        sku: 'DAILY_002',
        price: 39.9,
        effective_from: days(-3),
        effective_to: days(14)
      },
      {
        id: uuidv4(),
        store_id: 'STORE_002',
        sku: 'ELEC_001',
        price: 2899.0,
        effective_from: days(-1),
        effective_to: days(7)
      }
    ],
    
    promotions: [
      {
        id: 'PROMO_F001',
        sku: 'FRESH_002',
        promotion_name: '周末生鲜特惠',
        promotion_type: 'FIXED_PRICE',
        discount_value: 19.9,
        effective_from: days(-2),
        effective_to: days(0),
        priority: 10
      },
      {
        id: 'PROMO_F002',
        sku: 'FRESH_002',
        promotion_name: '会员专享价',
        promotion_type: 'DISCOUNT_PERCENT',
        discount_value: 15,
        effective_from: days(-7),
        effective_to: days(30),
        priority: 5
      },
      
      {
        id: 'PROMO_D001',
        sku: 'DAILY_001',
        promotion_name: '买一送一活动',
        promotion_type: 'FIXED_PRICE',
        discount_value: 39.9,
        effective_from: days(-5),
        effective_to: days(2),
        priority: 8
      },
      {
        id: 'PROMO_D002',
        sku: 'DAILY_002',
        promotion_name: '满减优惠',
        promotion_type: 'DISCOUNT_AMOUNT',
        discount_value: 5.0,
        effective_from: days(-3),
        effective_to: days(14),
        priority: 6
      },
      
      {
        id: 'PROMO_E001',
        sku: 'ELEC_001',
        promotion_name: '618大促',
        promotion_type: 'DISCOUNT_AMOUNT',
        discount_value: 300.0,
        effective_from: days(1),
        effective_to: days(20),
        priority: 10
      },
      {
        id: 'PROMO_E002',
        sku: 'ELEC_002',
        promotion_name: '新品促销',
        promotion_type: 'DISCOUNT_PERCENT',
        discount_value: 10,
        effective_from: days(-10),
        effective_to: days(-3),
        priority: 7
      },
      
      {
        id: 'PROMO_EXPIRED',
        sku: 'FRESH_003',
        promotion_name: '已结束的活动',
        promotion_type: 'FIXED_PRICE',
        discount_value: 55.0,
        effective_from: days(-10),
        effective_to: days(-2),
        priority: 10
      }
    ],
    
    tag_print_records: [
      {
        id: 'PRINT_001',
        store_id: 'STORE_001',
        sku: 'FRESH_002',
        print_version: 'V20260511-01',
        printed_price: 19.9,
        printed_at: createDate(-1, '14:30:00'),
        printed_by: '打印员A',
        hash: generateHash('STORE_001|FRESH_002|V20260511-01|19.9')
      },
      {
        id: 'PRINT_002',
        store_id: 'STORE_001',
        sku: 'FRESH_001',
        print_version: 'V20260510-01',
        printed_price: 7.9,
        printed_at: createDate(-2, '09:00:00'),
        printed_by: '打印员A',
        hash: generateHash('STORE_001|FRESH_001|V20260510-01|7.9')
      },
      {
        id: 'PRINT_003',
        store_id: 'STORE_001',
        sku: 'DAILY_001',
        print_version: 'V20260508-01',
        printed_price: 59.9,
        printed_at: createDate(-4, '16:00:00'),
        printed_by: '打印员B',
        hash: generateHash('STORE_001|DAILY_001|V20260508-01|59.9')
      },
      {
        id: 'PRINT_004',
        store_id: 'STORE_001',
        sku: 'DAILY_002',
        print_version: 'V20260509-01',
        printed_price: 39.9,
        printed_at: createDate(-3, '10:00:00'),
        printed_by: '打印员B',
        hash: generateHash('STORE_001|DAILY_002|V20260509-01|39.9')
      },
      {
        id: 'PRINT_005',
        store_id: 'STORE_001',
        sku: 'ELEC_001',
        print_version: 'V20260511-01',
        printed_price: 2999.0,
        printed_at: createDate(-1, '09:00:00'),
        printed_by: '打印员C',
        hash: generateHash('STORE_001|ELEC_001|V20260511-01|2999.0')
      },
      {
        id: 'PRINT_006',
        store_id: 'STORE_002',
        sku: 'FRESH_003',
        print_version: 'V20260505-01',
        printed_price: 55.0,
        printed_at: createDate(-7, '11:00:00'),
        printed_by: '打印员D',
        hash: generateHash('STORE_002|FRESH_003|V20260505-01|55.0')
      }
    ],
    
    tag_scans: [
      {
        id: 'SCAN_001',
        store_id: 'STORE_001',
        sku: 'FRESH_002',
        scan_version: 'V20260511-01',
        scanned_price: 19.9,
        scanned_at: createDate(0, '08:00:00'),
        scanned_by: '理货员1',
        tag_id: 'PRINT_001',
        hash: generateHash('SCAN_001|STORE_001|FRESH_002|V20260511-01|19.9')
      },
      {
        id: 'SCAN_002',
        store_id: 'STORE_001',
        sku: 'FRESH_001',
        scan_version: 'V20260510-01',
        scanned_price: 7.9,
        scanned_at: createDate(0, '08:05:00'),
        scanned_by: '理货员1',
        tag_id: 'PRINT_002',
        hash: generateHash('SCAN_002|STORE_001|FRESH_001|V20260510-01|7.9')
      },
      {
        id: 'SCAN_003',
        store_id: 'STORE_001',
        sku: 'DAILY_001',
        scan_version: 'V20260508-01',
        scanned_price: 59.9,
        scanned_at: createDate(0, '08:10:00'),
        scanned_by: '理货员1',
        tag_id: 'PRINT_003',
        hash: generateHash('SCAN_003|STORE_001|DAILY_001|V20260508-01|59.9')
      },
      {
        id: 'SCAN_004',
        store_id: 'STORE_001',
        sku: 'DAILY_002',
        scan_version: 'V20260509-01',
        scanned_price: 34.9,
        scanned_at: createDate(0, '08:15:00'),
        scanned_by: '理货员2',
        tag_id: 'PRINT_004',
        hash: generateHash('SCAN_004|STORE_001|DAILY_002|V20260509-01|34.9')
      },
      {
        id: 'SCAN_005',
        store_id: 'STORE_001',
        sku: 'ELEC_001',
        scan_version: 'V20260511-01',
        scanned_price: 2999.0,
        scanned_at: createDate(0, '09:00:00'),
        scanned_by: '理货员2',
        tag_id: 'PRINT_005',
        hash: generateHash('SCAN_005|STORE_001|ELEC_001|V20260511-01|2999.0')
      },
      {
        id: 'SCAN_006',
        store_id: 'STORE_002',
        sku: 'FRESH_003',
        scan_version: 'V20260505-01',
        scanned_price: 55.0,
        scanned_at: createDate(0, '09:30:00'),
        scanned_by: '理货员3',
        tag_id: 'PRINT_006',
        hash: generateHash('SCAN_006|STORE_002|FRESH_003|V20260505-01|55.0')
      }
    ]
  };
}

export function createPassingScan(): ImportData {
  return {
    tag_scans: [
      {
        id: 'SCAN_PASS_001',
        store_id: 'STORE_001',
        sku: 'DAILY_003',
        scan_version: 'V20260511-01',
        scanned_price: 28.5,
        scanned_at: createDate(0, '10:00:00'),
        scanned_by: '理货员A',
        hash: generateHash('SCAN_PASS_001|STORE_001|DAILY_003|V20260511-01|28.5')
      }
    ]
  };
}
