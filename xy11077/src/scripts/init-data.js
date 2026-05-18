const fs = require('fs');
const path = require('path');

const RepairRecord = require('../models/RepairRecord');
const RepairTeam = require('../models/RepairTeam');

const DATA_DIR = path.join(__dirname, '../data');

const sampleTeams = [
  {
    name: '水电维修一组',
    leader: '张师傅',
    members: ['李师傅', '王师傅'],
    buildingArea: ['1号楼', '2号楼', '3号楼'],
    status: 'active'
  },
  {
    name: '水电维修二组',
    leader: '赵师傅',
    members: ['刘师傅', '陈师傅'],
    buildingArea: ['4号楼', '5号楼', '6号楼'],
    status: 'active'
  },
  {
    name: '土木维修组',
    leader: '周师傅',
    members: ['吴师傅', '郑师傅'],
    buildingArea: ['1号楼', '2号楼', '3号楼', '4号楼', '5号楼', '6号楼'],
    status: 'active'
  }
];

const sampleRecords = [
  {
    building: '3号楼',
    roomNumber: '302',
    repairType: '水电',
    description: '卫生间水龙头漏水，已持续3天，水量较大',
    reporter: '张三',
    reporterPhone: '13800138001',
    assignedTeam: '水电维修一组',
    status: 'pending',
    priority: 'high'
  },
  {
    building: '3号楼',
    roomNumber: '302',
    repairType: '水电',
    description: '宿舍日光灯闪烁，晚上看书很伤眼睛',
    reporter: '李四',
    reporterPhone: '13800138002',
    assignedTeam: '水电维修一组',
    status: 'pending',
    priority: 'medium'
  },
  {
    building: '3号楼',
    roomNumber: '302',
    repairType: '水电',
    description: '空调遥控器失灵，无法调节温度',
    reporter: '王五',
    reporterPhone: '13800138003',
    assignedTeam: '水电维修二组',
    status: 'pending',
    priority: 'medium'
  },
  {
    building: '5号楼',
    roomNumber: '518',
    repairType: '土木',
    description: '窗户边框松动，刮风时有异响',
    reporter: '赵六',
    reporterPhone: '13800138004',
    assignedTeam: '土木维修组',
    status: 'in_progress',
    priority: 'medium'
  },
  {
    building: '2号楼',
    roomNumber: '215',
    repairType: '水电',
    description: '插座接触不良，充电时断时续',
    reporter: '孙七',
    reporterPhone: '13800138005',
    assignedTeam: '水电维修一组',
    status: 'completed',
    priority: 'low',
    completedAt: new Date(Date.now() - 86400000).toISOString()
  }
];

function init() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║      校园宿舍维修队数据初始化           ║');
  console.log('╚════════════════════════════════════════╝\n');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('✓ 数据目录已创建');
  }

  const recordsPath = path.join(DATA_DIR, 'repair-records.json');
  const teamsPath = path.join(DATA_DIR, 'repair-teams.json');

  if (fs.existsSync(recordsPath)) {
    fs.unlinkSync(recordsPath);
    console.log('✓ 已清理旧的维修记录数据');
  }
  if (fs.existsSync(teamsPath)) {
    fs.unlinkSync(teamsPath);
    console.log('✓ 已清理旧的维修队伍数据');
  }

  console.log('\n正在创建维修队伍...');
  sampleTeams.forEach((team, index) => {
    const created = RepairTeam.create(team);
    console.log(`  ${index + 1}. ${created.name} - 队长: ${created.leader}`);
  });

  console.log('\n正在创建维修记录...');
  const createdRecordIds = [];
  sampleRecords.forEach((record, index) => {
    const created = RepairRecord.create(record);
    createdRecordIds.push(created.id);
    console.log(`  ${index + 1}. ${created.id} - ${created.building}${created.roomNumber} - ${created.repairType}`);
  });

  console.log('\n正在添加复核流程演示数据...');
  if (createdRecordIds.length > 0) {
    const demoRecordId = createdRecordIds[3];

    RepairRecord.addReviewLog(demoRecordId, {
      stage: 'temporary_change',
      operator: '李师傅',
      operatorRole: '维修员',
      changes: {
        original: '窗户边框松动',
        temporary: '暂时加固处理，等待材料到位'
      },
      comments: '密封胶缺货，先用胶带临时固定，已告知学生',
      confirmationSignature: 'li_ming_20240515'
    });
    console.log('  ✓ 已添加"临时改动"复核记录');

    RepairRecord.addReviewLog(demoRecordId, {
      stage: 'manager_confirm',
      operator: '周师傅',
      operatorRole: '维修队长',
      changes: {
        confirmed: true,
        materialArrivalDate: '2024-05-20'
      },
      comments: '情况属实，已批准采购计划，预计5月20日材料到位后完成最终修复',
      confirmationSignature: 'zhou_wei_20240515'
    });
    console.log('  ✓ 已添加"负责人确认"复核记录');

    RepairRecord.addReviewLog(demoRecordId, {
      stage: 'final_archive',
      operator: '管理员小王',
      operatorRole: '宿舍管理员',
      changes: {
        finalStatus: '已完成',
        actualCompletionDate: '2024-05-21'
      },
      comments: '维修已完成，学生确认无问题，归档保存',
      confirmationSignature: 'wang_admin_20240521'
    });
    console.log('  ✓ 已添加"最终归档"复核记录');
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║           数据初始化完成!               ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  维修队伍: ${sampleTeams.length} 个                       ║`);
  console.log(`║  维修记录: ${sampleRecords.length} 条                       ║`);
  console.log(`║  复核演示: 1 条记录完整三阶段流程       ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('\n提示: 第3条记录(3号楼302)被分配给了不同队伍，用于演示合并冲突验证');
}

init();
