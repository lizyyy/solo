
const fs = require('fs');
const path = require('path');

const { StorageService } = require('../services');
const { Policy, PaymentPlan, VisitRecord } = require('../models');

const TEST_DATA_DIR = path.join(__dirname, '..', 'test-data');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function readJson(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

function initStorage() {
    const storage = new StorageService();
    
    const backupFile = storage.backupData();
    if (backupFile.success) {
        console.log(`已备份现有数据到: ${backupFile.backupFile}`);
    }

    const testDataFiles = [
        { file: 'policies.json', key: 'policies', model: Policy, saveMethod: 'savePolicies', getMethod: 'getPolicies' },
        { file: 'payment-plans.json', key: 'paymentPlans', model: PaymentPlan, saveMethod: 'savePaymentPlans', getMethod: 'getPaymentPlans' },
        { file: 'visit-records.json', key: 'visitRecords', model: VisitRecord, saveMethod: 'saveVisitRecords', getMethod: 'getVisitRecords' }
    ];

    const loadedCounts = {};

    testDataFiles.forEach(({ file, model, saveMethod, getMethod }) => {
        const filePath = path.join(TEST_DATA_DIR, file);
        if (fs.existsSync(filePath)) {
            try {
                const rawData = readJson(filePath);
                const records = rawData.map(item => {
                    const instance = new model(item);
                    instance.validate();
                    return instance.toJSON();
                });
                storage[saveMethod](records);
                loadedCounts[file] = records.length;
                console.log(`✅ 已加载 ${file}: ${records.length} 条记录`);
            } catch (error) {
                console.log(`❌ 加载 ${file} 失败: ${error.message}`);
                loadedCounts[file] = 0;
            }
        }
    });

    const config = {
        gracePeriodDays: 60,
        defaultInterestRate: 5,
        reminderIntervals: [3, 7, 15, 30],
        autoAdvanceEnabled: true,
        lastUpdated: new Date().toISOString()
    };
    storage.saveConfig(config);
    console.log(`✅ 已保存系统配置`);

    const holidays = [
        { date: '2025-01-01', name: '元旦', type: 'holiday' },
        { date: '2025-01-28', name: '春节', type: 'holiday' },
        { date: '2025-01-29', name: '春节', type: 'holiday' },
        { date: '2025-01-30', name: '春节', type: 'holiday' },
        { date: '2025-01-31', name: '春节', type: 'holiday' },
        { date: '2025-02-01', name: '春节', type: 'holiday' },
        { date: '2025-02-02', name: '春节', type: 'holiday' },
        { date: '2025-04-04', name: '清明节', type: 'holiday' },
        { date: '2025-05-01', name: '劳动节', type: 'holiday' },
        { date: '2025-06-01', name: '端午节', type: 'holiday' },
        { date: '2025-10-01', name: '国庆节', type: 'holiday' },
        { date: '2025-10-02', name: '国庆节', type: 'holiday' },
        { date: '2025-10-03', name: '国庆节', type: 'holiday' },
        { date: '2025-10-04', name: '国庆节', type: 'holiday' },
        { date: '2025-10-05', name: '国庆节', type: 'holiday' },
        { date: '2025-10-06', name: '国庆节', type: 'holiday' },
        { date: '2025-10-07', name: '国庆节', type: 'holiday' }
    ];
    console.log(`✅ 已加载节假日: ${holidays.length} 个`);

    console.log(`\n✅ 数据初始化完成，共加载:`);
    console.log(`   - 保单: ${loadedCounts['policies.json'] || 0} 份`);
    console.log(`   - 缴费计划: ${loadedCounts['payment-plans.json'] || 0} 条`);
    console.log(`   - 回访记录: ${loadedCounts['visit-records.json'] || 0} 条`);
    console.log(`   - 节假日: ${holidays.length} 个`);
    console.log(`\n数据存储位置: ${storage.dataDir}`);
}

initStorage();
