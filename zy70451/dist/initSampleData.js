"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSampleData = initSampleData;
const handoverService_1 = require("./services/handoverService");
function initSampleData() {
    console.log('📦 正在初始化样例数据...');
    const sampleForm = handoverService_1.handoverService.createHandoverForm({
        tenantId: 'TENANT001',
        tenantName: '示例科技有限公司',
        handler: '张三',
        serviceRecords: [
            {
                serviceName: '用户认证服务',
                status: 'pending',
                versions: [
                    {
                        serviceName: 'auth-service',
                        expectedVersion: 'v2.1.0',
                        actualVersion: 'v2.1.0',
                        isMatch: true
                    },
                    {
                        serviceName: 'oauth-provider',
                        expectedVersion: 'v1.5.0',
                        actualVersion: 'v1.5.0',
                        isMatch: true
                    }
                ],
                systemConclusion: ''
            },
            {
                serviceName: '会员续费服务',
                status: 'pending',
                versions: [
                    {
                        serviceName: 'membership-service',
                        expectedVersion: 'v3.2.0',
                        actualVersion: 'v3.1.5',
                        isMatch: false
                    },
                    {
                        serviceName: 'payment-gateway',
                        expectedVersion: 'v2.0.0',
                        actualVersion: 'v2.0.0',
                        isMatch: true
                    }
                ],
                systemConclusion: ''
            },
            {
                serviceName: '订单管理服务',
                status: 'pending',
                versions: [
                    {
                        serviceName: 'order-service',
                        expectedVersion: 'v4.0.0',
                        actualVersion: 'v4.0.0',
                        isMatch: true
                    }
                ],
                systemConclusion: ''
            }
        ]
    });
    console.log('✅ 交接单创建成功，表单号:', sampleForm.formNo);
    console.log('📋 表单ID:', sampleForm.id);
    const processedForm = handoverService_1.handoverService.processHandoverForm(sampleForm.id);
    console.log('✅ 交接单处理完成，状态:', processedForm.status);
    console.log('📊 服务记录明细:');
    processedForm.serviceRecords.forEach((sr, index) => {
        console.log(`   ${index + 1}. ${sr.serviceName} - ${sr.status}`);
        console.log(`      系统结论: ${sr.systemConclusion}`);
    });
    console.log('\n💡 样例数据初始化完成！');
    console.log(`   - 包含3个服务记录`);
    console.log(`   - 其中"会员续费服务"存在版本不一致（membership-service 期望v3.2.0，实际v3.1.5）`);
    console.log(`   - 处理后状态为 partial_success (部分成功)`);
    console.log(`   - 数据已持久化到 data/ 目录，重启服务后数据不丢失`);
    return sampleForm;
}
if (require.main === module) {
    initSampleData();
}
