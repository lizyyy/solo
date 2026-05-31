const { loadRecords, findRecord } = require('../utils/storage');

var SOURCE_EXPLANATIONS = {
  maintenance_order: {
    name: '维修单',
    description: '报警信息来源于维修工单系统，由维修人员在处理故障时记录',
    nextStep: '联系维修组确认维修进度',
    contact: '维修主管'
  },
  vibration_curve: {
    name: '振动曲线',
    description: '通过振动监测系统自动检测的异常',
    nextStep: '调取振动曲线进行趋势分析',
    contact: '监测分析员'
  },
  manual_report: {
    name: '人工上报',
    description: '由现场巡检人员或司机人工发现并上报',
    nextStep: '现场复核实际情况',
    contact: '当班工长'
  },
  system_auto: {
    name: '系统自动',
    description: '温度监测系统自动触发的报警',
    nextStep: '检查系统传感器校准状态',
    contact: '设备管理员'
  },
  onsite_verification: {
    name: '现场复核',
    description: '现场人员实地检查确认',
    nextStep: '',
    contact: ''
  },
  other: {
    name: '其他来源',
    description: '未明确分类的确认来源',
    nextStep: '请进一步核实来源',
    contact: '相关负责人'
  }
};

function explainAlarm(dataDir, recordId) {
  const records = loadRecords(dataDir);
  const record = findRecord(records, recordId);

  if (!record) {
    console.error('未找到记录: ' + recordId);
    process.exit(1);
  }

  console.log('=== 报警解释: ' + recordId + ' ===');
  console.log('');
  console.log('车组: ' + record.trainNo + '  车厢: ' + record.carriageNo);
  console.log('制动位置: ' + (record.brakePosition || '-'));
  console.log('温度: ' + record.temperature + '°C');
  console.log('报警级别: ' + record.alarmLevel);
  console.log('');

  if (record.alarmSource) {
    var sourceInfo = SOURCE_EXPLANATIONS[record.alarmSource] || SOURCE_EXPLANATIONS.other;
    console.log('【报警来源】');
    console.log('  类型: ' + sourceInfo.name);
    console.log('  说明: ' + sourceInfo.description);
    console.log('');
  } else {
    console.log('【报警来源】未记录');
    console.log('');
  }

  if (record.confirmSource) {
    var confirmInfo = SOURCE_EXPLANATIONS[record.confirmSource] || SOURCE_EXPLANATIONS.other;
    console.log('【确认来源】');
    console.log('  类型: ' + confirmInfo.name);
    console.log('  说明: ' + confirmInfo.description);
    console.log('');

    if (record.confirmedBy) {
      console.log('  确认人: ' + record.confirmedBy);
    }
  }

  var duplicateInfo = record.confirmSource && record.alarmSource && record.confirmSource !== record.alarmSource;

  if (duplicateInfo) {
    console.log('⚠️ 【重复确认提示】');
    console.log('  该报警已被重复确认！');
    var alarmSourceName = SOURCE_EXPLANATIONS[record.alarmSource] ? SOURCE_EXPLANATIONS[record.alarmSource].name : record.alarmSource;
    var confirmSourceName = SOURCE_EXPLANATIONS[record.confirmSource] ? SOURCE_EXPLANATIONS[record.confirmSource].name : record.confirmSource;
    console.log('  原始报警来自: ' + alarmSourceName);
    console.log('  当前确认来自: ' + confirmSourceName);
    console.log('');
    console.log('【下一步行动建议】');
    var primarySource = SOURCE_EXPLANATIONS[record.alarmSource];
    var stepNum = 1;
    if (primarySource && primarySource.nextStep) {
      console.log('  ' + stepNum + '. ' + primarySource.nextStep);
      stepNum++;
    }
    var confirmSource = SOURCE_EXPLANATIONS[record.confirmSource];
    if (confirmSource && confirmSource.nextStep && confirmSource.nextStep !== primarySource.nextStep) {
      console.log('  ' + stepNum + '. ' + confirmSource.nextStep);
      stepNum++;
    }
    console.log('  ' + stepNum + '. 协调双方确认数据一致性');
    console.log('');
    console.log('【联系人】');
    var contacts = [];
    if (primarySource && primarySource.contact) contacts.push(primarySource.contact);
    if (confirmSource && confirmSource.contact && confirmSource.contact !== primarySource.contact) {
      contacts.push(confirmSource.contact);
    }
    console.log('  ' + (contacts.join('、') || '请查询相关负责人'));
  }

  if (record.nextAction) {
    console.log('');
    console.log('【已记录的下一步】: ' + record.nextAction);
  }

  if (record.notes) {
    console.log('');
    console.log('【备注】: ' + record.notes);
  }
}

module.exports = {
  explainAlarm: explainAlarm
};
