import { PrismaClient, ConfigStatus, InstanceStatus, PullStatus, EffectiveStatus, CompensateStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始播种数据...');

  const config1 = await prisma.configItem.create({
    data: {
      key: 'feature.flagA',
      value: 'true',
      description: '特性开关A',
      status: ConfigStatus.PUBLISHED,
      version: 1,
    },
  });

  const config2 = await prisma.configItem.create({
    data: {
      key: 'feature.flagB',
      value: 'false',
      description: '特性开关B',
      status: ConfigStatus.DRAFT,
      version: 1,
    },
  });

  const config3 = await prisma.configItem.create({
    data: {
      key: 'system.timeout',
      value: '30000',
      description: '系统超时时间',
      status: ConfigStatus.PUBLISHED,
      version: 2,
    },
  });

  const instance1 = await prisma.serviceInstance.create({
    data: {
      instanceId: 'service-001',
      serviceName: 'order-service',
      ipAddress: '192.168.1.101',
      hostname: 'order-01',
      env: 'production',
      status: InstanceStatus.ONLINE,
    },
  });

  const instance2 = await prisma.serviceInstance.create({
    data: {
      instanceId: 'service-002',
      serviceName: 'order-service',
      ipAddress: '192.168.1.102',
      hostname: 'order-02',
      env: 'production',
      status: InstanceStatus.ONLINE,
    },
  });

  const instance3 = await prisma.serviceInstance.create({
    data: {
      instanceId: 'service-003',
      serviceName: 'user-service',
      ipAddress: '192.168.1.103',
      hostname: 'user-01',
      env: 'production',
      status: InstanceStatus.OFFLINE,
    },
  });

  const distribution1 = await prisma.distributionVersion.create({
    data: {
      configId: config1.id,
      version: 1,
      releasedBy: 'admin',
      releaseNote: '首次发布',
    },
  });

  const distribution2 = await prisma.distributionVersion.create({
    data: {
      configId: config3.id,
      version: 2,
      releasedBy: 'admin',
      releaseNote: '更新超时时间',
    },
  });

  await prisma.pullRecord.createMany({
    data: [
      {
        configId: config1.id,
        instanceId: instance1.id,
        distributionId: distribution1.id,
        requestedVersion: 1,
        actualVersion: 1,
        pullStatus: PullStatus.SUCCESS,
      },
      {
        configId: config1.id,
        instanceId: instance2.id,
        distributionId: distribution1.id,
        requestedVersion: 1,
        actualVersion: 1,
        pullStatus: PullStatus.SUCCESS,
      },
      {
        configId: config3.id,
        instanceId: instance1.id,
        distributionId: distribution2.id,
        requestedVersion: 2,
        actualVersion: 2,
        pullStatus: PullStatus.SUCCESS,
      },
      {
        configId: config3.id,
        instanceId: instance2.id,
        distributionId: distribution2.id,
        requestedVersion: 2,
        actualVersion: 1,
        pullStatus: PullStatus.FAILED,
        errorMessage: '网络超时，重试3次后失败',
      },
      {
        configId: config1.id,
        instanceId: instance3.id,
        distributionId: distribution1.id,
        requestedVersion: 1,
        actualVersion: null,
        pullStatus: PullStatus.PENDING,
      },
    ],
  });

  await prisma.effectiveState.createMany({
    data: [
      {
        configId: config1.id,
        instanceId: instance1.id,
        currentVersion: 1,
        effectiveStatus: EffectiveStatus.EFFECTIVE,
        compensateStatus: CompensateStatus.COMPLETED,
        lastConfirmedAt: new Date(),
      },
      {
        configId: config1.id,
        instanceId: instance2.id,
        currentVersion: 1,
        effectiveStatus: EffectiveStatus.EFFECTIVE,
        compensateStatus: CompensateStatus.COMPLETED,
        lastConfirmedAt: new Date(),
      },
      {
        configId: config3.id,
        instanceId: instance1.id,
        currentVersion: 2,
        effectiveStatus: EffectiveStatus.EFFECTIVE,
        compensateStatus: CompensateStatus.COMPLETED,
        lastConfirmedAt: new Date(),
      },
      {
        configId: config3.id,
        instanceId: instance2.id,
        currentVersion: 1,
        effectiveStatus: EffectiveStatus.NOT_EFFECTIVE,
        compensateStatus: CompensateStatus.PENDING,
      },
      {
        configId: config1.id,
        instanceId: instance3.id,
        currentVersion: 0,
        effectiveStatus: EffectiveStatus.UNKNOWN,
        compensateStatus: CompensateStatus.NOT_NEEDED,
      },
    ],
  });

  await prisma.diffReport.create({
    data: {
      configId: config3.id,
      baseVersion: 1,
      targetVersion: 2,
      diffContent: JSON.stringify({ old: '30000', new: '30000', changed: false }),
      affectedInstances: 1,
      generatedBy: 'system',
    },
  });

  console.log('数据播种完成！');
  console.log(`创建了 3 个配置项`);
  console.log(`创建了 3 个服务实例`);
  console.log(`创建了 2 个分发版本`);
  console.log(`创建了 5 条拉取记录`);
  console.log(`创建了 5 条生效状态记录`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
