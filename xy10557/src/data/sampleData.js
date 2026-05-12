const pickupService = require('../services/pickupService');
const store = require('./store');

function initSampleData() {
  console.log('正在初始化样例数据...');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const child1 = pickupService.createChild({
    name: '张小明',
    dateOfBirth: '2020-05-15',
    gender: '男',
    class: '阳光班',
    parentName: '张伟',
    parentPhone: '13800138001'
  }, 'system-init');

  const child2 = pickupService.createChild({
    name: '李小红',
    dateOfBirth: '2020-08-20',
    gender: '女',
    class: '阳光班',
    parentName: '李华',
    parentPhone: '13800138002'
  }, 'system-init');

  const child3 = pickupService.createChild({
    name: '王小强',
    dateOfBirth: '2020-03-10',
    gender: '男',
    class: '彩虹班',
    parentName: '王芳',
    parentPhone: '13800138003'
  }, 'system-init');

  const child4 = pickupService.createChild({
    name: '陈小美',
    dateOfBirth: '2020-11-05',
    gender: '女',
    class: '彩虹班',
    parentName: '陈刚',
    parentPhone: '13800138004'
  }, 'system-init');

  const parentAuth1 = pickupService.createFixedAuthorization({
    childId: child1.id,
    authorizerId: 'auth_parent_zhangwei',
    authorizerName: '张伟',
    authorizerPhone: '13800138001',
    authorizerIdNumber: '110101198001011234',
    relation: '父亲',
    validFrom: today.toISOString(),
    validUntil: nextWeek.toISOString()
  }, 'system-init');

  pickupService.createFixedAuthorization({
    childId: child1.id,
    authorizerId: 'auth_grandma_wanglan',
    authorizerName: '王兰',
    authorizerPhone: '13800138011',
    authorizerIdNumber: '110101195501015678',
    relation: '奶奶',
    validFrom: today.toISOString(),
    validUntil: nextWeek.toISOString()
  }, 'system-init');

  pickupService.createFixedAuthorization({
    childId: child2.id,
    authorizerId: 'auth_parent_lihua',
    authorizerName: '李华',
    authorizerPhone: '13800138002',
    authorizerIdNumber: '110101198002022345',
    relation: '父亲',
    validFrom: today.toISOString(),
    validUntil: nextWeek.toISOString()
  }, 'system-init');

  pickupService.createFixedAuthorization({
    childId: child2.id,
    authorizerId: 'auth_mother_zhangying',
    authorizerName: '张英',
    authorizerPhone: '13800138022',
    authorizerIdNumber: '110101198003033456',
    relation: '母亲',
    validFrom: yesterday.toISOString(),
    validUntil: yesterday.toISOString()
  }, 'system-init');

  pickupService.createFixedAuthorization({
    childId: child3.id,
    authorizerId: 'auth_parent_wangfang',
    authorizerName: '王芳',
    authorizerPhone: '13800138003',
    authorizerIdNumber: '110101198004044567',
    relation: '母亲',
    validFrom: today.toISOString(),
    validUntil: nextWeek.toISOString()
  }, 'system-init');

  pickupService.createFixedAuthorization({
    childId: child4.id,
    authorizerId: 'auth_parent_chengang',
    authorizerName: '陈刚',
    authorizerPhone: '13800138004',
    authorizerIdNumber: '110101198005055678',
    relation: '父亲',
    validFrom: today.toISOString(),
    validUntil: nextWeek.toISOString()
  }, 'system-init');

  const tempAuth1 = pickupService.createTemporaryAuthorization({
    childId: child1.id,
    authorizerId: 'temp_auth_uncle_zhangqiang',
    authorizerName: '张强',
    authorizerPhone: '13800138055',
    authorizerIdNumber: '110101198506066789',
    relation: '叔叔',
    validFrom: today.toISOString(),
    validUntil: tomorrow.toISOString(),
    pickupTime: today.toISOString().split('T')[0] + 'T17:00:00'
  }, 'system-init');

  pickupService.confirmTemporaryAuthorization(tempAuth1.id, 'teacher_lisi');

  pickupService.createTemporaryAuthorization({
    childId: child2.id,
    authorizerId: 'temp_auth_cousin_liming',
    authorizerName: '李明',
    authorizerPhone: '13800138066',
    authorizerIdNumber: '110101199007077890',
    relation: '表哥',
    validFrom: today.toISOString(),
    validUntil: tomorrow.toISOString(),
    pickupTime: today.toISOString().split('T')[0] + 'T17:30:00'
  }, 'system-init');

  pickupService.addToBlacklist({
    authorizerId: 'blacklist_liulei',
    authorizerName: '刘磊',
    authorizerPhone: '13800138099',
    reason: '陌生人，曾试图强行接走儿童'
  }, 'system-init');

  const todayStr = today.toISOString().split('T')[0];

  pickupService.checkIn({
    childId: child1.id,
    checkInTime: `${todayStr}T08:05:00`,
    notes: '正常入园'
  }, null, 'teacher_wang');

  pickupService.checkIn({
    childId: child2.id,
    checkInTime: `${todayStr}T08:10:00`,
    notes: '正常入园'
  }, null, 'teacher_wang');

  pickupService.checkIn({
    childId: child3.id,
    checkInTime: `${todayStr}T07:55:00`,
    notes: '正常入园'
  }, null, 'teacher_wang');

  pickupService.pickup({
    childId: child3.id,
    authorizerId: 'auth_parent_wangfang',
    authorizerName: '王芳',
    pickupTime: `${todayStr}T16:30:00`,
    notes: '正常离园'
  }, null, 'teacher_li');

  console.log('样例数据初始化完成!');
  console.log('\n=== 样例数据概览 ===');
  console.log('儿童档案: 4人');
  console.log('固定授权: 6人');
  console.log('临时授权: 2人 (1个已确认, 1个待确认)');
  console.log('黑名单: 1人');
  console.log('今日签到: 3人');
  console.log('今日接送: 1人');
  console.log('\n=== 可用演示场景 ===');
  console.log('1. 正常接送路径: 张小明 + 张伟(父亲)');
  console.log('2. 临时授权路径: 张小明 + 张强(叔叔,已确认)');
  console.log('3. 授权过期拦截: 李小红 + 张英(母亲,已过期)');
  console.log('4. 重复离园: 王小强 + 王芳(已接送)');
  console.log('5. 黑名单拦截: 任意儿童 + 刘磊(黑名单)');
  console.log('6. 临时授权未确认: 李小红 + 李明(待确认)');

  return {
    children: [child1, child2, child3, child4],
    parentAuth1,
    tempAuth1
  };
}

module.exports = { initSampleData };
