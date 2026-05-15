import { visitorService } from './services/VisitorService';
import { store } from './database/store';
import { VisitorStatus } from '../shared/types';
import dayjs from 'dayjs';

console.log('开始初始化演示场景数据...\n');

async function initScenarios() {
  console.log('========================================');
  console.log('场景一：正常完成流程');
  console.log('========================================\n');

  const visitor1 = visitorService.createVisitor({
    visitorName: '张三',
    visitorPhone: '13800138001',
    visitorIdCard: '110101199001011234',
    visitorPlate: '京A12345',
    visitorCompany: '科技有限公司',
    hostName: '李四',
    hostPhone: '13900139001',
    hostDepartment: '研发部',
    visitReason: '项目对接会议',
    expectedVisitDate: dayjs().format('YYYY-MM-DD'),
    expectedVisitTime: '09:00:00'
  }, 'admin', '管理员');
  console.log(`1. 创建访客预约: ${visitor1.visitorName} (${visitor1.id})`);

  await new Promise(r => setTimeout(r, 100));
  visitorService.hostConfirm(visitor1.id, true, '李四', '被访人');
  console.log('2. 被访人确认同意');

  await new Promise(r => setTimeout(r, 100));
  visitorService.verifyPlateEntry(visitor1.id, '京A12345', 'security', '安保人员');
  console.log('3. 车牌校验通过，成功入园');

  await new Promise(r => setTimeout(r, 100));
  const qrcode1 = visitorService.generateQRCode(visitor1.id, 'admin', '管理员');
  console.log(`4. 生成门禁二维码: ${qrcode1.qrcode}`);

  await new Promise(r => setTimeout(r, 100));
  visitorService.scanQRCode(visitor1.id, qrcode1.qrcode, 'security', '安保人员');
  console.log('5. 扫描门禁二维码成功');

  await new Promise(r => setTimeout(r, 100));
  visitorService.checkout(visitor1.id, 'manual', 'security', '安保人员');
  console.log('6. 离园核销成功\n');

  console.log('========================================');
  console.log('场景二：被规则挡住（黑名单拦截）');
  console.log('========================================\n');

  visitorService.addToBlacklist(
    '王五',
    '13800138002',
    '110101199002025678',
    '多次违规闯入',
    'admin',
    '管理员'
  );
  console.log('1. 将王五加入黑名单');

  try {
    visitorService.createVisitor({
      visitorName: '王五',
      visitorPhone: '13800138002',
      visitorIdCard: '110101199002025678',
      visitorPlate: '京B67890',
      visitorCompany: '贸易公司',
      hostName: '赵六',
      hostPhone: '13900139002',
      hostDepartment: '市场部',
      visitReason: '商务洽谈',
      expectedVisitDate: dayjs().format('YYYY-MM-DD'),
      expectedVisitTime: '10:00:00'
    }, 'admin', '管理员');
  } catch (e: any) {
    console.log(`2. 黑名单访客创建预约被拦截: ${e.message}`);
  }

  const visitor2 = visitorService.createVisitor({
    visitorName: '钱七',
    visitorPhone: '13800138003',
    visitorPlate: '京C11111',
    visitorCompany: '咨询公司',
    hostName: '孙八',
    hostPhone: '13900139003',
    hostDepartment: '财务部',
    visitReason: '审计工作',
    expectedVisitDate: dayjs().format('YYYY-MM-DD'),
    expectedVisitTime: '14:00:00'
  }, 'admin', '管理员');
  console.log(`\n3. 创建正常访客预约: ${visitor2.visitorName}`);

  await new Promise(r => setTimeout(r, 100));
  visitorService.hostConfirm(visitor2.id, false, '孙八', '被访人', '时间冲突，改期');
  console.log('4. 被访人拒绝预约');

  try {
    visitorService.verifyPlateEntry(visitor2.id, '京C11111', 'security', '安保人员');
  } catch (e: any) {
    console.log(`5. 被拒绝访客尝试入园被拦截: ${e.message}\n`);
  }

  console.log('========================================');
  console.log('场景三：人工复核（车牌不匹配）');
  console.log('========================================\n');

  const visitor3 = visitorService.createVisitor({
    visitorName: '周九',
    visitorPhone: '13800138004',
    visitorPlate: '京D22222',
    visitorCompany: '设计公司',
    hostName: '吴十',
    hostPhone: '13900139004',
    hostDepartment: '设计部',
    visitReason: '设计方案讨论',
    expectedVisitDate: dayjs().format('YYYY-MM-DD'),
    expectedVisitTime: '15:00:00'
  }, 'admin', '管理员');
  console.log(`1. 创建访客预约: ${visitor3.visitorName} (预约车牌: 京D22222)`);

  await new Promise(r => setTimeout(r, 100));
  visitorService.hostConfirm(visitor3.id, true, '吴十', '被访人');
  console.log('2. 被访人确认同意');

  await new Promise(r => setTimeout(r, 100));
  try {
    visitorService.verifyPlateEntry(visitor3.id, '京E99999', 'security', '安保人员');
  } catch (e: any) {
    console.log(`3. 实际车牌京E99999与预约不符，进入人工复核`);
  }

  await new Promise(r => setTimeout(r, 100));
  visitorService.manualReview(visitor3.id, true, 'admin', '管理员', '核实确为预约访客，放行');
  console.log('4. 管理员人工复核通过\n');

  console.log('========================================');
  console.log('场景四：重复提交防护');
  console.log('========================================\n');

  const visitor4 = visitorService.createVisitor({
    visitorName: '郑十一',
    visitorPhone: '13800138005',
    visitorPlate: '京F33333',
    visitorCompany: '物流公司',
    hostName: '冯十二',
    hostPhone: '13900139005',
    hostDepartment: '物流部',
    visitReason: '送货',
    expectedVisitDate: dayjs().format('YYYY-MM-DD'),
    expectedVisitTime: '16:00:00'
  }, 'admin', '管理员');
  console.log(`1. 创建访客预约: ${visitor4.visitorName}`);

  await new Promise(r => setTimeout(r, 100));
  visitorService.hostConfirm(visitor4.id, true, '冯十二', '被访人');
  console.log('2. 被访人确认同意');

  await new Promise(r => setTimeout(r, 100));
  visitorService.verifyPlateEntry(visitor4.id, '京F33333', 'security', '安保人员');
  console.log('3. 第一次车牌校验通过');

  try {
    visitorService.verifyPlateEntry(visitor4.id, '京F33333', 'security', '安保人员');
  } catch (e: any) {
    console.log(`4. 重复车牌校验被拦截: ${e.message}`);
  }

  await new Promise(r => setTimeout(r, 100));
  const qrcode4 = visitorService.generateQRCode(visitor4.id, 'admin', '管理员');
  visitorService.scanQRCode(visitor4.id, qrcode4.qrcode, 'security', '安保人员');
  console.log('5. 扫描门禁二维码成功');

  try {
    visitorService.scanQRCode(visitor4.id, qrcode4.qrcode, 'security', '安保人员');
  } catch (e: any) {
    console.log(`6. 重复扫描二维码被拦截: ${e.message}`);
  }

  await new Promise(r => setTimeout(r, 100));
  visitorService.checkout(visitor4.id, 'manual', 'security', '安保人员');
  console.log('7. 离园核销成功');

  try {
    visitorService.checkout(visitor4.id, 'manual', 'security', '安保人员');
  } catch (e: any) {
    console.log(`8. 重复离园核销被拦截: ${e.message}\n`);
  }

  console.log('========================================');
  console.log('黑名单变更演示：添加后再移除');
  console.log('========================================\n');

  const blacklist1 = store.getAllBlacklist()[0];
  if (blacklist1) {
    await new Promise(r => setTimeout(r, 100));
    visitorService.removeFromBlacklist(blacklist1.id, 'admin', '管理员', '已完成整改，解除限制');
    console.log('移除黑名单记录，导出时可追踪责任人和影响记录\n');
  }

  console.log('演示场景数据初始化完成！');
  console.log(`总计: ${store.getAllVisitors().length} 条访客记录，${store.getAllOperationLogs().length} 条操作日志`);
}

initScenarios().catch(console.error);
