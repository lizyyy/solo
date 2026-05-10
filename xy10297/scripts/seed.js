const { v4: uuidv4 } = require('uuid');
const { db, initDatabase, runQuery, getQuery } = require('../src/database');

const sampleData = {
    weighingRecords: [
        {
            id: 'wr-001',
            sku_code: 'APPLE-001',
            sku_name: '红富士苹果',
            weight: 1.5,
            unit_price: 8.99,
            batch_number: 'BATCH-2024-05-001',
            counter_code: 'COUNTER-01',
            operator_id: 'user1'
        },
        {
            id: 'wr-002',
            sku_code: 'ORANGE-001',
            sku_name: '赣南脐橙',
            weight: 2.3,
            unit_price: 6.99,
            batch_number: 'BATCH-2024-05-002',
            counter_code: 'COUNTER-01',
            operator_id: 'user1'
        },
        {
            id: 'wr-003',
            sku_code: 'BANANA-001',
            sku_name: '菲律宾香蕉',
            weight: 0.8,
            unit_price: 4.99,
            batch_number: 'BATCH-2024-05-001',
            counter_code: 'COUNTER-02',
            operator_id: 'user2'
        }
    ],
    labelVersions: [
        {
            id: 'lv-001',
            weighing_record_id: 'wr-001',
            version_number: 1,
            operator_id: 'user1',
            status: 'ACTIVE'
        },
        {
            id: 'lv-002',
            weighing_record_id: 'wr-002',
            version_number: 1,
            operator_id: 'user1',
            status: 'ACTIVE'
        },
        {
            id: 'lv-003',
            weighing_record_id: 'wr-003',
            version_number: 1,
            operator_id: 'user2',
            status: 'ACTIVE'
        }
    ]
};

const seedDatabase = async () => {
    await initDatabase();
    
    console.log('开始插入样例数据...');
    
    for (const record of sampleData.weighingRecords) {
        const total_price = record.weight * record.unit_price;
        const now = Date.now();
        
        await runQuery(
            `INSERT OR REPLACE INTO weighing_records 
             (id, sku_code, sku_name, weight, unit_price, total_price, batch_number, counter_code, operator_id, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [record.id, record.sku_code, record.sku_name, record.weight, record.unit_price, total_price, 
             record.batch_number, record.counter_code, record.operator_id, now]
        );
        console.log(`插入称重记录: ${record.id} - ${record.sku_name}`);
    }
    
    for (const label of sampleData.labelVersions) {
        const now = Date.now();
        await runQuery(
            `INSERT OR REPLACE INTO label_versions 
             (id, weighing_record_id, version_number, print_time, operator_id, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [label.id, label.weighing_record_id, label.version_number, now, label.operator_id, label.status]
        );
        console.log(`插入标签版本: ${label.id} - 版本 ${label.version_number}`);
    }
    
    console.log('\n样例数据插入完成！');
    console.log('\n可用的测试用户:');
    console.log('  user1  - 普通员工（只能申请、取消自己的申请）');
    console.log('  user2  - 主管（可以审批申请）');
    console.log('  admin  - 管理员（完整权限）');
    
    console.log('\n样例称重记录ID:');
    sampleData.weighingRecords.forEach(r => {
        console.log(`  ${r.id} - ${r.sku_name} (批次: ${r.batch_number})`);
    });
    
    db.close();
};

seedDatabase().catch(err => {
    console.error('数据初始化失败:', err);
    process.exit(1);
});
