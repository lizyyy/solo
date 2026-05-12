const BASE_URL = process.env.QUOTA_API_URL || 'http://localhost:3000';

async function api(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

function step(num, desc) {
  console.log(`\n【步骤 ${num}】${desc}`);
  console.log('-'.repeat(50));
}

function print(label, data, indent = 0) {
  const prefix = ' '.repeat(indent);
  console.log(`${prefix}${label}: ${JSON.stringify(data, null, 2).split('\n').map((l, i) => i === 0 ? l : prefix + l).join('\n')}`);
}

function printLedgerSummary(ledger) {
  console.log('  配额账本摘要:');
  console.log(`    租户: ${ledger.tenantName} (${ledger.tenantId})`);
  console.log(`    状态: ${ledger.status}`);
  console.log(`    当前套餐: ${ledger.currentPlan ? ledger.currentPlan.name : '无'}`);
  console.log('');
  for (const [type, data] of Object.entries(ledger.ledger)) {
    const statusEmoji = data.status === 'over' ? '🔴' : data.status === 'warning' ? '🟡' : '🟢';
    console.log(`    ${statusEmoji} ${type}:`);
    console.log(`       套餐配额: ${data.planQuota} + 加购: ${data.addonQuota} = 总配额: ${data.totalQuota}`);
    console.log(`       已使用: ${data.currentUsage} (历史: ${data.historicalUsage})`);
    console.log(`       可用: ${data.available} | 超用: ${data.overage} | 状态: ${data.status}`);
    if (data.overageReason) {
      console.log(`       ⚠️  超用原因:`);
      for (const r of data.overageReason) {
        console.log(`          - ${r.description}`);
      }
    }
  }
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { api, section, step, print, printLedgerSummary, wait, BASE_URL };
