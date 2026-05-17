"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedWhitelist = seedWhitelist;
const whitelist_service_1 = require("../services/whitelist.service");
const whitelist_model_1 = require("../models/whitelist.model");
const seedData = [
    {
        tenantId: 'tenant-001',
        tenantName: '阿里巴巴集团',
        apiGroupId: 'api-group-001',
        apiGroupName: '用户中心接口组',
        rateLimitRule: {
            maxRequests: 5000,
            unit: whitelist_model_1.RateLimitUnit.SECOND,
            burstLimit: 10000
        },
        effectiveDate: new Date(),
        expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        applicant: '张三',
        reason: '双11大促活动提升限流',
        remark: '2024双11专属白名单'
    },
    {
        tenantId: 'tenant-001',
        tenantName: '阿里巴巴集团',
        apiGroupId: 'api-group-002',
        apiGroupName: '订单中心接口组',
        rateLimitRule: {
            maxRequests: 3000,
            unit: whitelist_model_1.RateLimitUnit.SECOND,
            burstLimit: 6000
        },
        effectiveDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        applicant: '张三',
        reason: '订单系统压测需要',
        remark: '压测专用，到期自动失效'
    },
    {
        tenantId: 'tenant-002',
        tenantName: '腾讯科技',
        apiGroupId: 'api-group-001',
        apiGroupName: '用户中心接口组',
        rateLimitRule: {
            maxRequests: 2000,
            unit: whitelist_model_1.RateLimitUnit.SECOND,
            burstLimit: 4000
        },
        effectiveDate: new Date(),
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        applicant: '李四',
        reason: '长期合作客户专属通道',
        remark: 'VIP客户'
    },
    {
        tenantId: 'tenant-003',
        tenantName: '字节跳动',
        apiGroupId: 'api-group-003',
        apiGroupName: '支付中心接口组',
        rateLimitRule: {
            maxRequests: 1000,
            unit: whitelist_model_1.RateLimitUnit.MINUTE,
            burstLimit: 2000
        },
        effectiveDate: new Date(),
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        applicant: '王五',
        reason: '临时活动申请',
        remark: '活动仅剩5天'
    },
    {
        tenantId: 'tenant-004',
        tenantName: '京东集团',
        apiGroupId: 'api-group-004',
        apiGroupName: '物流中心接口组',
        rateLimitRule: {
            maxRequests: 500,
            unit: whitelist_model_1.RateLimitUnit.MINUTE,
            burstLimit: 1000
        },
        effectiveDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        applicant: '赵六',
        reason: '618活动已结束',
        remark: '已过期'
    }
];
function seedWhitelist() {
    console.log('开始播种白名单数据...');
    whitelist_service_1.whitelistService.clearAll();
    seedData.forEach((data, index) => {
        try {
            const record = whitelist_service_1.whitelistService.create(data);
            if (index < 2) {
                whitelist_service_1.whitelistService.approve(record.id, {
                    approver: '管理员A',
                    remark: '审批通过'
                });
            }
            else if (index === 4) {
                whitelist_service_1.whitelistService.approve(record.id, {
                    approver: '管理员A',
                    remark: '审批通过'
                });
            }
            console.log(`✓ 创建记录: ${data.tenantName} - ${data.apiGroupName}`);
        }
        catch (error) {
            console.error(`✗ 创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });
    whitelist_service_1.whitelistService.refreshStatuses();
    const allRecords = whitelist_service_1.whitelistService.findAll();
    console.log(`\n播种完成，共创建 ${allRecords.length} 条记录`);
    console.log('状态统计:');
    Object.values(whitelist_model_1.WhitelistStatus).forEach(status => {
        const count = allRecords.filter(r => r.status === status).length;
        if (count > 0) {
            console.log(`  ${status}: ${count}条`);
        }
    });
}
if (require.main === module) {
    seedWhitelist();
}
exports.default = seedWhitelist;
