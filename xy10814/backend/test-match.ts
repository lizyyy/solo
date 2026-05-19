// 测试 MatchService 的纯函数逻辑
import { MatchService } from './src/services/MatchService';

// 模拟场景
const sceneUnauthorized = {
  matchRules: [
    { type: 'header' as const, key: 'Authorization', value: 'not_exists', operator: 'exists' as const }
  ]
};

const sceneSuccess = {
  matchRules: []
};

function testHeaderScenario(headers: Record<string, string | undefined>, desc: string) {
  console.log(`\n测试: ${desc}`);
  console.log(`Headers:`, headers);
  
  // 检查未授权场景是否匹配
  const matchUnauthorized = MatchService['matchScene'](sceneUnauthorized as any, {
    method: 'GET',
    path: '/api/user',
    headers,
    query: {},
    body: {}
  });
  
  console.log(`未授权场景匹配结果: ${matchUnauthorized ? '是' : '否'}`);
  return matchUnauthorized;
}

// 测试用例
console.log('=== MatchService 纯函数测试 ===');

// 1. Header 不存在 → 应该匹配未授权
testHeaderScenario({}, 'Header 不存在');

// 2. Header 存在但值为空字符串 → 应该匹配未授权
testHeaderScenario({ authorization: '' }, 'Header 存在但值为空');
testHeaderScenario({ Authorization: '' }, 'Header 存在但值为空 (大写)');

// 3. Header 存在且有值 → 不应该匹配未授权
testHeaderScenario({ authorization: 'Bearer token' }, 'Header 存在且有值');
testHeaderScenario({ Authorization: 'Bearer token' }, 'Header 存在且有值 (大写)');

console.log('\n=== 测试完成 ===');
