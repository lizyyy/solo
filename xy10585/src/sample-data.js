const { store, db } = require('./database');
const { v4: uuidv4 } = require('uuid');

function loadSampleData() {
  const result = db.transaction(() => {
    store.adjustments = [];
    store.bill_age_details = [];
    store.bill_line_items = [];
    store.bill_status_history = [];
    store.bills = [];
    store.operations = [];
    store.inventory_snapshots = [];
    store.operation_ladders = [];
    store.age_ladders = [];
    store.zone_rates = [];
    store.temperature_zones = [];
    store.customers = [];
    store.idempotent_records = [];

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const periodStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const periodEnd = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`;
    const midMonth = Math.floor(daysInMonth / 2);
    const midDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(midMonth).padStart(2, '0')}`;

    const coldZoneId = uuidv4();
    const frozenZoneId = uuidv4();
    const normalZoneId = uuidv4();

    const formatDate = (d) => d.toISOString().split('T')[0];

    store.temperature_zones.push(
      {
        id: normalZoneId,
        name: '常温区',
        code: 'NORMAL',
        description: '普通温度储存，15-25°C',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: coldZoneId,
        name: '冷藏区',
        code: 'COLD',
        description: '冷链冷藏，2-8°C',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: frozenZoneId,
        name: '冷冻区',
        code: 'FROZEN',
        description: '冷链冷冻，-18°C以下',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      }
    );

    store.age_ladders.push(
      {
        id: 'AL001',
        name: '0-30天',
        min_days: 0,
        max_days: 30,
        multiplier: 1.0,
        description: '标准费率',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: 'AL002',
        name: '31-60天',
        min_days: 31,
        max_days: 60,
        multiplier: 1.2,
        description: '超库龄加价20%',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: 'AL003',
        name: '61-90天',
        min_days: 61,
        max_days: 90,
        multiplier: 1.5,
        description: '超库龄加价50%',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: 'AL004',
        name: '90天以上',
        min_days: 91,
        max_days: null,
        multiplier: 2.0,
        description: '超库龄加价100%',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      }
    );

    store.operation_ladders.push(
      {
        id: 'OL001',
        name: '0-50次',
        min_operations: 0,
        max_operations: 50,
        discount_rate: 1.0,
        description: '标准费率',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: 'OL002',
        name: '51-200次',
        min_operations: 51,
        max_operations: 200,
        discount_rate: 0.95,
        description: '5%折扣',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: 'OL003',
        name: '201-500次',
        min_operations: 201,
        max_operations: 500,
        discount_rate: 0.90,
        description: '10%折扣',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: 'OL004',
        name: '500次以上',
        min_operations: 501,
        max_operations: null,
        discount_rate: 0.85,
        description: '15%折扣',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      }
    );

    store.zone_rates.push(
      {
        id: 'ZR001',
        zone_id: normalZoneId,
        customer_id: null,
        storage_rate_per_cbm_per_day: 2.00,
        in_operation_fee: 15.00,
        out_operation_fee: 20.00,
        effective_date: '2024-01-01',
        end_date: null,
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: 'ZR002',
        zone_id: coldZoneId,
        customer_id: null,
        storage_rate_per_cbm_per_day: 5.00,
        in_operation_fee: 25.00,
        out_operation_fee: 35.00,
        effective_date: '2024-01-01',
        end_date: null,
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: 'ZR003',
        zone_id: frozenZoneId,
        customer_id: null,
        storage_rate_per_cbm_per_day: 8.00,
        in_operation_fee: 40.00,
        out_operation_fee: 55.00,
        effective_date: '2024-01-01',
        end_date: null,
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      }
    );

    const customer1Id = 'CUST001';
    const customer2Id = 'CUST002';

    store.customers.push(
      {
        id: customer1Id,
        name: '鲜来鲜往食品有限公司',
        contact_info: '张经理 13800138001',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19),
        updated_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: customer2Id,
        name: '四季果蔬贸易有限公司',
        contact_info: '李总 13900139002',
        created_at: now.toISOString().replace('T', ' ').substring(0, 19),
        updated_at: now.toISOString().replace('T', ' ').substring(0, 19)
      }
    );

    const longAgo15Days = new Date(year, month, midMonth - 15);
    const longAgo45Days = new Date(year, month, midMonth - 45);
    const longAgo100Days = new Date(year, month, midMonth - 100);

    store.inventory_snapshots.push(
      {
        id: uuidv4(),
        customer_id: customer1Id,
        zone_id: normalZoneId,
        product_sku: 'SKU-APPLE-001',
        product_name: '红富士苹果',
        total_volume_cbm: 10.5,
        received_date: formatDate(longAgo15Days),
        snapshot_date: periodEnd,
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: uuidv4(),
        customer_id: customer1Id,
        zone_id: normalZoneId,
        product_sku: 'SKU-ORANGE-002',
        product_name: '赣南脐橙',
        total_volume_cbm: 8.2,
        received_date: formatDate(longAgo45Days),
        snapshot_date: periodEnd,
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: uuidv4(),
        customer_id: customer1Id,
        zone_id: coldZoneId,
        product_sku: 'SKU-MILK-001',
        product_name: '巴氏鲜奶',
        total_volume_cbm: 5.0,
        received_date: midDate,
        snapshot_date: periodEnd,
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: uuidv4(),
        customer_id: customer1Id,
        zone_id: coldZoneId,
        product_sku: 'SKU-MEAT-001',
        product_name: '进口牛排',
        total_volume_cbm: 12.0,
        received_date: formatDate(longAgo100Days),
        snapshot_date: periodEnd,
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      },
      {
        id: uuidv4(),
        customer_id: customer1Id,
        zone_id: frozenZoneId,
        product_sku: 'SKU-ICE-001',
        product_name: '冰淇淋',
        total_volume_cbm: 3.5,
        received_date: formatDate(longAgo15Days),
        snapshot_date: periodEnd,
        created_at: now.toISOString().replace('T', ' ').substring(0, 19)
      }
    );

    const opTypes = ['IN', 'OUT'];
    let opCount = 0;
    
    for (let i = 0; i < 60; i++) {
      const opType = opTypes[i % 2];
      const zoneId = i % 3 === 0 ? coldZoneId : (i % 3 === 1 ? normalZoneId : frozenZoneId);
      const sku = zoneId === normalZoneId ? (i % 2 === 0 ? 'SKU-APPLE-001' : 'SKU-ORANGE-002') : 
                  zoneId === coldZoneId ? (i % 2 === 0 ? 'SKU-MILK-001' : 'SKU-MEAT-001') : 'SKU-ICE-001';
      const opDate = new Date(year, month, 1 + (i % daysInMonth));
      
      store.operations.push({
        id: uuidv4(),
        idempotent_key: `OP-${year}${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(5, '0')}`,
        customer_id: customer1Id,
        operation_type: opType,
        zone_id: zoneId,
        product_sku: sku,
        volume_cbm: 1.0 + (i % 5),
        operation_date: formatDate(opDate),
        source_system: 'WMS',
        source_id: `SRC-${i + 1}`,
        status: 'PROCESSED',
        error_message: null,
        created_at: now.toISOString().replace('T', ' ').substring(0, 19),
        processed_at: now.toISOString().replace('T', ' ').substring(0, 19)
      });
      opCount++;
    }

    return {
      customer1Id,
      customer2Id,
      normalZoneId,
      coldZoneId,
      frozenZoneId,
      periodStart,
      periodEnd,
      midDate,
      operationCount: opCount,
      zones: {
        normal: { id: normalZoneId, name: '常温区' },
        cold: { id: coldZoneId, name: '冷藏区' },
        frozen: { id: frozenZoneId, name: '冷冻区' }
      }
    };
  });

  return result;
}

module.exports = { loadSampleData };
