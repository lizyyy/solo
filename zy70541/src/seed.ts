import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化种子数据...');

  await prisma.secret.deleteMany();
  await prisma.reference.deleteMany();
  await prisma.replacementPlan.deleteMany();
  await prisma.accessLog.deleteMany();
  await prisma.correctionLog.deleteMany();
  await prisma.errorRecord.deleteMany();

  const secret1 = await prisma.secret.create({
    data: {
      name: 'DB_PASSWORD',
      description: '生产数据库密码',
      status: 'ACTIVE',
    },
  });

  const secret2 = await prisma.secret.create({
    data: {
      name: 'API_KEY',
      description: '第三方API密钥',
      status: 'DEPRECATED',
    },
  });

  await prisma.secret.create({
    data: {
      name: 'JWT_SECRET',
      description: 'JWT签名密钥',
      status: 'ACTIVE',
    },
  });

  const ref1 = await prisma.reference.create({
    data: {
      secret_id: secret1.id,
      secret_name: secret1.name,
      service_name: 'order-service',
      environment: 'prod',
      file_path: 'config/prod.yaml',
      line_number: 45,
      is_active: true,
    },
  });

  const ref2 = await prisma.reference.create({
    data: {
      secret_id: secret1.id,
      secret_name: secret1.name,
      service_name: 'payment-service',
      environment: 'prod',
      file_path: '.env.prod',
      line_number: 12,
      is_active: true,
    },
  });

  await prisma.reference.create({
    data: {
      secret_id: secret1.id,
      secret_name: secret1.name,
      service_name: 'user-service',
      environment: 'staging',
      file_path: 'config/staging.yaml',
      line_number: 33,
      is_active: true,
    },
  });

  await prisma.reference.create({
    data: {
      secret_id: secret2.id,
      secret_name: secret2.name,
      service_name: 'legacy-service',
      environment: 'prod',
      file_path: 'legacy/config.json',
      line_number: 8,
      is_active: true,
    },
  });

  await prisma.accessLog.createMany({
    data: [
      {
        secret_id: secret1.id,
        reference_id: ref1.id,
        accessed_by: 'system',
        access_source: 'order-service-01',
      },
      {
        secret_id: secret1.id,
        reference_id: ref2.id,
        accessed_by: 'system',
        access_source: 'payment-service-01',
      },
    ],
  });

  await prisma.replacementPlan.create({
    data: {
      secret_id: secret2.id,
      new_secret_name: 'NEW_API_KEY',
      planned_date: new Date('2024-12-31'),
      created_by: 'admin',
      status: 'PENDING_APPROVAL',
    },
  });

  console.log('种子数据初始化完成！');
  console.log('创建的Secret: DB_PASSWORD, API_KEY, JWT_SECRET');
  console.log('DB_PASSWORD 有 3 个活跃引用，删除会被拦截');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
