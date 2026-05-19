const db = require('../src/models/database');
const VerificationService = require('../src/services/verificationService');

async function debug() {
  await db.waitForInit();
  console.log('开始测试越权放行...');
  const result = await VerificationService.forceAllow('phone', '13600000000', '领导特批', '北门', { id: 1, name: '安保主管' });
  console.log('结果:', JSON.stringify(result, null, 2));
}

debug().catch(console.error);
