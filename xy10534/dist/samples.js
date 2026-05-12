"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSampleServices = createSampleServices;
exports.createSampleDependencies = createSampleDependencies;
exports.createSampleMigrations = createSampleMigrations;
exports.createSampleSwitches = createSampleSwitches;
exports.createSampleContacts = createSampleContacts;
exports.createSampleWaivers = createSampleWaivers;
exports.createSampleData = createSampleData;
exports.createSuccessSampleData = createSuccessSampleData;
const uuid_1 = require("uuid");
function getBaseTime() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
function addHours(date, hours) {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
}
function createSampleServices() {
    const base = getBaseTime();
    return [
        {
            id: 'svc-inventory',
            name: '库存服务',
            version: '2.3.0',
            plannedTime: addDays(base, 1).toISOString(),
            windowStart: addHours(addDays(base, 1), 20).toISOString(),
            windowEnd: addHours(addDays(base, 1), 21).toISOString(),
            status: 'planned',
            environment: 'production',
            notes: '库存扣减逻辑优化'
        },
        {
            id: 'svc-payment',
            name: '支付服务',
            version: '1.8.2',
            plannedTime: addDays(base, 1).toISOString(),
            windowStart: addHours(addDays(base, 1), 21).toISOString(),
            windowEnd: addHours(addDays(base, 1), 22).toISOString(),
            status: 'planned',
            environment: 'production',
            notes: '修复支付回调超时问题'
        },
        {
            id: 'svc-order',
            name: '订单服务',
            version: '3.1.0',
            plannedTime: addDays(base, 1).toISOString(),
            windowStart: addHours(addDays(base, 1), 22).toISOString(),
            windowEnd: addHours(addDays(base, 1), 23).toISOString(),
            status: 'planned',
            environment: 'production',
            notes: '订单状态流转重构'
        },
        {
            id: 'svc-notification',
            name: '通知服务',
            version: '1.5.0',
            plannedTime: addDays(base, 1).toISOString(),
            windowStart: addHours(addDays(base, 1), 23).toISOString(),
            windowEnd: addHours(addDays(base, 2), 0).toISOString(),
            status: 'planned',
            environment: 'production',
            notes: '短信模板升级'
        }
    ];
}
function createSampleDependencies() {
    return [
        {
            id: (0, uuid_1.v4)(),
            callerServiceId: 'svc-order',
            calleeServiceId: 'svc-inventory',
            dependencyType: 'hard',
            windowAlignmentRequired: true,
            description: '订单创建时需要扣减库存'
        },
        {
            id: (0, uuid_1.v4)(),
            callerServiceId: 'svc-order',
            calleeServiceId: 'svc-payment',
            dependencyType: 'hard',
            windowAlignmentRequired: true,
            description: '订单支付依赖支付服务'
        },
        {
            id: (0, uuid_1.v4)(),
            callerServiceId: 'svc-notification',
            calleeServiceId: 'svc-order',
            dependencyType: 'soft',
            windowAlignmentRequired: true,
            description: '通知服务消费订单事件'
        }
    ];
}
function createSampleMigrations() {
    return [
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-order',
            scriptName: 'V3_1_0__add_order_status_history.sql',
            version: '3.1.0',
            hasRollback: true,
            rollbackScript: 'U3_1_0__drop_order_status_history.sql',
            migrationType: 'schema',
            preDeploy: true,
            postDeploy: false,
            executed: false
        },
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-inventory',
            scriptName: 'V2_3_0__add_deduct_log_table.sql',
            version: '2.3.0',
            hasRollback: false,
            migrationType: 'schema',
            preDeploy: true,
            postDeploy: false,
            executed: false
        },
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-payment',
            scriptName: 'V1_8_2__fix_callback_timeout.sql',
            version: '1.8.2',
            hasRollback: true,
            rollbackScript: 'U1_8_2__revert_callback_timeout.sql',
            migrationType: 'both',
            preDeploy: true,
            postDeploy: false,
            executed: true,
            executedAt: new Date().toISOString()
        }
    ];
}
function createSampleSwitches() {
    return [
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-order',
            key: 'order.new.status.flow.enabled',
            targetValue: 'true',
            currentValue: 'false',
            preConfigured: true,
            switchOrder: 1,
            description: '启用新的订单状态流转'
        },
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-payment',
            key: 'payment.callback.timeout.seconds',
            targetValue: '30',
            currentValue: '15',
            preConfigured: false,
            switchOrder: 1,
            description: '支付回调超时时间'
        },
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-notification',
            key: 'sms.template.version',
            targetValue: 'v2',
            currentValue: 'v1',
            preConfigured: true,
            switchOrder: 1,
            description: '短信模板版本'
        }
    ];
}
function createSampleContacts() {
    return [
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-order',
            name: '张三',
            role: '订单服务负责人',
            phone: '13800138001',
            email: 'zhangsan@example.com',
            isPrimary: true,
            available: true
        },
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-payment',
            name: '李四',
            role: '支付服务负责人',
            phone: '13800138002',
            email: 'lisi@example.com',
            isPrimary: true,
            available: false
        },
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-payment',
            name: '王五',
            role: '支付服务开发',
            phone: '13800138003',
            email: 'wangwu@example.com',
            isPrimary: false,
            available: true
        },
        {
            id: (0, uuid_1.v4)(),
            serviceId: 'svc-inventory',
            name: '赵六',
            role: '库存服务负责人',
            phone: '13800138004',
            email: 'zhaoliu@example.com',
            isPrimary: true,
            available: true
        }
    ];
}
function createSampleWaivers() {
    return [
        {
            id: (0, uuid_1.v4)(),
            relatedCheckId: 'dependency-window-alignment',
            serviceId: 'svc-notification',
            reason: '通知服务为弱依赖，可独立发布',
            approvedBy: '技术总监',
            approvedAt: new Date().toISOString(),
            expiresAt: addDays(new Date(), 7).toISOString(),
            isActive: true
        }
    ];
}
function createSampleData(releasePlanId, releaseName) {
    const now = new Date();
    return {
        releasePlanId,
        releaseName,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        services: createSampleServices(),
        dependencies: createSampleDependencies(),
        migrations: createSampleMigrations(),
        switches: createSampleSwitches(),
        contacts: createSampleContacts(),
        waivers: createSampleWaivers(),
        checkHistory: [],
        corrections: []
    };
}
function createSuccessSampleData(releasePlanId, releaseName) {
    const base = getBaseTime();
    const now = new Date();
    return {
        releasePlanId,
        releaseName,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        services: [
            {
                id: 'svc-inventory',
                name: '库存服务',
                version: '2.3.0',
                plannedTime: addDays(base, 1).toISOString(),
                windowStart: addHours(addDays(base, 1), 20).toISOString(),
                windowEnd: addHours(addDays(base, 1), 21).toISOString(),
                status: 'planned',
                environment: 'production',
                notes: '库存扣减逻辑优化'
            },
            {
                id: 'svc-payment',
                name: '支付服务',
                version: '1.8.2',
                plannedTime: addDays(base, 1).toISOString(),
                windowStart: addHours(addDays(base, 1), 21).toISOString(),
                windowEnd: addHours(addDays(base, 1), 22).toISOString(),
                status: 'planned',
                environment: 'production',
                notes: '修复支付回调超时问题'
            },
            {
                id: 'svc-order',
                name: '订单服务',
                version: '3.1.0',
                plannedTime: addDays(base, 1).toISOString(),
                windowStart: addHours(addDays(base, 1), 22).toISOString(),
                windowEnd: addHours(addDays(base, 1), 23).toISOString(),
                status: 'planned',
                environment: 'production',
                notes: '订单状态流转重构'
            },
            {
                id: 'svc-notification',
                name: '通知服务',
                version: '1.5.0',
                plannedTime: addDays(base, 1).toISOString(),
                windowStart: addHours(addDays(base, 1), 23).toISOString(),
                windowEnd: addHours(addDays(base, 2), 0).toISOString(),
                status: 'planned',
                environment: 'production',
                notes: '短信模板升级'
            }
        ],
        dependencies: createSampleDependencies(),
        migrations: [
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-order',
                scriptName: 'V3_1_0__add_order_status_history.sql',
                version: '3.1.0',
                hasRollback: true,
                rollbackScript: 'U3_1_0__drop_order_status_history.sql',
                migrationType: 'schema',
                preDeploy: true,
                postDeploy: false,
                executed: true,
                executedAt: new Date().toISOString()
            },
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-inventory',
                scriptName: 'V2_3_0__add_deduct_log_table.sql',
                version: '2.3.0',
                hasRollback: true,
                rollbackScript: 'U2_3_0__drop_deduct_log_table.sql',
                migrationType: 'schema',
                preDeploy: true,
                postDeploy: false,
                executed: true,
                executedAt: new Date().toISOString()
            },
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-payment',
                scriptName: 'V1_8_2__fix_callback_timeout.sql',
                version: '1.8.2',
                hasRollback: true,
                rollbackScript: 'U1_8_2__revert_callback_timeout.sql',
                migrationType: 'both',
                preDeploy: false,
                postDeploy: true,
                executed: false
            }
        ],
        switches: [
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-order',
                key: 'order.new.status.flow.enabled',
                targetValue: 'true',
                currentValue: 'false',
                preConfigured: true,
                switchOrder: 1,
                description: '启用新的订单状态流转'
            },
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-payment',
                key: 'payment.callback.timeout.seconds',
                targetValue: '30',
                currentValue: '15',
                preConfigured: true,
                switchOrder: 1,
                description: '支付回调超时时间'
            },
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-notification',
                key: 'sms.template.version',
                targetValue: 'v2',
                currentValue: 'v1',
                preConfigured: true,
                switchOrder: 1,
                description: '短信模板版本'
            }
        ],
        contacts: [
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-order',
                name: '张三',
                role: '订单服务负责人',
                phone: '13800138001',
                email: 'zhangsan@example.com',
                isPrimary: true,
                available: true
            },
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-payment',
                name: '李四',
                role: '支付服务负责人',
                phone: '13800138002',
                email: 'lisi@example.com',
                isPrimary: true,
                available: true
            },
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-inventory',
                name: '赵六',
                role: '库存服务负责人',
                phone: '13800138004',
                email: 'zhaoliu@example.com',
                isPrimary: true,
                available: true
            },
            {
                id: (0, uuid_1.v4)(),
                serviceId: 'svc-notification',
                name: '钱七',
                role: '通知服务负责人',
                phone: '13800138005',
                email: 'qianqi@example.com',
                isPrimary: true,
                available: true
            }
        ],
        waivers: [],
        checkHistory: [],
        corrections: []
    };
}
//# sourceMappingURL=samples.js.map