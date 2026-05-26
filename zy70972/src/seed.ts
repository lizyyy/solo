import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建测试数据...');

  await prisma.activity.deleteMany({});
  await prisma.batch.deleteMany({});
  await prisma.registration.deleteMany({});
  await prisma.waitlistEntry.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.blacklistEntry.deleteMany({});
  await prisma.processingRecord.deleteMany({});
  await prisma.auditLog.deleteMany({});

  const activity = await prisma.activity.create({
    data: {
      name: '2024年夏季社区运动会',
      description: '街道社区夏季运动会报名活动',
      activityDate: new Date('2024-08-10'),
      totalQuota: 5,
    },
  });

  console.log(`创建活动: ${activity.name} (ID: ${activity.id})`);
  console.log(`活动名额: ${activity.totalQuota}`);

  const blacklistBatch = await prisma.batch.create({
    data: {
      activityId: activity.id,
      batchType: 'BLACKLIST_CSV',
      fileName: 'blacklist.csv',
      status: 'PROCESSED',
      processedBy: '系统管理员',
      processedAt: new Date(),
    },
  });

  await prisma.blacklistEntry.create({
    data: {
      activityId: activity.id,
      idCard: '110101199001011234',
      name: '张三',
      reason: '2023年活动报名后无故缺席，影响活动秩序',
      addedBy: '系统管理员',
    },
  });

  console.log('添加黑名单人员: 张三 (身份证: 110101199001011234)');

  const regBatch = await prisma.batch.create({
    data: {
      activityId: activity.id,
      batchType: 'REGISTRATION_CSV',
      fileName: 'registrations_batch1.csv',
      status: 'PROCESSED',
      processedBy: '李主任',
      processedAt: new Date(),
    },
  });

  const registrations = [
    { idCard: '110101199001012345', name: '李四', phone: '13800138001', community: '阳光社区', order: 1 },
    { idCard: '110101199001013456', name: '王五', phone: '13800138002', community: '和平社区', order: 2 },
    { idCard: '110101199001014567', name: '赵六', phone: '13800138003', community: '阳光社区', order: 3 },
    { idCard: '110101199001012345', name: '李四', phone: '13800138001', community: '阳光社区', order: 4 },
    { idCard: '110101199001011234', name: '张三', phone: '13800138004', community: '和平社区', order: 5 },
    { idCard: '110101199001015678', name: '钱七', phone: '13800138005', community: '幸福社区', order: 6 },
    { idCard: '110101199001016789', name: '孙八', phone: '13800138006', community: '阳光社区', order: 7 },
  ];

  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i];
    const isDuplicate = registrations.slice(0, i).some((r) => r.idCard === reg.idCard);
    const isBlacklisted = reg.idCard === '110101199001011234';

    let status = 'APPROVED';
    let waitlistOrder: number | null = null;

    if (isDuplicate || isBlacklisted) {
      status = 'REJECTED';
    } else {
      const approvedBefore = registrations
        .slice(0, i)
        .filter((r) => r.idCard !== '110101199001012345' && r.idCard !== '110101199001011234').length;

      if (approvedBefore >= activity.totalQuota) {
        status = 'WAITLISTED';
        waitlistOrder = approvedBefore - activity.totalQuota + 1;
      }
    }

    const registration = await prisma.registration.create({
      data: {
        batchId: regBatch.id,
        activityId: activity.id,
        idCard: reg.idCard,
        name: reg.name,
        phone: reg.phone,
        community: reg.community,
        source: 'DIRECT',
        originalOrder: reg.order,
        finalStatus: status,
        waitlistOrder,
        isDuplicate,
        isBlacklisted,
      },
    });

    if (isDuplicate) {
      await prisma.processingRecord.create({
        data: {
          registrationId: registration.id,
          action: 'MARK_DUPLICATE',
          statusBefore: 'PENDING',
          statusAfter: 'REJECTED',
          reason: '与第2条报名记录重复，同一身份证号多次报名',
          processedBy: '李主任',
        },
      });
      console.log(`  第${reg.order}条: ${reg.name} - 重复报名，已拒绝`);
    } else if (isBlacklisted) {
      await prisma.processingRecord.create({
        data: {
          registrationId: registration.id,
          action: 'MARK_BLACKLISTED',
          statusBefore: 'PENDING',
          statusAfter: 'REJECTED',
          reason: '黑名单人员，2023年活动报名后无故缺席',
          processedBy: '李主任',
        },
      });
      console.log(`  第${reg.order}条: ${reg.name} - 黑名单，已拒绝`);
    } else if (status === 'APPROVED') {
      await prisma.processingRecord.create({
        data: {
          registrationId: registration.id,
          action: 'APPROVE',
          statusBefore: 'PENDING',
          statusAfter: 'APPROVED',
          reason: '审核通过，报名成功',
          processedBy: '李主任',
        },
      });
      console.log(`  第${reg.order}条: ${reg.name} - 审核通过`);
    } else {
      await prisma.processingRecord.create({
        data: {
          registrationId: registration.id,
          action: 'REVIEW',
          statusBefore: 'PENDING',
          statusAfter: 'WAITLISTED',
          reason: `名额已满，进入候补队列，候补序号: ${waitlistOrder}`,
          processedBy: '李主任',
        },
      });
      console.log(`  第${reg.order}条: ${reg.name} - 进入候补 (序号: ${waitlistOrder})`);
    }
  }

  const waitlistBatch = await prisma.batch.create({
    data: {
      activityId: activity.id,
      batchType: 'WAITLIST_JSON',
      fileName: 'waitlist.json',
      status: 'PROCESSED',
      processedBy: '李主任',
      processedAt: new Date(),
    },
  });

  const waitlistData = [
    { idCard: '110101199001017890', name: '周九', phone: '13800138007', community: '和平社区', priority: 10 },
    { idCard: '110101199001018901', name: '吴十', phone: '13800138008', community: '幸福社区', priority: 5 },
    { idCard: '110101199001019012', name: '郑十一', phone: '13800138009', community: '阳光社区', priority: 8 },
  ];

  for (let i = 0; i < waitlistData.length; i++) {
    const entry = waitlistData[i];
    await prisma.waitlistEntry.create({
      data: {
        batchId: waitlistBatch.id,
        activityId: activity.id,
        idCard: entry.idCard,
        name: entry.name,
        phone: entry.phone,
        community: entry.community,
        waitlistOrder: i + 1,
        priority: entry.priority,
        reason: `社区推荐，优先级 ${entry.priority}`,
      },
    });
    console.log(`  候补第${i + 1}条: ${entry.name} (优先级: ${entry.priority})`);
  }

  console.log('\n测试数据创建完成!');
  console.log(`\n活动ID: ${activity.id}`);
  console.log(`\n可以使用以下接口测试:`);
  console.log(`  GET  http://localhost:3000/api/query/activities/${activity.id}/summary - 获取活动汇总`);
  console.log(`  GET  http://localhost:3000/api/query/registrations?activityId=${activity.id} - 查询所有报名记录`);
  console.log(`  GET  http://localhost:3000/api/query/waitlist?activityId=${activity.id} - 查询候补记录`);
  console.log(`  GET  http://localhost:3000/api/export/registrations?activityId=${activity.id} - 导出报名记录`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
