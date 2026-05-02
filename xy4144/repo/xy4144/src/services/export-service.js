const { Parser } = require('json2csv');
const planStateMachine = require('./plan-state-machine');
const topologyService = require('./topology-service');
const resourceService = require('./resource-service');
const auditService = require('./audit-service');
const moment = require('moment');

/**
 * 导出服务
 * 支持导出 Markdown、CSV、JSON 格式的排班审计包
 */

/**
 * 导出为 JSON 格式
 */
function exportToJSON(options = {}) {
  const {
    status,
    line_id,
    start_time_from,
    start_time_to,
    include_versions = false,
    include_audit = false
  } = options;
  
  // 获取计划列表
  const plans = planStateMachine.getPlans({
    status,
    line_id,
    start_time_from,
    start_time_to,
    limit: 10000
  });
  
  // 获取相关数据
  const lines = topologyService.getAllLines();
  const teams = resourceService.getAllTeams(false);
  const commands = resourceService.getAllDispatchCommands(false);
  
  const result = {
    export_time: new Date().toISOString(),
    export_type: 'blockade_audit_package',
    version: '1.0.0',
    summary: {
      total_plans: plans.length,
      by_status: groupByStatus(plans),
      by_line: groupByLine(plans)
    },
    plans: plans,
    references: {
      lines: lines,
      construction_teams: teams,
      dispatch_commands: commands
    }
  };
  
  // 包含版本历史
  if (include_versions) {
    result.plan_versions = {};
    for (const plan of plans) {
      const versions = planStateMachine.getPlanVersions(plan.id);
      result.plan_versions[plan.id] = versions;
    }
  }
  
  // 包含审计日志
  if (include_audit) {
    result.audit_logs = auditService.getAuditLogs({
      entityType: 'PLAN',
      limit: 10000
    });
  }
  
  return result;
}

/**
 * 导出为 CSV 格式
 */
function exportToCSV(options = {}) {
  const data = exportToJSON(options);
  
  // 转换计划数据为扁平格式
  const flatPlans = data.plans.map(plan => ({
    计划ID: plan.id,
    计划编号: plan.plan_number,
    线路ID: plan.line_id,
    工作类型: plan.work_type,
    工作内容: plan.work_content || '',
    施工队ID: plan.construction_team_id || '',
    优先级: plan.priority,
    是否紧急: plan.is_emergency ? '是' : '否',
    状态: translateStatus(plan.status),
    开始时间: plan.start_time,
    结束时间: plan.end_time,
    持续时间(分钟): calculateDuration(plan.start_time, plan.end_time),
    首班车时间: plan.first_train_time || '',
    撤场时间: plan.clearance_time || '',
    是否需要停电: plan.power_off_required ? '是' : '否',
    接触网分区: (plan.catenary_zone_ids || []).join(','),
    区间: (plan.section_ids || []).join(','),
    车站: (plan.station_ids || []).join(','),
    调度命令ID: plan.dispatch_command_id || '',
    申请人ID: plan.applicant_id || '',
    申请人姓名: plan.applicant_name || '',
    审批人ID: plan.approver_id || '',
    审批人姓名: plan.approver_name || '',
    审批时间: plan.approved_at || '',
    提交时间: plan.submitted_at || '',
    撤销时间: plan.cancelled_at || '',
    撤销原因: plan.cancelled_reason || '',
    备注: plan.notes || '',
    版本: plan.version,
    创建时间: plan.created_at,
    更新时间: plan.updated_at
  }));
  
  if (flatPlans.length === 0) {
    return '';
  }
  
  const fields = Object.keys(flatPlans[0]);
  const parser = new Parser({ fields });
  return parser.parse(flatPlans);
}

/**
 * 导出为 Markdown 格式（排班审计包）
 */
function exportToMarkdown(options = {}) {
  const data = exportToJSON(options);
  
  const lines = [];
  
  // 标题
  lines.push('# 封锁点施工排班审计包');
  lines.push('');
  lines.push(`> 导出时间: ${data.export_time}`);
  lines.push(`> 版本: ${data.version}`);
  lines.push('');
  
  // 统计概览
  lines.push('## 统计概览');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总计划数 | ${data.summary.total_plans} |`);
  lines.push('');
  
  // 按状态统计
  lines.push('### 按状态分布');
  lines.push('');
  lines.push('| 状态 | 数量 |');
  lines.push('|------|------|');
  for (const [status, count] of Object.entries(data.summary.by_status)) {
    lines.push(`| ${translateStatus(status)} | ${count} |`);
  }
  lines.push('');
  
  // 按线路统计
  if (Object.keys(data.summary.by_line).length > 0) {
    lines.push('### 按线路分布');
    lines.push('');
    lines.push('| 线路 | 数量 |');
    lines.push('|------|------|');
    for (const [lineId, count] of Object.entries(data.summary.by_line)) {
      const line = data.references.lines.find(l => l.id === lineId);
      const lineName = line?.name || lineId;
      lines.push(`| ${lineName} | ${count} |`);
    }
    lines.push('');
  }
  
  // 计划详情
  lines.push('## 计划详情');
  lines.push('');
  
  for (const plan of data.plans) {
    const line = data.references.lines.find(l => l.id === plan.line_id);
    const team = data.references.construction_teams.find(t => t.id === plan.construction_team_id);
    const command = data.references.dispatch_commands.find(c => c.id === plan.dispatch_command_id);
    
    lines.push(`### ${plan.plan_number}`);
    lines.push('');
    lines.push(`**状态**: ${translateStatus(plan.status)}`);
    lines.push(`**工作类型**: ${plan.work_type}`);
    lines.push(`**优先级**: ${plan.priority} ${plan.is_emergency ? '(紧急)' : ''}`);
    lines.push('');
    lines.push('#### 时间信息');
    lines.push('');
    lines.push(`- **开始时间**: ${plan.start_time}`);
    lines.push(`- **结束时间**: ${plan.end_time}`);
    lines.push(`- **持续时间**: ${calculateDuration(plan.start_time, plan.end_time)} 分钟`);
    if (plan.first_train_time) {
      lines.push(`- **首班车时间**: ${plan.first_train_time}`);
      const buffer = calculateBuffer(plan.end_time, plan.first_train_time);
      lines.push(`- **撤场缓冲**: ${buffer} 分钟`);
    }
    lines.push('');
    
    lines.push('#### 资源信息');
    lines.push('');
    lines.push(`- **线路**: ${line?.name || plan.line_id}`);
    lines.push(`- **区间**: ${(plan.section_ids || []).join(', ')}`);
    if (plan.station_ids && plan.station_ids.length > 0) {
      lines.push(`- **涉及车站**: ${(plan.station_ids || []).join(', ')}`);
    }
    if (team) {
      lines.push(`- **施工队**: ${team.name} (队长: ${team.leader_name || '-'})`);
    }
    if (command) {
      lines.push(`- **调度命令**: ${command.code} - ${command.name}`);
    }
    lines.push('');
    
    if (plan.power_off_required) {
      lines.push('#### 停电信息');
      lines.push('');
      lines.push(`- **接触网分区**: ${(plan.catenary_zone_ids || []).join(', ')}`);
      lines.push('');
    }
    
    if (plan.work_content) {
      lines.push('#### 工作内容');
      lines.push('');
      lines.push(plan.work_content);
      lines.push('');
    }
    
    if (plan.applicant_name || plan.approver_name) {
      lines.push('#### 审批信息');
      lines.push('');
      if (plan.applicant_name) {
        lines.push(`- **申请人**: ${plan.applicant_name}`);
      }
      if (plan.submitted_at) {
        lines.push(`- **提交时间**: ${plan.submitted_at}`);
      }
      if (plan.approver_name) {
        lines.push(`- **审批人**: ${plan.approver_name}`);
      }
      if (plan.approved_at) {
        lines.push(`- **审批时间**: ${plan.approved_at}`);
      }
      if (plan.cancelled_at) {
        lines.push(`- **撤销时间**: ${plan.cancelled_at}`);
        if (plan.cancelled_reason) {
          lines.push(`- **撤销原因**: ${plan.cancelled_reason}`);
        }
      }
      lines.push('');
    }
    
    if (plan.notes) {
      lines.push('#### 备注');
      lines.push('');
      lines.push(plan.notes);
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }
  
  // 参考数据
  if (options.include_references !== false) {
    lines.push('## 参考数据');
    lines.push('');
    
    if (data.references.lines.length > 0) {
      lines.push('### 线路信息');
      lines.push('');
      lines.push('| ID | 名称 | 颜色 | 描述 |');
      lines.push('|----|------|------|------|');
      for (const line of data.references.lines) {
        lines.push(`| ${line.id} | ${line.name} | ${line.color || '-'} | ${line.description || '-'} |`);
      }
      lines.push('');
    }
    
    if (data.references.construction_teams.length > 0) {
      lines.push('### 施工队信息');
      lines.push('');
      lines.push('| ID | 名称 | 队长 | 人数 | 专长 |');
      lines.push('|----|------|------|------|------|');
      for (const team of data.references.construction_teams) {
        lines.push(`| ${team.id} | ${team.name} | ${team.leader_name || '-'} | ${team.team_size || '-'} | ${team.specialization || '-'} |`);
      }
      lines.push('');
    }
    
    if (data.references.dispatch_commands.length > 0) {
      lines.push('### 调度命令');
      lines.push('');
      lines.push('| ID | 代码 | 名称 | 类型 |');
      lines.push('|----|------|------|------|');
      for (const cmd of data.references.dispatch_commands) {
        lines.push(`| ${cmd.id} | ${cmd.code} | ${cmd.name} | ${cmd.command_type || '-'} |`);
      }
      lines.push('');
    }
  }
  
  // 页脚
  lines.push('---');
  lines.push('');
  lines.push('> 本报告由封锁点施工冲突审校站自动生成');
  
  return lines.join('\n');
}

/**
 * 导出排班审计包（包含所有格式）
 */
function exportAuditPackage(options = {}) {
  return {
    export_time: new Date().toISOString(),
    package_name: `audit-package-${moment().format('YYYYMMDD-HHmmss')}`,
    formats: {
      json: exportToJSON(options),
      csv: exportToCSV(options),
      markdown: exportToMarkdown(options)
    },
    query_options: options
  };
}

// ==================== 辅助函数 ====================

function groupByStatus(plans) {
  const groups = {};
  for (const plan of plans) {
    groups[plan.status] = (groups[plan.status] || 0) + 1;
  }
  return groups;
}

function groupByLine(plans) {
  const groups = {};
  for (const plan of plans) {
    groups[plan.line_id] = (groups[plan.line_id] || 0) + 1;
  }
  return groups;
}

function translateStatus(status) {
  const statusMap = {
    'draft': '草稿',
    'submitted': '已提交',
    'approved': '已审批',
    'emergency_approved': '紧急审批通过',
    'rejected': '已拒绝',
    'cancelled': '已撤销',
    'executing': '执行中',
    'completed': '已完成'
  };
  return statusMap[status] || status;
}

function calculateDuration(start, end) {
  if (!start || !end) return 0;
  return moment(end).diff(moment(start), 'minutes');
}

function calculateBuffer(endTime, firstTrainTime) {
  if (!endTime || !firstTrainTime) return 0;
  return moment(firstTrainTime).diff(moment(endTime), 'minutes');
}

module.exports = {
  exportToJSON,
  exportToCSV,
  exportToMarkdown,
  exportAuditPackage
};
