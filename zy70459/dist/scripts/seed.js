"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const database_1 = require("../database");
const validationService_1 = __importDefault(require("../services/validationService"));
const realLabSamples = [
    {
        businessNo: 'LAB20240515001',
        sampleNo: 'S-2024-0515-001',
        patientName: '张三',
        patientId: 'P10001',
        sampleType: '静脉血',
        collectTime: '2024-05-15 07:30:00',
        receiveTime: '2024-05-15 08:00:00',
        testItems: ['血常规', 'C反应蛋白', '血沉'],
        department: '内科门诊',
        doctor: '王医生'
    },
    {
        businessNo: 'LAB20240515002',
        sampleNo: 'S-2024-0515-002',
        patientName: '李四',
        patientId: 'P10002',
        sampleType: '静脉血',
        collectTime: '2024-05-15 07:45:00',
        receiveTime: '2024-05-15 08:15:00',
        testItems: ['生化全套', '电解质', '肝功能'],
        department: '消化内科',
        doctor: '李医生'
    },
    {
        businessNo: 'LAB20240515003',
        sampleNo: 'S-2024-0515-003',
        patientName: '王五',
        patientId: 'P10003',
        sampleType: '尿液',
        collectTime: '2024-05-15 08:00:00',
        receiveTime: '2024-05-15 08:30:00',
        testItems: ['尿常规', '尿沉渣'],
        department: '肾内科',
        doctor: '赵医生'
    },
    {
        businessNo: 'LAB20240515004',
        sampleNo: 'S-2024-0515-004',
        patientName: '赵六',
        patientId: 'P10004',
        sampleType: '脑脊液',
        collectTime: '2024-05-15 09:00:00',
        receiveTime: '2024-05-15 09:30:00',
        testItems: ['脑脊液常规', '脑脊液生化'],
        department: '神经内科',
        doctor: '孙医生'
    },
    {
        businessNo: 'LAB20240515005',
        sampleNo: 'S-2024-0515-005',
        patientName: '钱七',
        patientId: 'P10005',
        sampleType: '胸腔积液',
        collectTime: '2024-05-15 10:00:00',
        receiveTime: '2024-05-15 10:30:00',
        testItems: ['胸水常规', '胸水生化', '肿瘤标志物'],
        department: '呼吸内科',
        doctor: '周医生'
    },
    {
        businessNo: 'LAB20240515006',
        sampleNo: 'S-2024-0515-006',
        patientName: '孙八',
        patientId: 'P10006',
        sampleType: '静脉血',
        collectTime: '2024-05-15 14:00:00',
        receiveTime: '2024-05-15 14:30:00',
        testItems: ['凝血功能', 'D-二聚体'],
        department: '心血管内科',
        doctor: '吴医生'
    },
    {
        businessNo: 'LAB20240515007',
        sampleNo: 'S-2024-0515-007',
        patientName: '周九',
        patientId: 'P10007',
        sampleType: '粪便',
        collectTime: '2024-05-15 15:00:00',
        receiveTime: '2024-05-15 15:30:00',
        testItems: ['便常规', '便潜血', '便培养'],
        department: '消化内科',
        doctor: '郑医生'
    },
    {
        businessNo: 'LAB20240515008',
        sampleNo: 'S-2024-0515-008',
        patientName: '吴十',
        patientId: 'P10008',
        sampleType: '静脉血',
        collectTime: '2024-05-15 22:00:00',
        receiveTime: '2024-05-15 22:30:00',
        testItems: ['血气分析', '乳酸'],
        department: 'ICU',
        doctor: '王主任'
    },
    {
        businessNo: 'LAB20240515009',
        sampleNo: 'S-2024-0515-009',
        patientName: '郑十一',
        patientId: 'P10009',
        sampleType: '静脉血',
        collectTime: '2024-05-15 08:30:00',
        receiveTime: '2024-05-15 09:00:00',
        testItems: ['甲状腺功能', '血糖', '糖化血红蛋白'],
        department: '内分泌科',
        doctor: '冯医生'
    },
    {
        businessNo: 'LAB20240515010',
        sampleNo: 'S-2024-0515-010',
        patientName: '冯十二',
        patientId: 'P10010',
        sampleType: '静脉血',
        collectTime: '2024-05-15 09:30:00',
        receiveTime: '2024-05-15 10:00:00',
        testItems: ['乙肝五项', '丙肝抗体', '梅毒', '艾滋病抗体'],
        department: '感染科',
        doctor: '陈医生'
    }
];
const seedDatabase = async () => {
    console.log('开始初始化数据库...');
    (0, database_1.initDatabase)();
    console.log('开始插入实验室样本数据...');
    for (const sample of realLabSamples) {
        const id = (0, uuid_1.v4)();
        const rawData = JSON.stringify({
            ...sample,
            operator: 'system',
            source: 'LIS系统',
            createdAt: new Date().toISOString()
        });
        await new Promise((resolve, reject) => {
            (0, database_1.getDb)().run(`
        INSERT INTO lab_samples (
          id, business_no, sample_no, patient_name, patient_id,
          sample_type, collect_time, receive_time, test_items,
          department, doctor, status, raw_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                id,
                sample.businessNo,
                sample.sampleNo,
                sample.patientName,
                sample.patientId,
                sample.sampleType,
                sample.collectTime,
                sample.receiveTime,
                JSON.stringify(sample.testItems),
                sample.department,
                sample.doctor,
                'pending',
                rawData,
                new Date().toISOString(),
                new Date().toISOString()
            ], (err) => {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        console.log(`样本 ${sample.businessNo} 已存在，跳过`);
                        resolve();
                    }
                    else {
                        reject(err);
                    }
                }
                else {
                    console.log(`已插入样本: ${sample.businessNo} - ${sample.patientName}`);
                    resolve();
                }
            });
        });
    }
    console.log('\n开始模拟并发写入覆盖场景...');
    const concurrentSample = realLabSamples[4];
    try {
        await validationService_1.default.validateSample(concurrentSample.businessNo, '并发测试用户', true);
        console.log(`已为样本 ${concurrentSample.businessNo} 模拟并发写入覆盖异常`);
    }
    catch (e) {
        console.log('并发模拟完成');
    }
    console.log('\n开始执行一些校验操作...');
    const successSamples = realLabSamples.slice(0, 3);
    for (const sample of successSamples) {
        try {
            await validationService_1.default.validateSample(sample.businessNo, '管理员');
            console.log(`已校验样本: ${sample.businessNo}`);
        }
        catch (e) {
            console.log(`样本 ${sample.businessNo} 不在冻结窗口内，已记录失败`);
        }
    }
    console.log('\n造数完成！');
    console.log('\n数据统计:');
    console.log(`- 实验室样本: ${realLabSamples.length} 条`);
    console.log(`- 包含并发覆盖异常样本: 1 条`);
    console.log(`- 异常样本业务单号: ${concurrentSample.businessNo}`);
    console.log('\n可查询的业务单号:');
    realLabSamples.forEach(s => {
        console.log(`  - ${s.businessNo} (${s.patientName} - ${s.department})`);
    });
    (0, database_1.closeDb)();
};
seedDatabase().catch(console.error);
