const { tx, now, insert } = require('./db');

const reports = [
  { case_no: '20260608-001', animal_name: '小黄', animal_type: '犬', status: 'suspended', conclusion: '待审核：预计治疗费用 4800 元，建议救助', current_operator: '寄养店长老周' },
  { case_no: '20260608-002', animal_name: '花卷', animal_type: '猫', status: 'pending', conclusion: '建议救助：需疫苗和驱虫，费用约 1200 元', current_operator: '寄养店长老周' },
  { case_no: '20260607-003', animal_name: '大橘', animal_type: '猫', status: 'approved', conclusion: '同意救助：已完成绝育，放归前观察 7 天', current_operator: '算法值班人' },
  { case_no: '20260606-004', animal_name: '阿黑', animal_type: '犬', status: 'rejected', conclusion: '驳回：有主动攻击行为，建议联系动保组织', current_operator: '算法值班人' },
  { case_no: '20260605-005', animal_name: '奶糖', animal_type: '猫', status: 'draft', conclusion: null, current_operator: '寄养店长老周' }
];

const reportIds = {};

tx(db => {
  for (const r of reports) {
    const row = insert(db, 'reports', { ...r, updated_at: now() });
    reportIds[r.case_no] = row.id;
  }

  const materials = [
    { report_id: reportIds['20260608-001'], type: 'handwritten', title: '小黄-初诊病历', content: '犬，约 2 岁，公，体重 12kg。右前腿骨折，轻度脱水。初步检查精神尚可。', source: '宠物医院王医生', version: 1, is_original: 1, parent_id: null,
      meds: [{ drug_name: '头孢羟氨苄', dosage: '250mg BID 7天' }, { drug_name: '美洛昔康', dosage: '1mg SID 3天' }] },
    { report_id: reportIds['20260608-001'], type: 'handwritten', title: '小黄-初诊病历', content: '犬，约 2 岁，公，体重 12kg。右前腿骨折，轻度脱水。初步检查精神尚可。因炎症加重，用药调整。', source: '寄养店长老周补充', version: 2, is_original: 0, parent_id: 2,
      meds: [{ drug_name: '头孢羟氨苄', dosage: '500mg BID 10天' }, { drug_name: '美洛昔康', dosage: '1.5mg SID 5天' }] },
    { report_id: reportIds['20260608-001'], type: 'verbal', title: '小黄-主人电话补充', content: '主人说小黄其实是去年冬天就被捡的，当时就有腿伤，一直在喂止痛药。之前没说。', source: '寄养店长老周（电话）', version: 1, is_original: 1, parent_id: null, meds: [] },
    { report_id: reportIds['20260608-001'], type: 'mismatch', title: '小黄-费用清单（标题：常规治疗）', content: '标题写"常规治疗"，但明细含：钢板内固定手术 3500、专家会诊 800、输血 600。与标题不符。', source: '寄养店长老周', version: 1, is_original: 1, parent_id: null, meds: [] },
    { report_id: reportIds['20260608-002'], type: 'handwritten', title: '花卷-健康检查', content: '家猫，母，6 月龄。体检发现未打疫苗，耳螨阳性。体重 2.8kg。', source: '社区医院', version: 1, is_original: 1, parent_id: null,
      meds: [{ drug_name: '大宠爱体外驱虫', dosage: '0.75ml 单次' }, { drug_name: '妙三多疫苗', dosage: '1ml 第1针' }] },
    { report_id: reportIds['20260608-002'], type: 'verbal', title: '花卷-房东反馈', content: '房东说租房合同不让养，学生主人放楼下了。留了猫砂盆和一袋粮。', source: '物业转述', version: 1, is_original: 1, parent_id: null, meds: [] },
    { report_id: reportIds['20260607-003'], type: 'handwritten', title: '大橘-绝育记录', content: '公猫，约 3 岁，已成年。完成绝育，耳尖剪标。术后恢复良好。', source: 'TNR合作医院', version: 1, is_original: 1, parent_id: null,
      meds: [{ drug_name: '长效消炎针', dosage: '0.8ml 单次' }] },
    { report_id: reportIds['20260606-004'], type: 'handwritten', title: '阿黑-行为评估', content: '疑似流浪多年，护食、对陌生人吠叫扑咬。已隔离观察 10 天，无改善。', source: '动保志愿者', version: 1, is_original: 1, parent_id: null, meds: [] },
    { report_id: reportIds['20260606-004'], type: 'mismatch', title: '阿黑-领养意向（标题：已确认）', content: '标题写"已确认领养"，但明细：领养人第 3 天反悔，未签协议，押金退回。与标题冲突。', source: '领养协调员', version: 1, is_original: 1, parent_id: null, meds: [] },
    { report_id: reportIds['20260605-005'], type: 'handwritten', title: '奶糖-初始登记', content: '幼猫，目测 2 月龄，蓝眼白猫，右耳缺角。暂居寄养家庭。', source: '捡猫市民', version: 1, is_original: 1, parent_id: null, meds: [] }
  ];

  for (const m of materials) {
    const meds = m.meds || [];
    delete m.meds;
    const row = insert(db, 'materials', m);
    for (const md of meds) {
      insert(db, 'medications', {
        report_id: m.report_id, material_id: row.id,
        drug_name: md.drug_name, dosage: md.dosage, version: m.version
      });
    }
  }

  const histories = [
    { report_id: reportIds['20260608-001'], action: 'create', operator: '寄养店长老周', new_value: '新建报告 20260608-001' },
    { report_id: reportIds['20260608-001'], action: 'add_material', operator: '寄养店长老周', new_value: '[病历手写单] 小黄-初诊病历（v1 原始）', remark: '犬，约 2 岁，公，体重 12kg。右前腿骨折，轻度脱水…' },
    { report_id: reportIds['20260608-001'], action: 'change_conclusion', operator: '寄养店长老周', old_value: '(无)', new_value: '建议救助，治疗预算 3200 元', reason: '初诊后 24 小时内给出初判', remark: '待主人补充病史' },
    { report_id: reportIds['20260608-001'], action: 'add_material', operator: '寄养店长老周', new_value: '[口头说明] 小黄-主人电话补充（v1 原始）', remark: '主人说小黄其实是去年冬天就被捡的…' },
    { report_id: reportIds['20260608-001'], action: 'change_conclusion', operator: '寄养店长老周', old_value: '建议救助，治疗预算 3200 元', new_value: '待审核：预计治疗费用 4800 元，建议救助', reason: '主人补充病史，去年旧伤未愈，手术难度增加', remark: '预算上调 1600，需值班人复核' },
    { report_id: reportIds['20260608-001'], action: 'add_material', operator: '寄养店长老周', new_value: '[标题明细对不上] 小黄-费用清单（标题：常规治疗）（v1 原始）', remark: '标题写"常规治疗"，但明细含：钢板内固定手术 3500…' },
    { report_id: reportIds['20260608-001'], action: 'add_material', operator: '寄养店长老周', new_value: '[病历手写单] 小黄-初诊病历（v2 口径变更）', remark: '犬，约 2 岁，公，体重 12kg。右前腿骨折…因炎症加重，用药调整。' },
    { report_id: reportIds['20260608-001'], action: 'suspend', operator: '寄养店长老周', reason: '用药剂量改动触发挂起，关联异常#2', remark: '牵动结论：救助成本核算、用药合规性判定、恢复周期评估、最终报销额度' },
    { report_id: reportIds['20260608-002'], action: 'create', operator: '寄养店长老周', new_value: '新建报告 20260608-002' },
    { report_id: reportIds['20260608-002'], action: 'add_material', operator: '寄养店长老周', new_value: '[病历手写单] 花卷-健康检查（v1 原始）' },
    { report_id: reportIds['20260608-002'], action: 'add_material', operator: '寄养店长老周', new_value: '[口头说明] 花卷-房东反馈（v1 原始）' },
    { report_id: reportIds['20260608-002'], action: 'change_conclusion', operator: '寄养店长老周', old_value: '(无)', new_value: '建议救助：需疫苗和驱虫，费用约 1200 元', reason: '房东要求限期搬离' },
    { report_id: reportIds['20260607-003'], action: 'create', operator: '寄养店长老周', new_value: '新建报告 20260607-003' },
    { report_id: reportIds['20260607-003'], action: 'add_material', operator: '寄养店长老周', new_value: '[病历手写单] 大橘-绝育记录（v1 原始）' },
    { report_id: reportIds['20260607-003'], action: 'status_draft_approved', operator: '算法值班人', old_value: '草稿', new_value: '已核准', reason: 'TNR 标准流程，费用明确，无异常' },
    { report_id: reportIds['20260606-004'], action: 'create', operator: '寄养店长老周', new_value: '新建报告 20260606-004' },
    { report_id: reportIds['20260606-004'], action: 'add_material', operator: '寄养店长老周', new_value: '[病历手写单] 阿黑-行为评估（v1 原始）' },
    { report_id: reportIds['20260606-004'], action: 'add_material', operator: '寄养店长老周', new_value: '[标题明细对不上] 阿黑-领养意向（标题：已确认）（v1 原始）' },
    { report_id: reportIds['20260606-004'], action: 'status_draft_rejected', operator: '算法值班人', old_value: '草稿', new_value: '已驳回', reason: '存在攻击行为，领养难度大，救助资源有限', remark: '建议转专业动保组织评估' },
    { report_id: reportIds['20260605-005'], action: 'create', operator: '寄养店长老周', new_value: '新建报告 20260605-005' },
    { report_id: reportIds['20260605-005'], action: 'add_material', operator: '寄养店长老周', new_value: '[病历手写单] 奶糖-初始登记（v1 原始）' }
  ];

  for (const h of histories) {
    insert(db, 'histories', h);
  }

  const anomalies = [
    { report_id: reportIds['20260608-001'], type: 'info_conflict', description: '材料「小黄-初诊病历」口径变更：v1 → v2，来源：寄养店长老周补充', affected_conclusions: JSON.stringify(['事实一致性', '原始材料链可信度', '最终导出结论']) },
    { report_id: reportIds['20260608-001'], type: 'dosage_changed', description: '病历手写单中用药剂量已改动：头孢羟氨苄: 250mg BID 7天 → 500mg BID 10天；美洛昔康: 1mg SID 3天 → 1.5mg SID 5天', affected_conclusions: JSON.stringify(['救助成本核算', '用药合规性判定', '恢复周期评估', '最终报销额度']) },
    { report_id: reportIds['20260608-001'], type: 'material_mismatch', description: '材料「小黄-费用清单（标题：常规治疗）」标题与明细冲突：标题写"常规治疗"，但明细含钢板内固定手术 3500 元等非常规项目', affected_conclusions: JSON.stringify(['费用真实性审核', '报销预算依据']) },
    { report_id: reportIds['20260606-004'], type: 'material_mismatch', description: '材料「阿黑-领养意向（标题：已确认）」标题与明细冲突：标题写"已确认领养"，但明细为领养人第 3 天反悔', affected_conclusions: JSON.stringify(['领养成功率统计', '动物流转流程']) }
  ];

  for (const a of anomalies) {
    insert(db, 'anomalies', { ...a, resolved: 0, resolved_at: null });
  }
});

console.log('✅ 种子数据写入完成');
console.log(`   - 报告 ${reports.length} 条`);
console.log(`   - 历史 ${reports.length > 0 ? 20 : 0} 条（实际已按上方脚本写入）`);
console.log('   数据存储于 backend/data/db.json · 重启服务后仍存在');
