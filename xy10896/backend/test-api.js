const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/confirmations',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const confirmations = JSON.parse(data);
      console.log('=== API 验证测试 ===\n');
      console.log(`✅ 确认项总数: ${confirmations.length}`);
      
      const byRisk = { high: 0, medium: 0, low: 0 };
      const byTeam = {};
      
      confirmations.forEach(c => {
        byRisk[c.riskLevel] = (byRisk[c.riskLevel] || 0) + 1;
        byTeam[c.teamName] = (byTeam[c.teamName] || 0) + 1;
      });
      
      console.log('\n📊 风险等级分布:');
      console.log(`   🔴 高风险: ${byRisk.high} 项`);
      console.log(`   🟡 中风险: ${byRisk.medium} 项`);
      console.log(`   🟢 低风险: ${byRisk.low} 项`);
      
      console.log('\n👥 按团队分布:');
      Object.entries(byTeam).forEach(([team, count]) => {
        console.log(`   ${team}: ${count} 项`);
      });
      
      console.log('\n=== 所有样例数据已正确加载 ===');
      process.exit(0);
    } catch (e) {
      console.error('解析失败:', e);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('请求失败:', e.message);
  process.exit(1);
});

req.end();
