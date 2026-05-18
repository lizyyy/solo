"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const database_1 = require("../database");
const types_1 = require("../types");
function createSeedData() {
    database_1.db.clear();
    const now = new Date();
    const quote1 = {
        id: (0, uuid_1.v4)(),
        quoteNumber: 'WX202605010001',
        stationId: 'ST001',
        stationName: '城东汽车维修服务站',
        technician: '张师傅',
        technicianPhone: '13800138001',
        customer: {
            id: 'C001',
            name: '李明',
            phone: '13900139001',
            address: '北京市朝阳区建国路88号'
        },
        vehicle: {
            id: 'V001',
            plateNumber: '京A12345',
            brand: '大众',
            model: '帕萨特',
            year: 2020,
            mileage: 45000,
            vin: 'LSVAC2AXE12345678'
        },
        appointmentTime: new Date('2026-05-02T09:00:00'),
        arrivalTime: new Date('2026-05-02T09:15:00'),
        faultItems: [
            {
                id: (0, uuid_1.v4)(),
                description: '发动机异响检查',
                category: '发动机',
                isHidden: false,
                laborCost: 300
            },
            {
                id: (0, uuid_1.v4)(),
                description: '更换机油机滤',
                category: '保养',
                isHidden: false,
                laborCost: 100
            }
        ],
        partItems: [
            {
                id: (0, uuid_1.v4)(),
                name: '全合成机油 5W-40',
                partNumber: 'VW-OIL-001',
                quantity: 5,
                unitPrice: 120,
                isOriginal: true
            },
            {
                id: (0, uuid_1.v4)(),
                name: '机油滤清器',
                partNumber: 'VW-FILTER-001',
                quantity: 1,
                unitPrice: 60,
                isOriginal: true
            }
        ],
        laborTotal: 400,
        partsTotal: 660,
        discount: 60,
        totalAmount: 1000,
        status: types_1.QuoteStatus.COMPLETED,
        statusHistory: [
            {
                status: types_1.QuoteStatus.DRAFT,
                changedAt: new Date('2026-05-01T10:00:00'),
                changedBy: '张师傅'
            },
            {
                status: types_1.QuoteStatus.PENDING_APPROVAL,
                changedAt: new Date('2026-05-01T10:30:00'),
                changedBy: '张师傅'
            },
            {
                status: types_1.QuoteStatus.CUSTOMER_ACCEPTED,
                changedAt: new Date('2026-05-01T11:00:00'),
                changedBy: '李明',
                notes: '客户确认接受报价'
            },
            {
                status: types_1.QuoteStatus.COMPLETED,
                changedAt: new Date('2026-05-02T16:00:00'),
                changedBy: '张师傅',
                notes: '维修完成，客户满意'
            }
        ],
        customerAcceptedAt: new Date('2026-05-01T11:00:00'),
        createdAt: new Date('2026-05-01T10:00:00'),
        updatedAt: new Date('2026-05-02T16:00:00'),
        createdBy: '张师傅'
    };
    const quote2 = {
        id: (0, uuid_1.v4)(),
        quoteNumber: 'WX202605020002',
        stationId: 'ST001',
        stationName: '城东汽车维修服务站',
        technician: '王师傅',
        technicianPhone: '13800138002',
        customer: {
            id: 'C002',
            name: '王芳',
            phone: '13900139002',
            address: '北京市海淀区中关村大街1号'
        },
        vehicle: {
            id: 'V002',
            plateNumber: '京B67890',
            brand: '丰田',
            model: '凯美瑞',
            year: 2019,
            mileage: 68000,
            vin: 'JTNB11HKXK1234567'
        },
        appointmentTime: new Date('2026-05-03T14:00:00'),
        arrivalTime: new Date('2026-05-03T14:20:00'),
        faultItems: [
            {
                id: (0, uuid_1.v4)(),
                description: '刹车系统深度检查',
                category: '刹车',
                isHidden: false,
                laborCost: 200
            },
            {
                id: (0, uuid_1.v4)(),
                description: '更换前刹车片',
                category: '刹车',
                isHidden: false,
                laborCost: 150
            },
            {
                id: (0, uuid_1.v4)(),
                description: '变速箱油封老化漏油（隐藏故障）',
                category: '变速箱',
                isHidden: true,
                laborCost: 800
            }
        ],
        partItems: [
            {
                id: (0, uuid_1.v4)(),
                name: '前刹车片',
                partNumber: 'TOY-BRAKE-001',
                quantity: 4,
                unitPrice: 180,
                isOriginal: true
            },
            {
                id: (0, uuid_1.v4)(),
                name: '变速箱油封',
                partNumber: 'TOY-SEAL-001',
                quantity: 2,
                unitPrice: 120,
                isOriginal: true
            },
            {
                id: (0, uuid_1.v4)(),
                name: '变速箱油',
                partNumber: 'TOY-OIL-002',
                quantity: 4,
                unitPrice: 80,
                isOriginal: true
            }
        ],
        laborTotal: 1150,
        partsTotal: 1280,
        discount: 0,
        totalAmount: 2430,
        status: types_1.QuoteStatus.PENDING_SUPPLEMENT,
        statusHistory: [
            {
                status: types_1.QuoteStatus.DRAFT,
                changedAt: new Date('2026-05-02T15:00:00'),
                changedBy: '王师傅'
            },
            {
                status: types_1.QuoteStatus.PENDING_APPROVAL,
                changedAt: new Date('2026-05-02T15:30:00'),
                changedBy: '王师傅'
            },
            {
                status: types_1.QuoteStatus.CUSTOMER_ACCEPTED,
                changedAt: new Date('2026-05-02T16:00:00'),
                changedBy: '王芳',
                notes: '客户接受初始报价'
            },
            {
                status: types_1.QuoteStatus.PENDING_SUPPLEMENT,
                changedAt: new Date('2026-05-03T15:30:00'),
                changedBy: '王师傅',
                notes: '检查中发现变速箱油封漏油，需要追加维修项目'
            }
        ],
        customerAcceptedAt: new Date('2026-05-02T16:00:00'),
        supplementNotes: '变速箱油封老化漏油，属于拆装过程中发现的隐藏故障，需客户确认追加维修项目',
        createdAt: new Date('2026-05-02T15:00:00'),
        updatedAt: new Date('2026-05-03T15:30:00'),
        createdBy: '王师傅'
    };
    const quote3 = {
        id: (0, uuid_1.v4)(),
        quoteNumber: 'WX202605030003',
        stationId: 'ST002',
        stationName: '城西豪华车维修中心',
        technician: '李师傅',
        technicianPhone: '13800138003',
        customer: {
            id: 'C003',
            name: '张伟',
            phone: '13900139003',
            address: '北京市西城区金融街18号'
        },
        vehicle: {
            id: 'V003',
            plateNumber: '京C11111',
            brand: '奔驰',
            model: 'E300L',
            year: 2021,
            mileage: 32000,
            vin: 'WDDZF4JB5KA123456'
        },
        appointmentTime: new Date('2026-05-04T10:00:00'),
        faultItems: [
            {
                id: (0, uuid_1.v4)(),
                description: '空调系统不制冷检查',
                category: '空调',
                isHidden: false,
                laborCost: 500
            },
            {
                id: (0, uuid_1.v4)(),
                description: '更换空调压缩机',
                category: '空调',
                isHidden: false,
                laborCost: 800
            }
        ],
        partItems: [
            {
                id: (0, uuid_1.v4)(),
                name: '空调压缩机',
                partNumber: 'BENZ-AC-001',
                quantity: 1,
                unitPrice: 6500,
                isOriginal: true
            },
            {
                id: (0, uuid_1.v4)(),
                name: '冷媒R134a',
                partNumber: 'BENZ-REFRIGERANT-001',
                quantity: 3,
                unitPrice: 120,
                isOriginal: true
            }
        ],
        laborTotal: 1300,
        partsTotal: 6860,
        discount: 160,
        totalAmount: 8000,
        status: types_1.QuoteStatus.REJECTED,
        statusHistory: [
            {
                status: types_1.QuoteStatus.DRAFT,
                changedAt: new Date('2026-05-03T09:00:00'),
                changedBy: '李师傅'
            },
            {
                status: types_1.QuoteStatus.PENDING_APPROVAL,
                changedAt: new Date('2026-05-03T09:30:00'),
                changedBy: '李师傅'
            },
            {
                status: types_1.QuoteStatus.REJECTED,
                changedAt: new Date('2026-05-03T11:00:00'),
                changedBy: '系统',
                notes: '报价被拦截驳回'
            }
        ],
        rejectionReason: '【报价异常拦截】空调压缩机报价6500元超出同款配件市场价范围（3500-5000元），配件价格一致性校验失败。请核实配件渠道和价格后重新提交，或转人工审核。',
        createdAt: new Date('2026-05-03T09:00:00'),
        updatedAt: new Date('2026-05-03T11:00:00'),
        createdBy: '李师傅'
    };
    const quote4 = {
        id: (0, uuid_1.v4)(),
        quoteNumber: 'WX202605040004',
        stationId: 'ST001',
        stationName: '城东汽车维修服务站',
        technician: '张师傅',
        technicianPhone: '13800138001',
        customer: {
            id: 'C004',
            name: '刘强',
            phone: '13900139004',
            address: '北京市丰台区南三环西路16号'
        },
        vehicle: {
            id: 'V004',
            plateNumber: '京D22222',
            brand: '本田',
            model: '雅阁',
            year: 2018,
            mileage: 85000,
            vin: 'LHGCR265XK1234567'
        },
        appointmentTime: new Date('2026-05-05T09:30:00'),
        faultItems: [
            {
                id: (0, uuid_1.v4)(),
                description: '常规保养检查',
                category: '保养',
                isHidden: false,
                laborCost: 150
            }
        ],
        partItems: [
            {
                id: (0, uuid_1.v4)(),
                name: '机油',
                partNumber: 'HONDA-OIL-001',
                quantity: 4,
                unitPrice: 100,
                isOriginal: true
            }
        ],
        laborTotal: 150,
        partsTotal: 400,
        discount: 0,
        totalAmount: 550,
        status: types_1.QuoteStatus.CUSTOMER_ACCEPTED,
        statusHistory: [
            {
                status: types_1.QuoteStatus.DRAFT,
                changedAt: new Date('2026-05-04T14:00:00'),
                changedBy: '张师傅'
            },
            {
                status: types_1.QuoteStatus.PENDING_APPROVAL,
                changedAt: new Date('2026-05-04T14:20:00'),
                changedBy: '张师傅'
            },
            {
                status: types_1.QuoteStatus.CUSTOMER_ACCEPTED,
                changedAt: new Date('2026-05-04T15:00:00'),
                changedBy: '刘强',
                notes: '客户确认接受报价'
            }
        ],
        customerAcceptedAt: new Date('2026-05-04T15:00:00'),
        createdAt: new Date('2026-05-04T14:00:00'),
        updatedAt: new Date('2026-05-04T15:00:00'),
        createdBy: '张师傅'
    };
    database_1.db.addQuote(quote1);
    database_1.db.addQuote(quote2);
    database_1.db.addQuote(quote3);
    database_1.db.addQuote(quote4);
    const changeRecord1 = {
        id: (0, uuid_1.v4)(),
        quoteId: quote2.id,
        changeType: types_1.ChangeType.HIDDEN_FAULT_ADD,
        changeReason: '检查中发现变速箱油封老化漏油，属于隐藏故障需追加维修',
        previousAmount: 1150,
        newAmount: 2430,
        changedBy: '王师傅',
        changedAt: new Date('2026-05-03T15:30:00'),
        reviewResult: types_1.ReviewResult.PENDING,
        reviewNotes: '待客户确认是否接受追加报价'
    };
    database_1.db.addChangeRecord(changeRecord1);
    console.log('种子数据已加载完成！');
    console.log(`共加载 ${database_1.db.getAllQuotes().length} 条报价记录`);
    console.log('报价状态分布：');
    const statusCounts = {};
    database_1.db.getAllQuotes().forEach(q => {
        statusCounts[q.status] = (statusCounts[q.status] || 0) + 1;
    });
    Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count} 条`);
    });
}
createSeedData();
