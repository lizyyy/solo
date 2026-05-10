"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const User_1 = __importDefault(require("../models/User"));
const SensitiveField_1 = __importDefault(require("../models/SensitiveField"));
async function seed() {
    try {
        await database_1.default.sync({ force: true });
        console.log('数据库已重置');
        const users = [
            {
                id: (0, uuid_1.v4)(),
                name: '张三',
                role: 'requester',
                department: '销售部',
            },
            {
                id: (0, uuid_1.v4)(),
                name: '李四',
                role: 'requester',
                department: '市场部',
            },
            {
                id: (0, uuid_1.v4)(),
                name: '王经理',
                role: 'approver',
                department: '合规部',
            },
            {
                id: (0, uuid_1.v4)(),
                name: '刘总监',
                role: 'approver',
                department: '风控部',
            },
            {
                id: (0, uuid_1.v4)(),
                name: '系统管理员',
                role: 'admin',
                department: '技术部',
            },
        ];
        await User_1.default.bulkCreate(users);
        console.log('\n已创建用户：');
        users.forEach((u) => {
            const roleMap = {
                admin: '系统管理员',
                approver: '审批人',
                requester: '申请人',
            };
            console.log(`  - ${u.name} (${roleMap[u.role]}, ID: ${u.id})`);
        });
        const sensitiveFields = [
            {
                id: (0, uuid_1.v4)(),
                fieldName: 'idCard',
                dataType: 'string',
                sensitivityLevel: 'high',
                maskingRule: 'mask_middle',
                description: '身份证号，高敏感，中间10位脱敏',
            },
            {
                id: (0, uuid_1.v4)(),
                fieldName: 'bankCard',
                dataType: 'string',
                sensitivityLevel: 'high',
                maskingRule: 'mask_middle',
                description: '银行卡号，高敏感，中间脱敏',
            },
            {
                id: (0, uuid_1.v4)(),
                fieldName: 'phone',
                dataType: 'string',
                sensitivityLevel: 'medium',
                maskingRule: 'mask_middle',
                description: '手机号，中敏感，中间4位脱敏',
            },
            {
                id: (0, uuid_1.v4)(),
                fieldName: 'email',
                dataType: 'string',
                sensitivityLevel: 'medium',
                maskingRule: 'mask_middle',
                description: '邮箱，中敏感，用户名部分脱敏',
            },
            {
                id: (0, uuid_1.v4)(),
                fieldName: 'name',
                dataType: 'string',
                sensitivityLevel: 'low',
                maskingRule: 'mask_middle',
                description: '姓名，低敏感，姓氏保留',
            },
            {
                id: (0, uuid_1.v4)(),
                fieldName: 'address',
                dataType: 'string',
                sensitivityLevel: 'medium',
                maskingRule: 'hash',
                description: '地址，中敏感，哈希处理',
            },
        ];
        await SensitiveField_1.default.bulkCreate(sensitiveFields);
        console.log('\n已创建敏感字段：');
        sensitiveFields.forEach((f) => {
            const levelMap = {
                high: '高风险',
                medium: '中风险',
                low: '低风险',
            };
            console.log(`  - ${f.fieldName} (${levelMap[f.sensitivityLevel]})`);
        });
        console.log('\n========================================');
        console.log('样例数据初始化完成！');
        console.log('========================================\n');
        console.log('使用提示：');
        console.log('  - 申请人「张三」可以提交导出申请');
        console.log('  - 审批人「王经理」和「刘总监」负责审批');
        console.log('  - 高风险字段：idCard、bankCard');
        console.log('  - 导出高风险字段需要「王经理」和「刘总监」双审批');
        console.log('\n');
    }
    catch (error) {
        console.error('初始化失败：', error);
        process.exit(1);
    }
    finally {
        await database_1.default.close();
    }
}
seed();
