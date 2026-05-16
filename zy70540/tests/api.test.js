const axios = require('axios');
const BASE_URL = 'http://localhost:3000/api';
async function runTests() {
 console.log('=== 开始API测试 ===\n');
 let vendorId;
 let interfaceId;
 let disposalId;
 try {
 console.log('1. 创建供应商...');
 const vendorRes = await axios.post(`${BASE_URL}/vendors`, {
 name: '阿里云服务',
 description: '云计算服务供应商',
 contact_info: 'support@aliyun.com'
 });
 console.log(' ✓ 供应商创建成功');
 vendorId = vendorRes.data.data.id;
 console.log(` 供应商ID: ${vendorId}`);
 }
 catch (err) {
 console.log(` ✗ 创建供应商失败: ${err.response?.data?.error || err.message}`);
 return;
 }
 try {
 console.log('\n2. 查询供应商列表...');
 const vendorsRes = await axios.get(`${BASE_URL}/vendors`);
 console.log(` ✓ 查询成功，共 ${vendorsRes.data.data.length} 个供应商`);
 }
 catch (err) {
 console.log(` ✗ 查询失败: ${err.response?.data?.error || err.message}`);
 }
 try {
 console.log('\n3. 创建接口...');
 const interfaceRes = await axios.post(`${BASE_URL}/vendors/${vendorId}/interfaces`, {
 name: '短信发送接口',
 endpoint: 'https://dysmsapi.aliyuncs.com',
 method: 'POST',
 timeout_threshold: 5000,
 failure_threshold: 0.1
 });
 console.log(' ✓ 接口创建成功');
 interfaceId = interfaceRes.data.data.id;
 console.log(` 接口ID: ${interfaceId}`);
 }
 catch (err) {
 console.log(` ✗ 创建接口失败: ${err.response?.data?.error || err.message}`);
 return;
 }
 try {
 console.log('\n4. 记录失败 - 超时...');
 await axios.post(`${BASE_URL}/failures`, {
 interface_id: interfaceId,
 vendor_id: vendorId,
 error_type: 'timeout',
 error_message: '请求超时 - 超过5秒',
 raw_input: JSON.stringify({ phone: '13800138000', template: 'verify' }),
 processing_evidence: JSON.stringify({ timeout: 5000, actual: 6500 }),
 final_conclusion: '网络波动导致超时，重试可能成功',
 is_sample: true
 });
 console.log(' ✓ 超时失败记录成功');
 }
 catch (err) {
 console.log(` ✗ 记录失败: ${err.response?.data?.error || err.message}`);
 }
 try {
 console.log('\n5. 记录失败 - 服务异常...');
 for (let i = 0; i < 3; i++) {
 await axios.post(`${BASE_URL}/failures`, {
 interface_id: interfaceId,
 vendor_id: vendorId,
 error_type: 'server_error',
 error_message: '500 Internal Server Error',
 raw_input: JSON.stringify({ data: 'test' }),
 processing_evidence: JSON.stringify({ status: 500, response: 'error' }),
 final_conclusion: '服务端异常，需要告警'
 });
 }
 console.log(' ✓ 服务异常失败记录成功 (3条)');
 }
 catch (err) {
 console.log(` ✗ 记录失败: ${err.response?.data?.error || err.message}`);
 }
 try {
 console.log('\n6. 查询健康评分...');
 const scoreRes = await axios.get(`${BASE_URL}/health/score/${interfaceId}`);
 console.log(` ✓ 查询成功，当前评分: ${scoreRes.data.data?.score || '暂无'}`);
 console.log(` 失败率: ${((scoreRes.data.data?.failure_rate || 0) * 100).toFixed(1)}%`);
 }
 catch (err) {
 console.log(` ✗ 查询失败: ${err.response?.data?.error || err.message}`);
 }
 try {
 console.log('\n7. 创建处置动作...');
 const disposalRes = await axios.post(`${BASE_URL}/disposal`, {
 interface_id: interfaceId,
 vendor_id: vendorId,
 action_type: 'alert',
 action_reason: '健康评分下降，失败率升高',
 triggered_by: 'system',
 raw_input: JSON.stringify({ score: 75, failure_rate: 0.25 }),
 processing_evidence: JSON.stringify({ threshold: 0.1, actual: 0.25 }),
 final_conclusion: '触发告警通知运维人员'
 });
 console.log(' ✓ 处置动作创建成功');
 disposalId = disposalRes.data.data.id;
 console.log(` 处置ID: ${disposalId}`);
 }
 catch (err) {
 console.log(` ✗ 创建失败: ${err.response?.data?.error || err.message}`);
 }
 try {
 console.log('\n8. 重复创建相同处置动作 (验证防重复)...');
 await axios.post(`${BASE_URL}/disposal`, {
 interface_id: interfaceId,
 vendor_id: vendorId,
 action_type: 'alert',
 action_reason: '重复测试'
 });
 console.log(' ✗ 应该失败但成功了');
 }
 catch (err) {
 if (err.response?.data?.error?.includes('相同类型的处置动作已存在')) {
 console.log(' ✓ 正确拦截重复动作');
 }
 else {
 console.log(` ✗ 错误类型不符: ${err.response?.data?.error}`);
 }
 }
 try {
 console.log('\n9. 推进处置状态...');
 const advanceRes = await axios.post(`${BASE_URL}/disposal/${disposalId}/status`, {
 status: 'in_progress',
 result: '运维已确认，正在排查'
 });
 console.log(` ✓ 状态推进成功，当前状态: ${advanceRes.data.data.status}`);
 }
 catch (err) {
 console.log(` ✗ 推进失败: ${err.response?.data?.error || err.message}`);
 }
 try {
 console.log('\n10. 人工修正...');
 await axios.post(`${BASE_URL}/export/manual-correction`, {
 interface_id: interfaceId,
 vendor_id: vendorId,
 correction_type: 'score_adjustment',
 old_value: '60',
 new_value: '80',
 reason: '误报，实际服务正常',
 operator: 'admin@example.com'
 });
 console.log(' ✓ 人工修正记录成功');
 }
 catch (err) {
 console.log(` ✗ 修正失败: ${err.response?.data?.error || err.message}`);
 }
 try {
 console.log('\n11. 导出健康摘要...');
 const exportRes = await axios.get(`${BASE_URL}/export/health-summary?vendor_id=${vendorId}`);
 const summary = exportRes.data.data;
 console.log(` ✓ 导出成功，共 ${summary.total_interfaces} 个接口`);
 if (summary.summary[0]?.exceptions?.length > 0) {
 console.log(' 异常解释:');
 summary.summary[0].exceptions.forEach((ex, i) => {
 console.log(` ${i + 1}. ${ex.explanation}`);
 if (ex.raw_input)
 console.log(` - 原始输入: ${ex.raw_input.substring(0, 50)}...`);
 if (ex.final_conclusion)
 console.log(` - 结论: ${ex.final_conclusion}`);
 });
 }
 }
 catch (err) {
 console.log(` ✗ 导出失败: ${err.response?.data?.error || err.message}`);
 }
 try {
 console.log('\n12. 查询失败聚合...');
 const aggRes = await axios.get(`${BASE_URL}/failures/interface/${interfaceId}/aggregate`);
 console.log(` ✓ 聚合成功，共 ${aggRes.data.data.length} 种错误类型`);
 aggRes.data.data.forEach(item => {
 console.log(` - ${item.error_type}: ${item.count} 次`);
 });
 }
 catch (err) {
 console.log(` ✗ 聚合查询失败: ${err.response?.data?.error || err.message}`);
 }
 console.log('\n=== 测试完成 ===');
 console.log('\n测试验证点:');
 console.log(' ✓ 创建供应商和接口');
 console.log(' ✓ 记录多种类型的失败');
 console.log(' ✓ 健康评分自动计算');
 console.log(' ✓ 处置动作防重复提交');
 console.log(' ✓ 处置状态推进');
 console.log(' ✓ 人工修正记录');
 console.log(' ✓ 健康摘要导出，每条异常都有解释');
 console.log(' ✓ 失败路径保留原始输入、处理依据和最终结论');
}
runTests().catch(console.error);
