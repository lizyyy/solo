const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');

const prisma = new PrismaClient();

async function main() {
  await prisma.application.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.licenseChannel.deleteMany();
  await prisma.clipVersion.deleteMany();
  await prisma.material.deleteMany();

  const influencerMaterial = await prisma.material.create({
    data: {
      name: '美食达人授权短视频',
      description: '抖音美食博主小王合作拍摄的餐厅推广素材',
      type: 'INFLUENCER',
      clipVersions: {
        create: [
          { version: 'v1.0', fileName: 'influencer_v1.mp4', duration: 60, size: 102400, description: '原版竖屏' },
          { version: 'v1.1', fileName: 'influencer_v1_1.mp4', duration: 55, size: 95000, description: '精简版' },
        ],
      },
      channels: {
        create: [
          { channelName: '抖音', description: '抖音短视频平台' },
          { channelName: '小红书', description: '小红书平台' },
        ],
      },
    },
    include: { channels: true },
  });

  const douyinChannel = influencerMaterial.channels.find(c => c.channelName === '抖音');
  const xhsChannel = influencerMaterial.channels.find(c => c.channelName === '小红书');

  await prisma.contract.createMany({
    data: [
      {
        materialId: influencerMaterial.id,
        channelId: douyinChannel.id,
        contractNumber: 'INF-2026-001',
        startDate: dayjs().subtract(1, 'month').toDate(),
        endDate: dayjs().add(6, 'month').toDate(),
        notes: '达人独家合作，需注明来源',
      },
      {
        materialId: influencerMaterial.id,
        channelId: xhsChannel.id,
        contractNumber: 'INF-2026-002',
        startDate: dayjs().subtract(1, 'month').toDate(),
        endDate: dayjs().add(3, 'month').toDate(),
        notes: '小红书授权，需添加@品牌账号',
      },
    ],
  });

  const brandMaterial = await prisma.material.create({
    data: {
      name: '品牌官方宣传片',
      description: '品牌自有素材，全年可用',
      type: 'BRAND_OWNED',
      clipVersions: {
        create: [
          { version: 'v1.0', fileName: 'brand_official.mp4', duration: 120, size: 204800, description: '完整版' },
          { version: 'v1.0_30s', fileName: 'brand_30s.mp4', duration: 30, size: 51200, description: '30秒剪辑' },
          { version: 'v1.0_15s', fileName: 'brand_15s.mp4', duration: 15, size: 25600, description: '15秒剪辑' },
        ],
      },
      channels: {
        create: [
          { channelName: '抖音', description: '抖音短视频平台' },
          { channelName: '快手', description: '快手平台' },
          { channelName: '视频号', description: '微信视频号' },
          { channelName: '小红书', description: '小红书平台' },
        ],
      },
    },
    include: { channels: true },
  });

  for (const channel of brandMaterial.channels) {
    await prisma.contract.create({
      data: {
        materialId: brandMaterial.id,
        channelId: channel.id,
        contractNumber: `BRAND-${channel.channelName.toUpperCase()}-2026`,
        startDate: dayjs().subtract(1, 'year').toDate(),
        endDate: dayjs().add(2, 'year').toDate(),
        notes: '品牌自有素材，全渠道长期可用',
      },
    });
  }

  const expiredMaterial = await prisma.material.create({
    data: {
      name: '过期达人素材',
      description: '已过期的合作素材，禁止使用',
      type: 'INFLUENCER',
      clipVersions: {
        create: [
          { version: 'v1.0', fileName: 'expired_v1.mp4', duration: 45, size: 76800, description: '已过期版本' },
        ],
      },
      channels: {
        create: [
          { channelName: '抖音', description: '原授权平台' },
        ],
      },
    },
    include: { channels: true },
  });

  await prisma.contract.create({
    data: {
      materialId: expiredMaterial.id,
      channelId: expiredMaterial.channels[0].id,
      contractNumber: 'EXP-2025-001',
      startDate: dayjs().subtract(6, 'month').toDate(),
      endDate: dayjs().subtract(1, 'day').toDate(),
      notes: '已过期合同',
    },
  });

  const inactiveMaterial = await prisma.material.create({
    data: {
      name: '已下架素材',
      description: '已下架的产品素材，禁止使用',
      type: 'OTHER',
      status: 'inactive',
      clipVersions: {
        create: [
          { version: 'v1.0', fileName: 'inactive_v1.mp4', duration: 30, size: 51200, description: '旧版本' },
        ],
      },
      channels: {
        create: [
          { channelName: '抖音', description: '原投放平台' },
        ],
      },
    },
    include: { channels: true },
  });

  await prisma.contract.create({
    data: {
      materialId: inactiveMaterial.id,
      channelId: inactiveMaterial.channels[0].id,
      contractNumber: 'OLD-2025-001',
      startDate: dayjs().subtract(3, 'month').toDate(),
      endDate: dayjs().add(9, 'month').toDate(),
      notes: '素材已下架',
    },
  });

  console.log('样例数据创建完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
