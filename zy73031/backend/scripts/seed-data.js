const initDatabase = require('./init-db');
const { runDetection } = require('../services/anomaly-detector');
const { getDatabase } = require('../config/database');

async function main() {
  const db = await initDatabase();

  const now = new Date();
  const d = (offset) => {
    const t = new Date(now.getTime() - offset * 86400000);
    return t.toISOString().slice(0, 10);
  };

  const medicalRecords = [
    ['MR202605001', '豆豆', '张三', '13800000001', '犬', '金毛', '公', '3岁', '25.6kg', d(35), '精神不振食欲差', '肠胃炎', '5.20复诊，输液3天 体重25kg'],
    ['MR202605002', '小白', '李四', '13800000002', '猫', '英短', '母', '2岁', '4500g', d(32), '排尿困难', '下泌尿系统疾病', '6kg处方粮一周后复查'],
    ['MR202605003', '旺财', '王五', '13800000003', '犬', '拉布拉多', '公', '4岁', '30.5 公斤', d(30), '髋关节不适', '髋关节发育不良', '体重登记处手写：30500g'],
    ['MR202605004', '咪咪', '赵六', '13800000004', '猫', '布偶', '母', '1岁', '3.2', d(28), '疫苗接种', '常规免疫', '无异常'],
    ['MR202605005', '大黑', '钱七', '13800000005', '犬', '边牧', '公', '5岁', '50000克', d(25), '行为纠正咨询', '焦虑症评估', '训练科转介，注意体重单位标注为g但量级存疑'],
    ['MR202605006', '奶茶', '孙八', '13800000006', '猫', '美短', '公', '3岁', '5.2 lb', d(22), '体检', '年度体检', '12磅 驱虫'],
    ['MR202605007', '布丁', '周九', '13800000007', '犬', '泰迪', '母', '6岁', '10斤', d(20), '皮肤瘙痒', '过敏性皮炎', '药浴治疗 5kg体重用药'],
    ['MR202605008', '可乐', '吴十', '13800000008', '犬', '柯基', '公', '2岁', '2500g', d(18), '训练课前置评估', '服从性训练评估', '0.08kg 疑似单位误写'],
    ['MR202605009', '薯条', '郑十一', '13800000009', '猫', '橘猫', '公', '4岁', '6.8kg', d(15), '体重管理咨询', '肥胖症', '减重计划，目标5.5kg'],
    ['MR202605010', '蛋挞', '冯十二', '13800000010', '犬', '比熊', '母', '3岁', '4.3 kg 另注4300g', d(12), '行为训练跟进', '召回训练', '多个单位标注，训练记录待补全结论']
  ];

  const insertMR = db.prepare(`
    INSERT INTO medical_records
      (record_no, pet_name, owner_name, owner_phone, pet_type, pet_breed, pet_gender, pet_age,
       weight, visit_date, chief_complaint, diagnosis, handwritten_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const mrIds = {};
  for (const r of medicalRecords) {
    const info = insertMR.run(...r);
    mrIds[r[0]] = info.lastInsertRowid;
  }

  const trainingCourses = [
    ['TC202605001', 'MR202605003', '髋关节康复训练-第1次', '陈教练', d(29), '水下跑步机15分钟', '配合度良好', '每日家中慢走5分钟', '下周复诊评估', '康复进展符合预期，可续课', '2026-05-07训练'],
    ['TC202605002', 'MR202605005', '焦虑脱敏训练-第1次', '林教练', d(24), '噪声环境暴露训练', '中度应激反应', '提供舒缓音频', '3天后复训', '待确认适应情况？', '训练后回访未完成'],
    ['TC202605003', 'MR202605008', '服从性基础训练-第2次', '黄教练', d(17), '坐、卧、等待口令练习', '进步明显', '每日练习10分钟', '下周进行第3次', '已掌握基础指令', ''],
    ['TC202605004', 'MR202605009', '减重运动训练-第1次', '陈教练', d(14), '有氧互动训练20分钟', '耐力较差', '控制饮食配合', '每周2次', '待查心率恢复情况', ''],
    ['TC202605005', 'MR202605010', '召回强化训练-第1次', '林教练', d(11), '长绳召回练习', '分心时表现差', '使用高奖励零食', '3天后复训', '', '结论空白，需前台补充'],
    ['TC202605006', null, '敏捷性入门体验课', '黄教练', d(10), '基础障碍通过训练', '兴趣较高', '熟悉器材', '下周正式评估', '体验课满意度待确认', '未关联病历，直接报名体验课'],
    ['TC202605007', 'MR202605008', '服从性基础训练-第3次', '黄教练', d(7), '户外干扰下练习', '部分完成', '增加户外训练', '本周补训1次', '需补训练视频佐证', ''],
    ['TC202605008', 'MR202605001', '肠胃炎康复后体能恢复训练', '陈教练', d(5), '低强度散步+互动', '精神恢复良好', '循序渐进增加活动量', '2周后评估', '状态恢复好，已停止用药', '回访已确认主人反馈良好']
  ];

  const insertTC = db.prepare(`
    INSERT INTO training_courses
      (course_no, medical_record_id, course_name, trainer, course_date, course_content,
       pet_response, home_work, next_plan, conclusion, handwritten_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of trainingCourses) {
    const mrId = c[1] ? mrIds[c[1]] : null;
    insertTC.run(c[0], mrId, c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10]);
  }

  const result = await runDetection(true);
  console.log(`种子数据导入完成：病历${medicalRecords.length}条，训练课${trainingCourses.length}条`);
  console.log(`异常检测完成：共发现${result.count}条异常记录`);
  console.log(`算法版本: ${result.algorithm_version}，口径版本: ${result.caliber_version}`);
}

main().catch(e => { console.error(e); process.exit(1); });
