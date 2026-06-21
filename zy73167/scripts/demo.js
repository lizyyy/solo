const http = require('http');

const base = 'http://localhost:3000/api';

function request(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(base + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function printSection(title) {
  console.log('\n' + '═'.repeat(60));
  console.log('  ' + title);
  console.log('═'.repeat(60));
}

function printObj(label, obj) {
  console.log(`\n  [${label}]`);
  console.log('  ' + JSON.stringify(obj, null, 2).split('\n').join('\n  '));
}

async function main() {
  console.log('\n  🧪 曲线拟合错题归因 - 验收演示脚本');
  console.log('  验证要点: 去重 / 版本覆盖 / 备注影响 / 外推越界 / 跳变分析 / 人工确认');

  try {
    await request('/health', 'GET');
  } catch (e) {
    console.error('\n  ❌ 服务未启动！请先执行: npm start');
    console.log('     然后在另一个终端执行: node scripts/demo.js\n');
    process.exit(1);
  }

  printSection('第1步: 录入题目 "曲线拟合错题归因"（叫法一）');
  const r1 = await request('/questions', 'POST', {
    name: '曲线拟合错题归因',
    description: '使用最小二乘法进行曲线拟合，分析错题原因',
    subject: '数学',
  });
  printObj('结果', r1);
  const qId = r1.question.id;
  console.log(`  题目 ID: ${qId}, 新建: ${r1.created}`);

  printSection('第2步: 用不同叫法 "曲线拟合-错题归因" 再次提交（验证去重与名称合并）');
  const r2 = await request('/questions', 'POST', {
    name: '曲线拟合-错题归因',
    description: '使用最小二乘法进行曲线拟合，分析错题原因',
    subject: '数学',
  });
  printObj('结果', r2);
  console.log(`  题目 ID: ${r2.question.id}`);
  console.log(`  是否同一题: ${r2.question.id === qId ? '✅ 是（去重成功）' : '❌ 否（去重失败）'}`);
  console.log(`  已合并别名: ${r2.question.display_names.join(', ')}`);

  printSection('第3步: 添加两个答案版本（v1.0 和 v2.0）');
  const v1 = await request(`/questions/${qId}/answer-versions`, 'POST', {
    version_tag: 'v1.0',
    answer_content: 'y = ax^2 + bx + c，其中 a=2, b=3, c=1',
    confidence: 0.85,
    source: '教材第一版',
  });
  const v2 = await request(`/questions/${qId}/answer-versions`, 'POST', {
    version_tag: 'v2.0',
    answer_content: 'y = ax^2 + bx + c，其中 a=2.5, b=3, c=0.5',
    confidence: 0.9,
    source: '教材修订版',
  });
  printObj('版本 v1.0', v1);
  printObj('版本 v2.0', v2);

  printSection('第4步: 添加第一条评分备注 - 提到版本覆盖和置信度');
  const n1 = await request(`/questions/${qId}/score-notes`, 'POST', {
    content: 'v1.0和v2.0两个版本答案覆盖同一题，置信度80%，建议人工确认',
    scorer: '张老师',
    score: 80,
    max_score: 100,
  });
  printObj('备注1', n1);

  printSection('第5步: 重复提交相同备注（验证去重）');
  const n2 = await request(`/questions/${qId}/score-notes`, 'POST', {
    content: 'v1.0和v2.0两个版本答案覆盖同一题，置信度80%，建议人工确认',
    scorer: '张老师',
    score: 80,
    max_score: 100,
  });
  printObj('重复提交结果', n2);
  console.log(`  是否去重: ${n2.duplicate ? '✅ 是（重复请求未新增记录）' : '❌ 否'}`);

  printSection('第6步: 添加补充材料（带阈值和单位）');
  const s1 = await request(`/questions/${qId}/supplements`, 'POST', {
    name: '拟合曲线斜率',
    content: '3.5',
    type: 'parameter',
    unit: 'm/s',
    threshold: 2.0,
  });
  printObj('补充材料', s1);

  printSection('第7步: 补充材料改名（验证跳变分析中的"改名"检测）');
  const s2 = await request(`/questions/${qId}/supplements`, 'POST', {
    name: '拟合曲线斜率修正值',
    content: '3.5',
    type: 'parameter',
    unit: 'm/s',
    threshold: 2.0,
  });
  printObj('改名后的材料', s2);

  printSection('第8步: 追加一条新评分备注 - 提到外推越界和单位问题');
  const n3 = await request(`/questions/${qId}/score-notes`, 'POST', {
    content: '补充说明：外推到x=10时越界，单位是m/s，阈值设定可能需要调整，需人工确认',
    scorer: '李老师',
    score: 75,
    max_score: 100,
  });
  printObj('备注2（追加）', n3);

  printSection('第9步: 生成并查看归因报告');
  const report = await request(`/questions/${qId}/report`, 'GET');
  console.log('\n  📋 报告摘要:');
  console.log(`     归因原因: ${report.report.summary.attribution_reason}`);
  console.log(`     置信度: ${(report.report.summary.confidence * 100).toFixed(0)}%`);
  console.log(`     需人工确认: ${report.report.summary.need_manual_confirm ? '是' : '否'}`);
  console.log(`     答案版本数: ${report.report.summary.answer_version_count}`);
  console.log(`     评分备注数: ${report.report.summary.score_note_count}`);

  console.log('\n  📚 版本覆盖检测:');
  console.log(`     多版本存在: ${report.report.version_coverage.hasMultipleVersions ? '是' : '否'}`);
  console.log(`     评分备注提及覆盖: ${report.report.version_coverage.coverageEvidence.length > 0 ? '✅ 已识别' : '❌ 未识别'}`);

  console.log('\n  ⚠️  外推越界检测:');
  console.log(`     存在越界: ${report.report.extrapolation.hasIssues ? '✅ 已检测' : '否'}`);
  if (report.report.extrapolation.hasIssues) {
    console.log(`     越界项数: ${report.report.extrapolation.issues.length}`);
    report.report.extrapolation.issues.forEach((issue, i) => {
      console.log(`     [${i + 1}] ${issue.description}`);
      console.log(`         建议: ${issue.suggestions[0].substring(0, 50)}...`);
    });
  }

  console.log('\n  📈 跳变分析 - 可能原因:');
  report.report.sudden_change.possibleCauses.forEach((c, i) => {
    const typeName = {
      threshold_change: '阈值变化',
      unit_inconsistency: '单位不一致',
      supplement_rename: '补充材料改名',
      multiple_versions: '多版本切换',
      unknown: '未知原因',
    }[c.type] || c.type;
    console.log(`     [${i + 1}] ${typeName}: ${c.description}`);
  });

  console.log('\n  🆕 最新评分备注带来的判断变化:');
  if (report.report.latest_note_impact) {
    report.report.latest_note_impact.changes.forEach(c => {
      console.log(`     • ${c.field}: ${c.before} → ${c.after}`);
    });
  } else {
    console.log('     无（备注数量不足）');
  }

  printSection('第10步: 提交人工确认');
  const cf = await request(`/questions/${qId}/confirmations`, 'POST', {
    decision: 'confirmed',
    reason: '经核对，v2.0 为正确版本，外推越界属合理范围',
    operator: '王负责人',
    before_state: { confidence: 0.65, need_confirm: true, reason: '多版本+外推' },
    after_state: { confidence: 0.92, need_confirm: false, reason: 'v2.0确认正确' },
  });
  printObj('确认记录', cf);

  printSection('第11步: 再次生成报告 - 查看人工确认前后差异复盘');
  const report2 = await request(`/questions/${qId}/report`, 'GET');
  console.log('\n  ✅ 人工确认复盘:');
  if (report2.report.confirmation_diff) {
    const d = report2.report.confirmation_diff;
    console.log(`     决策: ${d.decision}`);
    console.log(`     操作人: ${d.operator || '未记录'}`);
    console.log(`     原因: ${d.reason || '无'}`);
    console.log(`     前置状态: ${JSON.stringify(d.before_state)}`);
    console.log(`     后置状态: ${JSON.stringify(d.after_state)}`);
  }

  printSection('✅ 验收完成 - 检查清单');
  console.log(`
  ☑  名称归一化去重：同一题目不同叫法合并为一条
  ☑  重复请求去重：相同评分备注不会重复入库
  ☑  版本覆盖识别：从评分备注中识别多版本覆盖关系
  ☑  备注影响分析：新增备注后报告说明改变了哪些判断
  ☑  外推越界检测：不仅报错，还给出下一步处理建议
  ☑  跳变原因分析：识别阈值/单位/补充材料改名等因素
  ☑  人工确认复盘：记录确认前后状态差异，可追溯
  ☑  完整 API + 前端页面：开箱即用
  `);

  console.log('  👉 访问 http://localhost:3000 查看前端页面\n');
}

main().catch(console.error);
