const moment = require('moment');

const RISK_LEVELS = {
  HIGH: '高风险',
  MEDIUM: '中风险',
  LOW: '低风险'
};

const RESULT_TYPES = {
  NORMAL: '正常',
  PENDING: '待补充',
  BLOCKED: '已拦截'
};

function classifyRecord(record) {
  const {
    risk_level,
    has_checkin,
    has_leave,
    leave_approved,
    leave_start_date,
    leave_end_date,
    checkin_date,
    location_gap_hours,
    location_abnormal
  } = record;

  let resultType;
  let reason;
  let followUpAction;

  const isOnApprovedLeave = has_leave && leave_approved && 
    moment(checkin_date).isBetween(moment(leave_start_date), moment(leave_end_date), 'day', '[]');

  const checkinIssues = [];
  const leaveIssues = [];
  const locationIssues = [];

  if (!isOnApprovedLeave) {
    if (!has_checkin) {
      checkinIssues.push('无签到记录');
    }
  }

  if (has_leave) {
    if (!leave_approved) {
      leaveIssues.push('请假未批准');
    } else if (!isOnApprovedLeave) {
      leaveIssues.push('签到日期不在请假范围内');
    }
  }

  if (location_abnormal || location_gap_hours > 4) {
    locationIssues.push(`定位异常(缺口${location_gap_hours}小时)`);
  }

  const allIssues = [...checkinIssues, ...leaveIssues, ...locationIssues];
  const hasIssues = allIssues.length > 0;

  if (!hasIssues) {
    resultType = RESULT_TYPES.NORMAL;
    reason = isOnApprovedLeave 
      ? '正常请假期间，签到合规，定位正常' 
      : '签到正常，定位无异常';
    followUpAction = '无需跟进，正常记录';
  } else {
    const isHighRisk = risk_level === RISK_LEVELS.HIGH;
    const isMediumRisk = risk_level === RISK_LEVELS.MEDIUM;
    
    const hasSeriousIssue = 
      (!isOnApprovedLeave && !has_checkin) || 
      (location_gap_hours > 8) ||
      (has_leave && !leave_approved);

    if (isHighRisk && hasSeriousIssue) {
      resultType = RESULT_TYPES.BLOCKED;
      reason = `高风险对象${allIssues.join('、')}`;
      followUpAction = '立即拦截，通知司法所工作人员现场核实';
    } else if (hasSeriousIssue || (isMediumRisk && allIssues.length >= 2)) {
      resultType = RESULT_TYPES.BLOCKED;
      reason = `${risk_level}对象${allIssues.join('、')}`;
      followUpAction = '拦截预警，社工24小时内核实并提交补充材料';
    } else {
      resultType = RESULT_TYPES.PENDING;
      reason = `${risk_level}对象${allIssues.join('、')}`;
      followUpAction = '待补充材料，社工3个工作日内提交情况说明';
    }
  }

  return {
    resultType,
    reason,
    followUpAction,
    checkinStatus: isOnApprovedLeave ? '请假覆盖' : (has_checkin ? '已签到' : '未签到'),
    leaveStatus: has_leave ? (leave_approved ? '已批准' : '待审批') : '无请假',
    locationStatus: location_abnormal || location_gap_hours > 4 ? '异常' : '正常'
  };
}

function classifyBatch(records) {
  const results = records.map(record => {
    const classification = classifyRecord(record);
    return {
      ...record,
      ...classification
    };
  });

  const stats = {
    total: results.length,
    normal: results.filter(r => r.resultType === RESULT_TYPES.NORMAL).length,
    pending: results.filter(r => r.resultType === RESULT_TYPES.PENDING).length,
    blocked: results.filter(r => r.resultType === RESULT_TYPES.BLOCKED).length
  };

  return {
    results,
    stats
  };
}

module.exports = {
  classifyRecord,
  classifyBatch,
  RESULT_TYPES,
  RISK_LEVELS
};
