const NORMAL = 'normal';
const PENDING = 'pendingConfirmation';
const FAILED = 'failed';

const RULES = {
  INSUFFICIENT_TRIAL_RUN: {
    code: 'INSUFFICIENT_TRIAL_RUN',
    name: '试运行不足',
    description: '缆车试运行时长或次数未达到安全标准要求',
    severity: 'high'
  },
  KEY_ITEM_UNSIGNED: {
    code: 'KEY_ITEM_UNSIGNED',
    name: '关键项未签',
    description: '检修关键项目缺少负责人签字确认',
    severity: 'critical'
  },
  OVERDUE_RELEASE: {
    code: 'OVERDUE_RELEASE',
    name: '超期放行',
    description: '设备已超过校验有效期仍被放行使用',
    severity: 'critical'
  },
  ABNORMAL_SENSOR: {
    code: 'ABNORMAL_SENSOR',
    name: '传感器数据异常',
    description: '传感器监测数据超出正常阈值范围',
    severity: 'high'
  },
  MISSING_APPROVAL: {
    code: 'MISSING_APPROVAL',
    name: '缺少审批',
    description: '记录缺少必要的审批环节',
    severity: 'medium'
  }
};

function validateRules(type, record) {
  let issues = [];
  let status = NORMAL;
  let mainFailure = null;
  let suggestion = '';

  switch (type) {
    case 'inspection':
      return validateInspection(record);
    case 'sensor':
      return validateSensor(record);
    case 'approval':
      return validateApproval(record);
    case 'manual':
      return validateManual(record);
    default:
      issues.push({
        rule: RULES.MISSING_APPROVAL,
        message: '未知记录类型',
        detail: '无法识别的记录类型，需要人工确认'
      });
      status = PENDING;
  }

  return {
    status,
    issues,
    mainFailure,
    suggestion
  };
}

function validateInspection(record) {
  const issues = [];
  let status = NORMAL;
  let mainFailure = null;
  let suggestion = '';

  const trialRunDuration = parseFloat(record.试运行时长 || record.trialRunDuration || 0);
  const trialRunCount = parseInt(record.试运行次数 || record.trialRunCount || 0);
  
  const minDuration = 30;
  const minCount = 3;
  
  if (trialRunDuration < minDuration || trialRunCount < minCount) {
    const detail = [];
    if (trialRunDuration < minDuration) {
      detail.push(`试运行时长${trialRunDuration}分钟，低于标准${minDuration}分钟`);
    }
    if (trialRunCount < minCount) {
      detail.push(`试运行次数${trialRunCount}次，低于标准${minCount}次`);
    }
    
    const issue = {
      rule: RULES.INSUFFICIENT_TRIAL_RUN,
      message: '试运行不达标',
      detail: detail.join('；'),
      readableExplanation: `⚠️ ${record.设备编号 || record.equipmentId || '未知设备'} - ${RULES.INSUFFICIENT_TRIAL_RUN.name}：${detail.join('；')}。根据《客运索道安全运营规范》，缆车检修后必须完成至少3次、累计30分钟以上的空载试运行，以确保机械系统稳定。`
    };
    
    issues.push(issue);
    status = FAILED;
    mainFailure = { ...RULES.INSUFFICIENT_TRIAL_RUN, ...issue };
    suggestion = '建议：1) 补充完成剩余试运行次数和时长；2) 每次试运行记录关键参数（速度、温度、噪音）；3) 由高级技工现场确认试运行效果后补签。';
  }

  const keyItems = ['主驱动电机', '制动系统', '钢丝绳', '控制柜'];
  const signedItems = Object.keys(record).filter(key => 
    key.includes('签字') || key.includes('签名') || key.includes('sign')
  );
  
  const hasKeySignature = keyItems.some(item => 
    Object.keys(record).some(key => 
      key.includes(item) && (record[key] === '是' || record[key] === '已检查' || record[key] === true)
    )
  ) && signedItems.length > 0;

  if (!hasKeySignature && issues.length === 0) {
    const issue = {
      rule: RULES.KEY_ITEM_UNSIGNED,
      message: '关键项缺少签字确认',
      detail: '检修单中关键安全项目缺少负责人签字',
      readableExplanation: `📝 ${record.设备编号 || record.equipmentId || '未知设备'} - ${RULES.KEY_ITEM_UNSIGNED.name}：检修单中关键安全项目（主驱动、制动、钢丝绳、电气控制）缺少负责人签字确认。这属于严重安全隐患，无签字的检修记录不具备法律效力。`
    };
    
    issues.push(issue);
    status = FAILED;
    mainFailure = { ...RULES.KEY_ITEM_UNSIGNED, ...issue };
    suggestion = '建议：1) 立即联系检修班长或技术负责人补签；2) 确认关键项目确实已完成检查；3) 如未完成，需重新执行关键项检修流程。';
  }

  return { issues, status, mainFailure, suggestion };
}

function validateSensor(record) {
  const issues = [];
  let status = NORMAL;
  let mainFailure = null;
  let suggestion = '';

  const temperature = parseFloat(record.温度 || record.temperature || 25);
  const vibration = parseFloat(record.振动 || record.vibration || 0);
  const speed = parseFloat(record.速度 || record.speed || 0);

  const abnormalParams = [];
  
  if (temperature > 60) {
    abnormalParams.push(`温度${temperature}℃（正常≤60℃）`);
  }
  if (vibration > 5.5) {
    abnormalParams.push(`振动${vibration}mm/s（正常≤5.5mm/s）`);
  }
  if (speed < 3 || speed > 6) {
    abnormalParams.push(`运行速度${speed}m/s（正常3-6m/s）`);
  }

  if (abnormalParams.length > 0) {
    const issue = {
      rule: RULES.ABNORMAL_SENSOR,
      message: '传感器数据异常',
      detail: abnormalParams.join('；'),
      readableExplanation: `🔧 ${record.设备编号 || record.equipmentId || record.sensorId || '未知传感器'} - ${RULES.ABNORMAL_SENSOR.name}：${abnormalParams.join('；')}。异常参数可能预示设备存在潜在故障风险，需立即排查。`
    };
    
    issues.push(issue);
    
    if (temperature > 75 || vibration > 8) {
      status = FAILED;
      mainFailure = { ...RULES.ABNORMAL_SENSOR, ...issue };
      suggestion = '建议：1) 立即停机检查，严禁带病运行；2) 重点检查轴承润滑和齿轮啮合情况；3) 联系设备厂商技术支持进行深度诊断。';
    } else {
      status = PENDING;
      suggestion = '建议：1) 持续监测参数变化趋势；2) 24小时内安排技术人员现场排查；3) 增加巡检频次至每2小时一次。';
    }
  }

  return { issues, status, mainFailure, suggestion };
}

function validateApproval(record) {
  const issues = [];
  let status = NORMAL;
  let mainFailure = null;
  let suggestion = '';

  const approveDate = record.审批日期 || record.approvalDate || record.date;
  const validUntil = record.有效期至 || record.validUntil;
  const approver = record.审批人 || record.approver;
  const today = new Date();

  if (validUntil) {
    const validDate = new Date(validUntil);
    const daysOverdue = Math.floor((today - validDate) / (1000 * 60 * 60 * 24));
    
    if (validDate < today) {
      const issue = {
        rule: RULES.OVERDUE_RELEASE,
        message: '设备已超期放行',
        detail: `有效期至${validUntil}，已超期${daysOverdue}天`,
        readableExplanation: `🚨 ${record.设备编号 || record.equipmentId || '未知设备'} - ${RULES.OVERDUE_RELEASE.name}：该设备审批有效期至${validUntil}，距今已超期${daysOverdue}天。超期设备属于重大安全隐患，严禁投入运营！`
      };
      
      issues.push(issue);
      status = FAILED;
      mainFailure = { ...RULES.OVERDUE_RELEASE, ...issue };
      suggestion = '建议：1) 立即停止该设备运营；2) 紧急申请重新检验审批；3) 同步报告安全管理部门备案；4) 完善有效期预警机制。';
    } else {
      const daysRemaining = Math.floor((validDate - today) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) {
        issues.push({
          rule: RULES.OVERDUE_RELEASE,
          message: '审批即将到期',
          detail: `剩余有效期${daysRemaining}天`,
          readableExplanation: `⏰ ${record.设备编号 || record.equipmentId || '未知设备'} - 审批即将到期：该设备审批有效期还剩${daysRemaining}天，请提前安排复检，避免超期运营。`
        });
        status = PENDING;
        suggestion = `建议：剩余${daysRemaining}天有效期，请尽快安排年度检修并提交审批材料。`;
      }
    }
  }

  if (!approver && issues.length === 0) {
    issues.push({
      rule: RULES.MISSING_APPROVAL,
      message: '缺少审批人信息',
      detail: '审批记录中无审批人签字信息',
      readableExplanation: `📋 审批记录缺少审批人签字信息，请确认该记录是否已完成完整审批流程。`
    });
    status = PENDING;
    suggestion = '建议：补充审批人签字信息，或确认是否已完成审批流程。';
  }

  return { issues, status, mainFailure, suggestion };
}

function validateManual(record) {
  const issues = [];
  let status = PENDING;
  let suggestion = '手动提交的数据需要人工审核确认后才能生效。';

  issues.push({
    rule: RULES.MISSING_APPROVAL,
    message: '待人工确认',
    detail: '手动提交的记录需审核',
    readableExplanation: '📋 手动提交的数据已接收，需由设备部管理人员人工审核确认后才能生效。'
  });

  return { issues, status, mainFailure: null, suggestion };
}

module.exports = {
  validateRules,
  RULES
};
