const http = require('http');

const BASE_URL = 'http://localhost:3001';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    const url = new URL(path, BASE_URL);
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('非 JSON 响应: ' + data.substring(0, 100)));
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function printStep(title) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60));
}

function printResult(r, showData = false) {
  console.log('✅ 成功:', r['成功']);
  if (r['提示']) console.log('💬 提示:', r['提示']);
  if (r['原因']) console.log('❌ 原因:', r['原因']);
  if (r['重复操作']) console.log('🔄 重复操作:', r['重复操作']);
  if (showData && r['数据']) {
    if (Array.isArray(r['数据'])) {
      console.log('📊 数量:', r['数据'].length);
      r['数据'].forEach((item, i) => {
        const status = item.status || item['状态'] || '-';
        const name = item.system_name || item.employee_name || item.permission_type || item.id;
        console.log(`   ${i + 1}. ${name} [${status}]`);
      });
    } else if (typeof r['数据'] === 'object') {
      const d = r['数据'];
      if (d.status) console.log('📋 状态:', d.status);
      if (d.employee_name) console.log('👤 员工:', d.employee_name);
      if (d.approver) console.log('👤 审批人:', d.approver);
    }
  }
}

async function main() {
  console.log('\n' + '🎯'.repeat(15));
  console.log('   员工离职权限回收服务 - 完整演示');
  console.log('🎯'.repeat(15));
  
  let formId;
  let vpnInventoryId;
  let exemptionId;
  
  printStep('【1】创建离职单（员工：钱七，工号：E888）');
  let r = await request('/api/offboarding-forms', 'POST', {
    employee_id: 'E888',
    employee_name: '钱七',
    department: '产品部',
    last_day: '2026-06-01',
    operator: 'HR-周八'
  });
  formId = r['数据']?.id;
  printResult(r, true);
  
  printStep('【验证幂等】再次创建同员工的离职单');
  r = await request('/api/offboarding-forms', 'POST', {
    employee_id: 'E888',
    employee_name: '钱七',
    department: '产品部',
    last_day: '2026-06-01',
    operator: 'HR-周八'
  });
  printResult(r);
  
  printStep('【2】生成权限清单');
  r = await request(`/api/offboarding-forms/${formId}/generate-inventory`, 'POST', {
    operator: '系统管理员'
  });
  if (r['数据'] && Array.isArray(r['数据'])) {
    const vpn = r['数据'].find(p => p.system_name === 'VPN 系统');
    if (vpn) vpnInventoryId = vpn.id;
  }
  printResult(r, true);
  
  printStep('【验证幂等】再次生成权限清单');
  r = await request(`/api/offboarding-forms/${formId}/generate-inventory`, 'POST', {
    operator: '系统管理员'
  });
  printResult(r);
  
  printStep('【3】创建回收任务');
  r = await request(`/api/offboarding-forms/${formId}/create-tasks`, 'POST', {
    operator: '系统管理员'
  });
  printResult(r, true);
  
  printStep('【查看离职单详情】');
  r = await request(`/api/offboarding-forms/${formId}`, 'GET');
  if (r['数据']) {
    const form = r['数据']['离职单'];
    const perms = r['数据']['权限清单'];
    console.log('👤 员工:', form.employee_name, `(${form.employee_id})`);
    console.log('🏢 部门:', form.department);
    console.log('📅 最后工作日:', form.last_day);
    console.log('📊 当前状态:', form.status);
    console.log('📋 权限清单:', perms.length, '项');
  }
  
  printStep('【4】为 VPN 权限申请豁免');
  console.log('   原因：离职交接期间需要远程访问内网处理遗留工作');
  r = await request('/api/exemptions', 'POST', {
    form_id: formId,
    inventory_id: vpnInventoryId,
    reason: '离职交接期间需要远程访问内网处理遗留工作',
    applicant: '吴九（主管）'
  });
  exemptionId = r['数据']?.id;
  printResult(r, true);
  
  printStep('【5】审批通过豁免');
  r = await request(`/api/exemptions/${exemptionId}/approve`, 'POST', {
    approver: '经理-郑十'
  });
  printResult(r, true);
  
  printStep('【验证幂等】再次审批同一豁免申请');
  r = await request(`/api/exemptions/${exemptionId}/approve`, 'POST', {
    approver: '经理-郑十'
  });
  printResult(r);
  
  printStep('【6】查看审计报告');
  r = await request(`/api/audit-report/${formId}`, 'GET');
  if (r['数据']) {
    const d = r['数据'];
    console.log('=== 离职单信息 ===');
    console.log('👤 员工:', d.form.employee_name, `(${d.form.employee_id})`);
    console.log('📊 当前状态:', d.form.status);
    console.log('');
    console.log('=== 权限清单汇总 ===');
    const p = d['权限清单'];
    console.log(`  总数: ${p.总数} | 已回收: ${p.已回收} | 已豁免: ${p.已豁免} | 回收失败: ${p.回收失败} | 待回收: ${p.待回收}`);
    console.log('');
    console.log('=== 豁免申请汇总 ===');
    const e = d['豁免申请'];
    console.log(`  总数: ${e.总数} | 待审批: ${e.待审批} | 已通过: ${e.已通过}`);
    console.log('');
    console.log('=== 操作日志 (最近5条) ===');
    const logs = d['操作日志'].slice(-5);
    logs.forEach(l => {
      const time = l.时间.substring(11, 19);
      console.log(`  🕐 ${time} | ${l.操作人} | ${l.动作} | ${l.详情}`);
    });
  }
  
  printStep('【7】列出所有离职单');
  r = await request('/api/offboarding-forms', 'GET');
  console.log(`共 ${r['数据'].length} 个离职单`);
  r['数据'].forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.employee_name}(${f.employee_id}) - ${f.department} - [${f.status}]`);
  });
  
  console.log('\n' + '✅'.repeat(20));
  console.log('   演示完成！');
  console.log('✅'.repeat(20));
  console.log('\n📄 详细验收说明请查看：验收说明.md');
  console.log('🔌 服务地址：http://localhost:3001');
  console.log(`🆔 本次演示使用的离职单号：${formId}`);
  console.log('');
}

main().catch(console.error);
