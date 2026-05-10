const { readData, writeData, generateId, DATA_DIR } = require('./models');
const fs = require('fs');
const path = require('path');

function initData() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const exhibits = [
        {
            id: 'EXH-20260401-0001',
            exhibitNo: 'GH-001',
            name: '清明上河图（复制品）',
            category: '书画',
            era: '北宋',
            location: '故宫博物院',
            value: 5000000,
            description: '北宋张择端名作复制品，用于临展',
            status: 'in_stock',
            createTime: '2026-04-01T10:00:00Z',
            updateTime: '2026-04-01T10:00:00Z'
        },
        {
            id: 'EXH-20260401-0002',
            exhibitNo: 'GH-002',
            name: '唐三彩骆驼',
            category: '陶瓷',
            era: '唐代',
            location: '河南博物院',
            value: 8000000,
            description: '唐代三彩骆驼俑',
            status: 'borrowed',
            createTime: '2026-04-01T11:00:00Z',
            updateTime: '2026-04-15T09:00:00Z'
        },
        {
            id: 'EXH-20260401-0003',
            exhibitNo: 'GH-003',
            name: '青花缠枝莲纹瓶',
            category: '瓷器',
            era: '明代',
            location: '上海博物馆',
            value: 12000000,
            description: '明宣德年间青花瓷',
            status: 'in_stock',
            createTime: '2026-04-01T12:00:00Z',
            updateTime: '2026-04-01T12:00:00Z'
        },
        {
            id: 'EXH-20260401-0004',
            exhibitNo: 'GH-004',
            name: '铜鎏金佛造像',
            category: '金属器',
            era: '北魏',
            location: '敦煌研究院',
            value: 15000000,
            description: '北魏时期佛教造像',
            status: 'in_transit',
            createTime: '2026-04-01T13:00:00Z',
            updateTime: '2026-05-05T08:00:00Z'
        }
    ];

    const contracts = [
        {
            id: 'CTR-20260410-0001',
            contractNo: 'HT-2026-001',
            exhibitId: 'EXH-20260401-0002',
            borrowerInstitution: '南京博物院',
            lenderInstitution: '河南博物院',
            startDate: '2026-04-15',
            endDate: '2026-06-30',
            status: 'active',
            responsiblePerson: '张三',
            phone: '13800138001',
            insuranceAmount: 8000000,
            terms: '按合同条款执行，运输过程需专业物流公司',
            createTime: '2026-04-10T10:00:00Z',
            updateTime: '2026-04-10T10:00:00Z'
        },
        {
            id: 'CTR-20260410-0002',
            contractNo: 'HT-2026-002',
            exhibitId: 'EXH-20260401-0004',
            borrowerInstitution: '国家博物馆',
            lenderInstitution: '敦煌研究院',
            startDate: '2026-05-01',
            endDate: '2026-07-15',
            status: 'active',
            responsiblePerson: '李四',
            phone: '13800138002',
            insuranceAmount: 15000000,
            terms: '需全程恒温恒湿运输，专业押运',
            createTime: '2026-04-10T11:00:00Z',
            updateTime: '2026-04-10T11:00:00Z'
        }
    ];

    const insurances = [
        {
            id: 'INS-20260412-0001',
            policyNo: 'BX-2026-001',
            contractId: 'CTR-20260410-0001',
            exhibitId: 'EXH-20260401-0002',
            insuranceCompany: '平安保险',
            startDate: '2026-04-15',
            endDate: '2026-06-30',
            amount: 8000000,
            premium: 40000,
            status: 'active',
            coverage: '全险，包含运输、展览、存储',
            createTime: '2026-04-12T10:00:00Z',
            updateTime: '2026-04-12T10:00:00Z'
        }
    ];

    const shipments = [
        {
            id: 'SHP-20260414-0001',
            shipmentNo: 'YS-2026-001',
            contractId: 'CTR-20260410-0001',
            exhibitId: 'EXH-20260401-0002',
            logisticsCompany: '专业艺术品物流公司',
            departureDate: '2026-04-14',
            expectedArrivalDate: '2026-04-16',
            actualArrivalDate: '2026-04-15',
            status: 'delivered',
            handler: '王五',
            remark: '运输顺利，无异常',
            createTime: '2026-04-14T08:00:00Z',
            updateTime: '2026-04-15T18:00:00Z'
        },
        {
            id: 'SHP-20260504-0001',
            shipmentNo: 'YS-2026-002',
            contractId: 'CTR-20260410-0002',
            exhibitId: 'EXH-20260401-0004',
            logisticsCompany: '专业艺术品物流公司',
            departureDate: '2026-05-04',
            expectedArrivalDate: '2026-05-06',
            actualArrivalDate: null,
            status: 'in_transit',
            handler: '赵六',
            remark: '恒温恒湿运输中',
            createTime: '2026-05-04T08:00:00Z',
            updateTime: '2026-05-04T08:00:00Z'
        }
    ];

    const checkpoints = [
        {
            id: 'CKP-20260414-0001',
            shipmentId: 'SHP-20260414-0001',
            checkpointNo: 'DJ-2026-001-A',
            checkpointType: 'departure',
            checkpointName: '河南博物院出库点交',
            operator: '出库员A',
            timestamp: '2026-04-14T09:00:00Z',
            description: '展品出库，包装完好',
            condition: 'good',
            photos: ['photo1.jpg'],
            signature: '出库员A',
            status: 'confirmed',
            createTime: '2026-04-14T09:00:00Z'
        },
        {
            id: 'CKP-20260415-0001',
            shipmentId: 'SHP-20260414-0001',
            checkpointNo: 'DJ-2026-001-B',
            checkpointType: 'transit',
            checkpointName: '郑州中转点交',
            operator: '中转员B',
            timestamp: '2026-04-15T12:00:00Z',
            description: '包装完好，温度湿度正常',
            condition: 'good',
            photos: ['photo2.jpg'],
            signature: '中转员B',
            status: 'confirmed',
            createTime: '2026-04-15T12:00:00Z'
        },
        {
            id: 'CKP-20260415-0002',
            shipmentId: 'SHP-20260414-0001',
            checkpointNo: 'DJ-2026-001-C',
            checkpointType: 'arrival',
            checkpointName: '南京博物院入库点交',
            operator: '入库员C',
            timestamp: '2026-04-15T18:00:00Z',
            description: '展品完好，顺利入库',
            condition: 'good',
            photos: ['photo3.jpg'],
            signature: '入库员C',
            status: 'confirmed',
            createTime: '2026-04-15T18:00:00Z'
        },
        {
            id: 'CKP-20260504-0001',
            shipmentId: 'SHP-20260504-0001',
            checkpointNo: 'DJ-2026-002-A',
            checkpointType: 'departure',
            checkpointName: '敦煌研究院出库点交',
            operator: '出库员D',
            timestamp: '2026-05-04T10:00:00Z',
            description: '恒温包装完成，出库',
            condition: 'good',
            photos: ['photo4.jpg'],
            signature: '出库员D',
            status: 'confirmed',
            createTime: '2026-05-04T10:00:00Z'
        },
        {
            id: 'CKP-20260504-0002',
            shipmentId: 'SHP-20260504-0001',
            checkpointNo: 'DJ-2026-002-B',
            checkpointType: 'transit',
            checkpointName: '兰州中转点交',
            operator: '中转员E',
            timestamp: '2026-05-05T08:00:00Z',
            description: '恒温设备运行正常，待继续运输',
            condition: 'good',
            photos: ['photo5.jpg'],
            signature: '中转员E',
            status: 'pending',
            createTime: '2026-05-05T08:00:00Z'
        }
    ];

    writeData('exhibits.json', exhibits);
    writeData('contracts.json', contracts);
    writeData('insurances.json', insurances);
    writeData('shipments.json', shipments);
    writeData('checkpoints.json', checkpoints);

    console.log('示例数据初始化完成');
}

if (require.main === module) {
    initData();
}

module.exports = initData;
