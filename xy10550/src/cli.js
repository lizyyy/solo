#!/usr/bin/env node
'use strict';

const utils = require('./utils');
const storage = require('./storage');
const models = require('./models');
const engine = require('./engine');
const sampleData = require('./sample-data');

const COMMANDS = ['init', 'import', 'check', 'detail', 'report', 'history', 'lock', 'unlock', 'status', 'help'];

function printHelp() {
  console.log(`
客服排班公平性 CLI (csp)

用法:
  csp <command> [options]

命令:
  init              初始化工作目录
    --sample        使用内置样例数据（售前/售后/投诉技能组）
    --bad-sample    使用有问题的样例数据（用于演示失败路径）
    --month YYYY-MM 指定目标月份（默认下月）
    --operator NAME 操作者标识（默认 system）

  import            导入数据
    --category NAME 类别: agents|skills|holidays|leaves|schedules|locks
    --file PATH     JSON 文件路径
    --replace       替换现有数据（默认追加）
    --operator NAME 操作者标识

  check             检查排班公平性和冲突
    --json          输出 JSON 格式
    --brief         简要输出

  detail            查看详细信息
    --agent ID      查看某客服详情
    --skill ID      查看某技能组详情
    --conflict IDX  查看某冲突详情（索引，从 0 开始）
    --suggestion IDX 查看某建议详情

  report            生成完整报告
    --json          输出 JSON 格式
    --file PATH     保存到文件

  history           查看操作历史
    --type TYPE     历史类型: init|import|check|agents_update|schedules_update 等
    --limit N       显示条数（默认 10）

  lock              锁定班次（人工调整保护）
    --agent ID      客服 ID
    --date YYYY-MM-DD
    --shift TYPE    morning|afternoon|night
    --reason TEXT   原因
    --operator NAME 操作者

  unlock            解锁班次
    --agent ID
    --date YYYY-MM-DD
    --shift TYPE
    --operator NAME

  status            显示当前状态
    --json          JSON 格式

  help              显示此帮助

示例:
  # 初始化并加载好样例
  csp init --sample

  # 初始化并加载有问题的样例（演示失败路径）
  csp init --bad-sample

  # 检查排班
  csp check

  # 生成报告
  csp report

  # 查看特定客服详情
  csp detail --agent agent-zhang

  # 查看历史
  csp history --type import
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

function cmdInit(args) {
  if (storage.isInitialized()) {
    utils.logWarn('工作目录已初始化。如需重新初始化，请先删除 data/ 目录。');
    process.exit(1);
  }
  
  const operator = args.operator || 'system';
  const month = args.month || null;
  
  utils.logInfo(`初始化工作目录，目标月份: ${month || '自动检测'}`);
  
  const config = storage.initializeConfig({ targetMonth: month });
  utils.logSuccess(`配置已创建，目标月份: ${config.targetMonth}`);
  
  if (args.sample || args['bad-sample']) {
    const generator = args['bad-sample'] 
      ? sampleData.generateBadSampleData 
      : sampleData.generateSampleData;
    
    const data = generator(month);
    
    if (month && data.targetMonth !== month) {
      storage.updateConfig({ targetMonth: data.targetMonth });
    }
    
    storage.saveSkills(data.skills, operator, 'init_sample');
    utils.logSuccess(`已导入 ${data.skills.length} 个技能组`);
    
    storage.saveAgents(data.agents, operator, 'init_sample');
    utils.logSuccess(`已导入 ${data.agents.length} 个客服`);
    
    storage.saveHolidays(data.holidays, operator, 'init_sample');
    utils.logSuccess(`已导入 ${data.holidays.length} 个节假日`);
    
    storage.saveLeaves(data.leaves, operator, 'init_sample');
    utils.logSuccess(`已导入 ${data.leaves.length} 条请假记录`);
    
    storage.saveSchedules(data.schedules, operator, 'init_sample');
    utils.logSuccess(`已导入 ${data.schedules.length} 条排班记录`);
    
    storage.saveLocks(data.locks, operator, 'init_sample');
    utils.logSuccess(`已导入 ${data.locks.length} 个锁定班次`);
    
    if (args['bad-sample']) {
      utils.logWarn('已加载「有问题的样例数据」，用于演示冲突检测和失败路径');
    } else {
      utils.logSuccess('已加载「标准样例数据」，包含售前/售后/投诉三个技能组');
    }
  }
  
  utils.logInfo(`数据目录: ${storage.getDataDir()}`);
  utils.logSuccess('初始化完成。运行 `csp check` 检查排班。');
}

function cmdImport(args) {
  if (!storage.isInitialized()) {
    utils.logError('工作目录未初始化，请先运行 `csp init`');
    process.exit(1);
  }
  
  const category = args.category;
  const file = args.file;
  const replace = args.replace === true;
  const operator = args.operator || 'system';
  
  const validCategories = ['agents', 'skills', 'holidays', 'leaves', 'schedules', 'locks'];
  if (!category || !validCategories.includes(category)) {
    utils.logError(`必须指定 --category，有效值: ${validCategories.join(', ')}`);
    process.exit(1);
  }
  
  let records;
  if (file) {
    try {
      records = utils.readJSON(file, null);
      if (!records) {
        utils.logError(`无法读取文件: ${file}`);
        process.exit(1);
      }
      if (!Array.isArray(records)) {
        records = records[category] || records.records || records.data || records;
        if (!Array.isArray(records)) {
          utils.logError('文件格式错误，需要是数组或包含数组的对象');
          process.exit(1);
        }
      }
    } catch (e) {
      utils.logError(`读取文件失败: ${e.message}`);
      process.exit(1);
    }
  } else {
    utils.logError('必须指定 --file 参数');
    process.exit(1);
  }
  
  const validators = {
    agents: models.validateAgent,
    skills: models.validateSkill,
    holidays: models.validateHoliday,
    leaves: models.validateLeave,
    schedules: models.validateSchedule,
    locks: models.validateLock
  };
  
  const normalizers = {
    agents: models.normalizeAgent,
    skills: models.normalizeSkill,
    holidays: models.normalizeHoliday,
    leaves: models.normalizeLeave,
    schedules: models.normalizeSchedule,
    locks: models.normalizeLock
  };
  
  const validate = validators[category];
  const normalize = normalizers[category];
  
  let validCount = 0;
  let invalidCount = 0;
  const errors = [];
  
  const normalizedRecords = records.map((r, i) => {
    const normalized = normalize(r);
    const result = validate(normalized);
    if (result.valid) {
      validCount++;
    } else {
      invalidCount++;
      errors.push({ index: i, errors: result.errors });
    }
    return normalized;
  });
  
  utils.logInfo(`数据校验: ${validCount} 有效, ${invalidCount} 无效`);
  
  if (invalidCount > 0) {
    utils.logError('数据校验失败，导入中止');
    for (const err of errors.slice(0, 5)) {
      utils.logError(`  记录 #${err.index}: ${err.errors.join('; ')}`);
    }
    if (errors.length > 5) {
      utils.logError(`  ... 还有 ${errors.length - 5} 条错误`);
    }
    process.exit(1);
  }
  
  const result = storage.importData(category, normalizedRecords, operator, replace);
  
  utils.logSuccess(`导入成功: 总计 ${result.total} 条，新增 ${result.added} 条${replace ? `，替换 ${result.replaced} 条` : ''}`);
  
  const state = storage.getState();
  if (state && state.checkHistory) {
    utils.logInfo(`上次检查时间: ${state.checkHistory[0]?.timestamp || '从未检查'}`);
  }
}

function cmdCheck(args) {
  if (!storage.isInitialized()) {
    utils.logError('工作目录未初始化，请先运行 `csp init`');
    process.exit(1);
  }
  
  const config = storage.getConfig();
  const agents = storage.getAgents();
  const skills = storage.getSkills();
  const holidays = storage.getHolidays();
  const leaves = storage.getLeaves();
  const schedules = storage.getSchedules();
  const locks = storage.getLocks();
  
  utils.logInfo(`开始检查: 目标月份 ${config.targetMonth}`);
  utils.logInfo(`数据: ${agents.length} 客服, ${skills.length} 技能, ${schedules.length} 排班`);
  
  const conflicts = engine.runAllChecks(config, schedules, agents, skills, holidays, leaves, locks);
  const fairness = engine.calculateFairnessScore(config, schedules, agents, skills, holidays, leaves, conflicts);
  
  const state = storage.getState();
  if (state) {
    state.checkHistory = state.checkHistory || [];
    state.checkHistory.unshift({
      timestamp: new Date().toISOString(),
      conflictCount: conflicts.length,
      fairnessScore: fairness.score,
      fairnessLevel: fairness.level
    });
    state.checkHistory = state.checkHistory.slice(0, 50);
    storage.updateState(state);
  }
  
  storage.recordHistory('check', {
    conflictCount: conflicts.length,
    fairnessScore: fairness.score,
    fairnessLevel: fairness.level,
    conflictSummary: fairness.conflictSummary
  });
  
  if (args.json) {
    console.log(JSON.stringify({
      fairness,
      conflicts,
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
  }
  
  const levelColors = {
    excellent: '优秀',
    good: '良好',
    fair: '一般',
    poor: '较差'
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('                    排班检查结果');
  console.log('='.repeat(60));
  
  console.log(`\n【公平性评分】 ${fairness.score} 分 (${levelColors[fairness.level] || fairness.level})`);
  console.log(`  总计: ${fairness.totalSchedules} 条排班, ${fairness.totalAgents} 个客服`);
  
  if (fairness.conflictSummary.critical > 0) {
    utils.logError(`  严重冲突: ${fairness.conflictSummary.critical}`);
  }
  if (fairness.conflictSummary.high > 0) {
    utils.logWarn(`  高优先级冲突: ${fairness.conflictSummary.high}`);
  }
  if (fairness.conflictSummary.medium > 0) {
    utils.logWarn(`  中优先级冲突: ${fairness.conflictSummary.medium}`);
  }
  if (fairness.conflictSummary.low > 0) {
    utils.logInfo(`  低优先级提示: ${fairness.conflictSummary.low}`);
  }
  
  if (conflicts.length > 0) {
    console.log('\n【冲突列表】');
    
    const typeLabels = {
      leave_conflict: '请假冲突',
      lock_violation: '锁定班次违规',
      consecutive_night_shifts: '连续夜班',
      skill_gap: '技能组空档',
      night_shift_over_limit: '夜班超限',
      consecutive_work_days: '连续工作超限',
      night_shift_uneven: '夜班不均',
      holiday_uneven: '节假日不均'
    };
    
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedConflicts = [...conflicts].sort((a, b) => 
      severityOrder[a.severity] - severityOrder[b.severity]
    );
    
    if (args.brief) {
      const grouped = {};
      for (const c of sortedConflicts) {
        const key = `${c.type}-${c.severity}`;
        if (!grouped[key]) grouped[key] = { count: 0, example: c };
        grouped[key].count++;
      }
      
      for (const [key, g] of Object.entries(grouped)) {
        const label = typeLabels[g.example.type] || g.example.type;
        console.log(`  [${g.example.severity.toUpperCase()}] ${label}: ${g.count} 个`);
      }
    } else {
      const rows = sortedConflicts.slice(0, 20).map((c, i) => {
        const label = typeLabels[c.type] || c.type;
        const target = c.agentId || c.skillName || '-';
        const date = c.date || (c.dates ? c.dates.join(',') : '-');
        return [i, c.severity.toUpperCase(), label, target, date, c.message.slice(0, 40)];
      });
      
      utils.printTable(
        ['#', '级别', '类型', '对象', '日期', '说明'],
        rows
      );
      
      if (sortedConflicts.length > 20) {
        console.log(`... 还有 ${sortedConflicts.length - 20} 个冲突，使用 --json 查看全部`);
      }
    }
    
    console.log('\n【提示】运行 `csp detail --conflict <索引>` 查看冲突详情');
    console.log('【提示】运行 `csp report` 查看完整报告和换班建议');
  } else {
    utils.logSuccess('未发现冲突！');
  }
  
  if (fairness.score >= 90) {
    console.log('\n✅ 排班质量良好，可以发布。');
  } else if (fairness.score >= 70) {
    console.log('\n⚠️  排班存在一些问题，建议查看报告并调整。');
  } else {
    console.log('\n❌ 排班存在严重问题，必须调整后才能发布。');
    process.exitCode = 1;
  }
}

function cmdDetail(args) {
  if (!storage.isInitialized()) {
    utils.logError('工作目录未初始化，请先运行 `csp init`');
    process.exit(1);
  }
  
  const config = storage.getConfig();
  const agents = storage.getAgents();
  const skills = storage.getSkills();
  const holidays = storage.getHolidays();
  const leaves = storage.getLeaves();
  const schedules = storage.getSchedules();
  const locks = storage.getLocks();
  
  if (args.agent) {
    const agent = agents.find(a => a.id === args.agent);
    if (!agent) {
      utils.logError(`未找到客服: ${args.agent}`);
      process.exit(1);
    }
    
    const agentSchedules = schedules.filter(s => s.agentId === agent.id);
    const nightShifts = agentSchedules.filter(s => engine.isNightShift(s.shiftType, config)).length;
    const agentLeaves = leaves.filter(l => l.agentId === agent.id);
    const agentLocks = locks.filter(l => l.agentId === agent.id);
    
    const conflicts = engine.runAllChecks(config, schedules, agents, skills, holidays, leaves, locks);
    const agentConflicts = conflicts.filter(c => c.agentId === agent.id);
    
    console.log(`\n【客服详情】 ${agent.name} (${agent.id})`);
    console.log(`  状态: ${agent.status}`);
    console.log(`  技能: ${agent.skills?.join(', ') || '无'}`);
    console.log(`\n  排班统计:`);
    console.log(`    总班次: ${agentSchedules.length}`);
    console.log(`    夜班数: ${nightShifts}`);
    console.log(`    请假记录: ${agentLeaves.length} 条`);
    console.log(`    锁定班次: ${agentLocks.length} 个`);
    console.log(`    涉及冲突: ${agentConflicts.length} 个`);
    
    if (agentSchedules.length > 0) {
      console.log(`\n  最近 10 条排班:`);
      const sorted = [...agentSchedules].sort((a, b) => 
        utils.parseDate(b.date) - utils.parseDate(a.date)
      ).slice(0, 10);
      
      for (const s of sorted) {
        const isNight = engine.isNightShift(s.shiftType, config) ? ' [夜]' : '';
        console.log(`    ${s.date} ${s.shiftType}${isNight}`);
      }
    }
    
    if (agentLeaves.length > 0) {
      console.log(`\n  请假记录:`);
      for (const l of agentLeaves) {
        console.log(`    ${l.startDate} ~ ${l.endDate} (${l.type}) ${l.reason || ''}`);
      }
    }
    
    return;
  }
  
  if (args.skill) {
    const skill = skills.find(s => s.id === args.skill);
    if (!skill) {
      utils.logError(`未找到技能组: ${args.skill}`);
      process.exit(1);
    }
    
    const skilledAgents = agents.filter(a => 
      Array.isArray(a.skills) && a.skills.includes(skill.id)
    );
    
    const coverage = engine.calculateCoverage(config, schedules, agents, skills);
    const skillCoverage = coverage.bySkill[skill.id];
    
    console.log(`\n【技能组详情】 ${skill.name} (${skill.id})`);
    console.log(`  描述: ${skill.description || '无'}`);
    console.log(`  优先级: ${skill.priority}`);
    console.log(`  需要最小覆盖: ${skill.requiresMinCoverage ? '是' : '否'}`);
    console.log(`  覆盖率: ${skillCoverage?.percentage || 0}%`);
    console.log(`\n  拥有该技能的客服 (${skilledAgents.length} 人):`);
    
    for (const a of skilledAgents) {
      const agentSchedules = schedules.filter(s => s.agentId === a.id);
      console.log(`    ${a.name} (${a.id}) - ${agentSchedules.length} 条排班`);
    }
    
    return;
  }
  
  if (args.conflict !== undefined) {
    const idx = parseInt(args.conflict, 10);
    const conflicts = engine.runAllChecks(config, schedules, agents, skills, holidays, leaves, locks);
    
    if (isNaN(idx) || idx < 0 || idx >= conflicts.length) {
      utils.logError(`冲突索引无效，有效范围: 0 ~ ${conflicts.length - 1}`);
      process.exit(1);
    }
    
    const conflict = conflicts[idx];
    console.log(`\n【冲突详情】 #${idx}`);
    console.log(`  类型: ${conflict.type}`);
    console.log(`  级别: ${conflict.severity}`);
    console.log(`  消息: ${conflict.message}`);
    
    for (const [key, value] of Object.entries(conflict)) {
      if (!['type', 'severity', 'message'].includes(key)) {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      }
    }
    
    return;
  }
  
  if (args.suggestion !== undefined) {
    const idx = parseInt(args.suggestion, 10);
    const conflicts = engine.runAllChecks(config, schedules, agents, skills, holidays, leaves, locks);
    const suggestions = engine.findSwapSuggestions(config, schedules, agents, skills, holidays, leaves, locks, conflicts);
    
    if (isNaN(idx) || idx < 0 || idx >= suggestions.length) {
      utils.logError(`建议索引无效，有效范围: 0 ~ ${suggestions.length - 1}`);
      process.exit(1);
    }
    
    const s = suggestions[idx];
    console.log(`\n【建议详情】 #${idx}`);
    console.log(`  类型: ${s.type}`);
    console.log(`  优先级: ${s.priority}`);
    console.log(`  操作: ${s.action}`);
    console.log(`  影响: ${s.impact}`);
    
    if (s.conflict) {
      console.log(`\n  关联冲突: ${s.conflict.type} - ${s.conflict.message}`);
    }
    
    return;
  }
  
  utils.logError('请指定 --agent, --skill, --conflict 或 --suggestion');
  process.exit(1);
}

function cmdReport(args) {
  if (!storage.isInitialized()) {
    utils.logError('工作目录未初始化，请先运行 `csp init`');
    process.exit(1);
  }
  
  const config = storage.getConfig();
  const agents = storage.getAgents();
  const skills = storage.getSkills();
  const holidays = storage.getHolidays();
  const leaves = storage.getLeaves();
  const schedules = storage.getSchedules();
  const locks = storage.getLocks();
  
  utils.logInfo('生成完整报告...');
  
  const report = engine.generateFullReport(config, schedules, agents, skills, holidays, leaves, locks);
  storage.saveReport(report);
  
  storage.recordHistory('report', {
    fairnessScore: report.fairness.score,
    coverageOverall: report.coverage.overall,
    conflictCount: report.conflicts.length,
    suggestionCount: report.suggestions.length
  });
  
  if (args.file) {
    utils.writeJSON(args.file, report);
    utils.logSuccess(`报告已保存到: ${args.file}`);
  }
  
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  
  const levelLabels = {
    excellent: '优秀 🟢',
    good: '良好 🟡',
    fair: '一般 🟠',
    poor: '较差 🔴'
  };
  
  console.log('\n' + '='.repeat(70));
  console.log('                      排班公平性完整报告');
  console.log('='.repeat(70));
  console.log(`生成时间: ${report.generatedAt}`);
  console.log(`目标月份: ${report.config.targetMonth}`);
  
  console.log('\n' + '-'.repeat(70));
  console.log('【一、公平性评分】');
  console.log('-'.repeat(70));
  console.log(`  综合评分: ${report.fairness.score} 分`);
  console.log(`  评价等级: ${levelLabels[report.fairness.level] || report.fairness.level}`);
  console.log(`\n  扣分明细:`);
  
  for (const item of report.fairness.breakdown) {
    if (item.penalty > 0) {
      console.log(`    - ${item.factor}: -${item.penalty} 分`);
    }
  }
  
  console.log(`\n  冲突汇总:`);
  console.log(`    严重: ${report.fairness.conflictSummary.critical}`);
  console.log(`    高:   ${report.fairness.conflictSummary.high}`);
  console.log(`    中:   ${report.fairness.conflictSummary.medium}`);
  console.log(`    低:   ${report.fairness.conflictSummary.low}`);
  
  console.log('\n' + '-'.repeat(70));
  console.log('【二、覆盖率分析】');
  console.log('-'.repeat(70));
  console.log(`  整体覆盖率: ${report.coverage.overall}%`);
  
  console.log(`\n  按技能组:`);
  for (const [skillId, cov] of Object.entries(report.coverage.bySkill)) {
    const status = cov.percentage >= 100 ? '✅' : cov.percentage >= 80 ? '⚠️' : '❌';
    console.log(`    ${status} ${cov.name}: ${cov.percentage}% (${cov.covered}/${cov.slots} 槽位)`);
  }
  
  console.log('\n' + '-'.repeat(70));
  console.log('【三、冲突列表】');
  console.log('-'.repeat(70));
  
  if (report.conflicts.length === 0) {
    console.log('  ✅ 无冲突');
  } else {
    const typeLabels = {
      leave_conflict: '请假冲突',
      lock_violation: '锁定班次违规',
      consecutive_night_shifts: '连续夜班',
      skill_gap: '技能组空档',
      night_shift_over_limit: '夜班超限',
      consecutive_work_days: '连续工作超限',
      night_shift_uneven: '夜班不均',
      holiday_uneven: '节假日不均'
    };
    
    const grouped = {};
    for (const c of report.conflicts) {
      const key = c.type;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    }
    
    for (const [type, list] of Object.entries(grouped)) {
      const label = typeLabels[type] || type;
      const maxSeverity = list.reduce((m, c) => {
        const order = { critical: 3, high: 2, medium: 1, low: 0 };
        return order[c.severity] > order[m] ? c.severity : m;
      }, 'low');
      console.log(`\n  [${maxSeverity.toUpperCase()}] ${label} (${list.length} 个)`);
      
      for (const c of list.slice(0, 3)) {
        console.log(`    - ${c.message}`);
      }
      if (list.length > 3) {
        console.log(`    ... 还有 ${list.length - 3} 个`);
      }
    }
  }
  
  console.log('\n' + '-'.repeat(70));
  console.log('【四、换班建议】');
  console.log('-'.repeat(70));
  
  if (report.suggestions.length === 0) {
    console.log('  ✅ 无需调整');
  } else {
    console.log(`  共 ${report.suggestions.length} 条建议（按优先级排序）:`);
    
    for (let i = 0; i < Math.min(10, report.suggestions.length); i++) {
      const s = report.suggestions[i];
      console.log(`\n  #${i + 1} [P${s.priority}] ${s.action}`);
      console.log(`      影响: ${s.impact}`);
    }
    
    if (report.suggestions.length > 10) {
      console.log(`\n  ... 还有 ${report.suggestions.length - 10} 条建议`);
    }
    console.log('\n  💡 运行 `csp detail --suggestion <索引-1>` 查看建议详情');
  }
  
  console.log('\n' + '-'.repeat(70));
  console.log('【五、客服统计】');
  console.log('-'.repeat(70));
  
  const agentRows = Object.values(report.statistics.agents).map(a => [
    a.name,
    a.id,
    a.skills?.join(',').slice(0, 20) || '',
    a.totalShifts,
    a.nightShifts,
    a.holidayShifts,
    a.leaveDays,
    a.conflicts
  ]);
  
  utils.printTable(
    ['姓名', 'ID', '技能', '班次', '夜班', '节假日', '请假', '冲突'],
    agentRows
  );
  
  console.log('\n' + '-'.repeat(70));
  console.log('【六、技能组统计】');
  console.log('-'.repeat(70));
  
  const skillRows = Object.values(report.statistics.skills).map(s => [
    s.name,
    s.id,
    s.agentCount,
    s.coverage + '%',
    s.requiresMinCoverage ? '是' : '否'
  ]);
  
  utils.printTable(
    ['技能组', 'ID', '客服数', '覆盖率', '需最小覆盖'],
    skillRows
  );
  
  console.log('\n' + '='.repeat(70));
  console.log('报告结束。详细数据保存在 data/report.json');
  console.log('='.repeat(70));
  
  if (report.fairness.score < 70) {
    process.exitCode = 1;
  }
}

function cmdHistory(args) {
  if (!storage.isInitialized()) {
    utils.logError('工作目录未初始化，请先运行 `csp init`');
    process.exit(1);
  }
  
  const limit = parseInt(args.limit || '10', 10);
  const type = args.type;
  
  if (type) {
    const history = storage.getHistory(type, limit);
    if (history.length === 0) {
      utils.logInfo(`没有 ${type} 类型的历史记录`);
      return;
    }
    
    console.log(`\n【历史记录】 ${type} (最近 ${history.length} 条)`);
    for (const entry of history) {
      console.log(`\n  ${entry.timestamp}`);
      console.log(`    ID: ${entry.id}`);
      console.log(`    数据: ${JSON.stringify(entry.payload).slice(0, 200)}`);
    }
  } else {
    const types = storage.getAllHistoryTypes();
    console.log('\n【可用的历史类型】');
    for (const t of types) {
      const count = storage.getHistory(t, 1000).length;
      console.log(`  ${t}: ${count} 条记录`);
    }
    console.log('\n使用 `csp history --type <类型>` 查看详情');
  }
}

function cmdLock(args) {
  if (!storage.isInitialized()) {
    utils.logError('工作目录未初始化，请先运行 `csp init`');
    process.exit(1);
  }
  
  const agentId = args.agent;
  const date = args.date;
  const shiftType = args.shift;
  const reason = args.reason || '';
  const operator = args.operator || 'system';
  
  if (!agentId || !date || !shiftType) {
    utils.logError('必须指定 --agent, --date, --shift');
    process.exit(1);
  }
  
  const agents = storage.getAgents();
  if (!agents.find(a => a.id === agentId)) {
    utils.logError(`客服不存在: ${agentId}`);
    process.exit(1);
  }
  
  const config = storage.getConfig();
  if (!config.shiftTypes?.[shiftType]) {
    utils.logError(`班次类型无效: ${shiftType}`);
    process.exit(1);
  }
  
  const locks = storage.getLocks();
  const existing = locks.find(l => 
    l.agentId === agentId && l.date === date && l.shiftType === shiftType
  );
  
  if (existing) {
    utils.logInfo(`该班次已锁定，跳过: ${agentId} ${date} ${shiftType}`);
    return;
  }
  
  const newLock = models.normalizeLock({
    agentId,
    date,
    shiftType,
    reason,
    operator
  });
  
  const validation = models.validateLock(newLock);
  if (!validation.valid) {
    utils.logError(`锁定数据无效: ${validation.errors.join('; ')}`);
    process.exit(1);
  }
  
  locks.push(newLock);
  storage.saveLocks(locks, operator, `manual_lock: ${reason || '锁定班次'}`);
  
  utils.logSuccess(`已锁定: ${agentId} ${date} ${shiftType}`);
  utils.logInfo(`操作者: ${operator}, 原因: ${reason || '无'}`);
}

function cmdUnlock(args) {
  if (!storage.isInitialized()) {
    utils.logError('工作目录未初始化，请先运行 `csp init`');
    process.exit(1);
  }
  
  const agentId = args.agent;
  const date = args.date;
  const shiftType = args.shift;
  const operator = args.operator || 'system';
  
  if (!agentId || !date || !shiftType) {
    utils.logError('必须指定 --agent, --date, --shift');
    process.exit(1);
  }
  
  const locks = storage.getLocks();
  const toRemove = locks.findIndex(l => 
    l.agentId === agentId && l.date === date && l.shiftType === shiftType
  );
  
  if (toRemove === -1) {
    utils.logInfo(`该班次未锁定，跳过: ${agentId} ${date} ${shiftType}`);
    return;
  }
  
  const removed = locks.splice(toRemove, 1)[0];
  storage.saveLocks(locks, operator, `manual_unlock: 移除 ${removed.id}`);
  
  utils.logSuccess(`已解锁: ${agentId} ${date} ${shiftType}`);
}

function cmdStatus(args) {
  if (!storage.isInitialized()) {
    if (args.json) {
      console.log(JSON.stringify({ initialized: false }));
    } else {
      utils.logWarn('工作目录未初始化');
      console.log('运行 `csp init --sample` 开始使用');
    }
    return;
  }
  
  const config = storage.getConfig();
  const state = storage.getState();
  const agents = storage.getAgents();
  const skills = storage.getSkills();
  const schedules = storage.getSchedules();
  const leaves = storage.getLeaves();
  const locks = storage.getLocks();
  const report = storage.getReport();
  
  const status = {
    initialized: true,
    targetMonth: config.targetMonth,
    initializedAt: state?.initializedAt,
    currentVersion: state?.currentVersion || 0,
    counts: {
      agents: agents.length,
      skills: skills.length,
      schedules: schedules.length,
      leaves: leaves.length,
      locks: locks.length
    },
    lastCheck: state?.checkHistory?.[0] || null,
    lastReportScore: report?.fairness?.score || null
  };
  
  if (args.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  
  console.log('\n【系统状态】');
  console.log(`  已初始化: 是`);
  console.log(`  目标月份: ${status.targetMonth}`);
  console.log(`  初始化时间: ${status.initializedAt}`);
  console.log(`\n【数据统计】`);
  console.log(`  客服: ${status.counts.agents}`);
  console.log(`  技能组: ${status.counts.skills}`);
  console.log(`  排班记录: ${status.counts.schedules}`);
  console.log(`  请假记录: ${status.counts.leaves}`);
  console.log(`  锁定班次: ${status.counts.locks}`);
  
  if (status.lastCheck) {
    console.log(`\n【上次检查】`);
    console.log(`  时间: ${status.lastCheck.timestamp}`);
    console.log(`  公平分: ${status.lastCheck.fairnessScore}`);
    console.log(`  冲突数: ${status.lastCheck.conflictCount}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  
  const command = args._[0] || 'help';
  
  if (!COMMANDS.includes(command)) {
    utils.logError(`未知命令: ${command}`);
    printHelp();
    process.exit(1);
  }
  
  switch (command) {
    case 'init': return cmdInit(args);
    case 'import': return cmdImport(args);
    case 'check': return cmdCheck(args);
    case 'detail': return cmdDetail(args);
    case 'report': return cmdReport(args);
    case 'history': return cmdHistory(args);
    case 'lock': return cmdLock(args);
    case 'unlock': return cmdUnlock(args);
    case 'status': return cmdStatus(args);
    case 'help':
    default:
      return printHelp();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  cmdInit,
  cmdImport,
  cmdCheck,
  cmdDetail,
  cmdReport,
  cmdHistory,
  cmdLock,
  cmdUnlock,
  cmdStatus
};
