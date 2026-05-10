import { PrismaClient } from '@prisma/client';
import { SLOType, TimeWindowType } from '../src/types/enums';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化示例数据...');

  const demoTenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant-id' },
    update: {},
    create: {
      id: 'demo-tenant-id',
      name: '演示租户',
      description: '用于演示和测试的租户',
    },
  });
  console.log(`租户: ${demoTenant.name}`);

  const apiService = await prisma.service.upsert({
    where: {
      tenantId_name: {
        tenantId: demoTenant.id,
        name: '订单服务',
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: '订单服务',
      description: '核心订单处理服务',
    },
  });
  console.log(`服务: ${apiService.name}`);

  const createOrderEndpoint = await prisma.aPIEndpoint.upsert({
    where: {
      serviceId_method_path: {
        serviceId: apiService.id,
        method: 'POST',
        path: '/api/orders',
      },
    },
    update: {},
    create: {
      serviceId: apiService.id,
      method: 'POST',
      path: '/api/orders',
      description: '创建订单',
    },
  });

  const getOrderEndpoint = await prisma.aPIEndpoint.upsert({
    where: {
      serviceId_method_path: {
        serviceId: apiService.id,
        method: 'GET',
        path: '/api/orders/:id',
      },
    },
    update: {},
    create: {
      serviceId: apiService.id,
      method: 'GET',
      path: '/api/orders/:id',
      description: '查询订单详情',
    },
  });
  console.log(`接口: ${createOrderEndpoint.method} ${createOrderEndpoint.path}, ${getOrderEndpoint.method} ${getOrderEndpoint.path}`);

  const serviceLevelSLO = await prisma.sLOConfiguration.upsert({
    where: { id: 'demo-slo-service' },
    update: {},
    create: {
      id: 'demo-slo-service',
      tenantId: demoTenant.id,
      serviceId: apiService.id,
      name: '订单服务可用性 SLO',
      type: SLOType.AVAILABILITY,
      targetValue: 99.9,
      timeWindowType: TimeWindowType.DAILY,
      description: '订单服务整体可用性目标 99.9%',
      isActive: true,
    },
  });

  const endpointLevelSLO = await prisma.sLOConfiguration.upsert({
    where: { id: 'demo-slo-endpoint' },
    update: {},
    create: {
      id: 'demo-slo-endpoint',
      tenantId: demoTenant.id,
      serviceId: apiService.id,
      endpointId: createOrderEndpoint.id,
      name: '创建订单接口 SLO',
      type: SLOType.ERROR_RATE,
      targetValue: 99.5,
      timeWindowType: TimeWindowType.DAILY,
      description: '创建订单接口错误率目标 99.5%',
      isActive: true,
    },
  });
  console.log(`SLO配置: ${serviceLevelSLO.name}, ${endpointLevelSLO.name}`);

  console.log('\n示例数据初始化完成！');
  console.log(`\n快速开始指南:`);
  console.log(`1. 租户ID: ${demoTenant.id}`);
  console.log(`2. 服务ID: ${apiService.id}`);
  console.log(`3. 接口ID(创建订单): ${createOrderEndpoint.id}`);
  console.log(`4. SLO配置ID(服务级): ${serviceLevelSLO.id}`);
  console.log(`5. SLO配置ID(接口级): ${endpointLevelSLO.id}`);
  console.log(`\n接下来可以:`);
  console.log(`- 记录错误样本 -> POST /api/v1/tenants/${demoTenant.id}/error-samples`);
  console.log(`- 批量记录并扣减预算 -> POST /api/v1/tenants/${demoTenant.id}/error-samples/batch-deduct`);
  console.log(`- 查看预算状态 -> GET /api/v1/slo-configs/${serviceLevelSLO.id}/budget/status`);
  console.log(`- 查看流程卡点 -> GET /api/v1/tenants/${demoTenant.id}/process-traces/current-blocker`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
