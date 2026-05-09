const { initDb, getDb } = require('../src/database/init');
const ticketService = require('../src/services/ticketService');
const clusterService = require('../src/services/clusterService');

const now = new Date();
const baseTime = new Date(now);

function getTime(offsetHours = 0) {
  const t = new Date(baseTime);
  t.setHours(t.getHours() + offsetHours);
  return t.toISOString();
}

const testComplaints = [
  {
    citizen_name: '张小明',
    citizen_phone: '13800138001',
    content: '我们小区自来水停水已经3天了，打电话给物业也没人管，请有关部门尽快解决！',
    area: '朝阳区',
    location: '阳光花园小区',
    category: '供水问题',
    urgency_level: 'high',
    created_at: getTime(-10)
  },
  {
    citizen_name: '李华',
    citizen_phone: '13800138002',
    content: '阳光花园这里停水好几天了，生活很不方便，什么时候能恢复供水？',
    area: '朝阳区',
    location: '阳光花园',
    category: '供水问题',
    urgency_level: 'high',
    created_at: getTime(-9)
  },
  {
    citizen_name: '王芳',
    citizen_phone: '13800138003',
    content: '我住在阳光花园，自来水一直没来，这已经是第三天停水了，请尽快处理！',
    area: '朝阳区',
    location: '阳光花园小区A栋',
    category: '供水问题',
    urgency_level: 'high',
    created_at: getTime(-8)
  },
  {
    citizen_name: '赵强',
    citizen_phone: '13800138004',
    content: '楼下小区的水管爆裂漏水严重，水流满地都是，请快派人来修！',
    area: '朝阳区',
    location: '阳光花园小区门口',
    category: '供水问题',
    urgency_level: 'urgent',
    created_at: getTime(-7)
  },
  {
    citizen_name: '孙丽',
    citizen_phone: '13800138005',
    content: '看到阳光花园门口水管爆裂了，水都流到马路上了，太浪费了！',
    area: '朝阳区',
    location: '阳光花园小区',
    category: '供水问题',
    urgency_level: 'normal',
    created_at: getTime(-6)
  },
  {
    citizen_name: '周伟',
    citizen_phone: '13800138006',
    content: '昨天晚上小区突然停电，直到今天早上都没来，冰箱里的东西都快坏了。',
    area: '海淀区',
    location: '科技园小区',
    category: '供电问题',
    urgency_level: 'high',
    created_at: getTime(-12)
  },
  {
    citizen_name: '吴敏',
    citizen_phone: '13800138007',
    content: '科技园小区停电了，已经十几个小时了，什么时候能修好？',
    area: '海淀区',
    location: '科技园小区B栋',
    category: '供电问题',
    urgency_level: 'high',
    created_at: getTime(-11)
  },
  {
    citizen_name: '郑刚',
    citizen_phone: '13800138008',
    content: '楼下邻居家装修噪音太大，从早上六点就开始钻墙，周末也不休息，没法睡觉了！',
    area: '西城区',
    location: '幸福小区',
    category: '噪音污染',
    urgency_level: 'normal',
    created_at: getTime(-5)
  },
  {
    citizen_name: '钱娟',
    citizen_phone: '13800138009',
    content: '幸福小区3栋有人装修噪音扰民，实在受不了了，请帮忙协调一下。',
    area: '西城区',
    location: '幸福小区3栋',
    category: '噪音污染',
    urgency_level: 'normal',
    created_at: getTime(-4)
  },
  {
    citizen_name: '冯军',
    citizen_phone: '13800138010',
    content: '我们小区物业乱收费，停车费涨了一倍，也不给个说法，请问应该找谁投诉？',
    area: '东城区',
    location: '和平小区',
    category: '物业问题',
    urgency_level: 'normal',
    created_at: getTime(-3)
  },
  {
    citizen_name: '陈红',
    citizen_phone: '13800138011',
    content: '和平小区物业费太贵了，服务还不好，希望有关部门能管管。',
    area: '东城区',
    location: '和平小区',
    category: '物业问题',
    urgency_level: 'normal',
    created_at: getTime(-2)
  },
  {
    citizen_name: '杨磊',
    citizen_phone: '13800138012',
    content: '学校门口的交通实在太堵了，每天接送孩子都要花一个小时，有没有办法改善？',
    area: '丰台区',
    location: '实验小学门口',
    category: '交通拥堵',
    urgency_level: 'normal',
    created_at: getTime(-1)
  },
  {
    citizen_name: '许娜',
    citizen_phone: '13800138013',
    content: '实验小学门前每天上下学时间都堵车，车辆乱停乱放，存在安全隐患。',
    area: '丰台区',
    location: '实验小学',
    category: '交通问题',
    urgency_level: 'normal',
    created_at: getTime(0)
  }
];

function main() {
  console.log('=== 初始化测试数据 ===');
  console.log('');
  
  initDb();
  const db = getDb();
  
  db.prepare('DELETE FROM replies').run();
  db.prepare('DELETE FROM supervision_records').run();
  db.prepare('DELETE FROM ticket_merges').run();
  db.prepare('DELETE FROM tickets').run();
  db.prepare('DELETE FROM cluster_members').run();
  db.prepare('DELETE FROM clusters').run();
  db.prepare('DELETE FROM complaints').run();
  db.prepare('DELETE FROM history_logs').run();
  
  console.log('已清理旧数据');
  
  console.log(`正在录入 ${testComplaints.length} 条测试投诉...`);
  
  for (const data of testComplaints) {
    ticketService.createComplaint(data);
  }
  
  console.log('✓ 测试投诉录入完成');
  console.log('');
  
  console.log('正在执行聚类分析...');
  const clusterResult = clusterService.runClustering({
    timeWindowHours: 48,
    similarityThreshold: 0.25,
    forceRerun: true
  });
  
  console.log(`✓ 聚类完成: 新建 ${clusterResult.newClusters} 个聚类`);
  console.log('');
  
  const clusters = clusterService.getClustersWithDetails({ includeMembers: true });
  
  console.log('=== 聚类结果统计 ===');
  console.log('');
  
  for (const cluster of clusters) {
    console.log(`聚类 #${cluster.id}: ${cluster.title}`);
    console.log(`  关键词: ${cluster.primary_keyword || '无'}`);
    console.log(`  投诉数量: ${cluster.member_count}`);
    console.log(`  投诉人:`);
    for (const member of cluster.members) {
      console.log(`    - ${member.citizen_name}: ${member.content.substring(0, 30)}...`);
    }
    console.log('');
  }
  
  console.log('');
  console.log('=== 测试数据初始化完成 ===');
  console.log('');
  console.log('下一步操作:');
  console.log('1. 启动服务: npm start');
  console.log('2. 查看统计: curl http://localhost:3000/api/statistics');
  console.log('3. 执行功能测试: npm test');
}

main();
