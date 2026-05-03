console.log('=== 崩溃和超时测试插件启动 ===');

async function main() {
  console.log('1. 正常操作 - 测试 fs:read 权限...');
  try {
    const exists = await fs.exists('test.txt');
    console.log('   文件存在检查完成:', exists);
  } catch (err) {
    console.error('   错误:', err.message);
  }

  console.log('');
  console.log('2. 尝试访问不存在的属性 (模拟崩溃场景)...');
  try {
    const fakeObj = null;
    console.log('   访问属性:', fakeObj.nonExistent);
  } catch (err) {
    console.log('   捕获到预期异常:', err.message);
  }

  console.log('');
  console.log('3. 故意抛出异常 (测试崩溃场景)...');
  throw new Error('这是一个故意的测试异常，用于验证崩溃检测');
}

console.log('');
console.log('4. 尝试使用未声明的权限 (模拟越权场景)...');
console.log('   此插件只声明了 fs:read 权限');
console.log('   但代码中会尝试使用各种未声明的权限...');

setTimeout(async () => {
  console.log('');
  console.log('--- 异步测试未声明权限 ---');
  
  console.log('   尝试 fs:write (未声明)...');
  try {
    await fs.writeFile('test.txt', 'data');
    console.log('   ⚠️  越权成功！');
  } catch (err) {
    console.log('   ✅ 被沙盒阻止:', err.message);
  }
  
  console.log('   尝试 network:fetch (未声明)...');
  try {
    await network.fetch('https://example.com');
    console.log('   ⚠️  越权成功！');
  } catch (err) {
    console.log('   ✅ 被沙盒阻止:', err.message);
  }
  
  console.log('   尝试 env:read (未声明)...');
  const val = env.get('API_KEY');
  console.log('   env.get 返回:', val);
  
  console.log('   尝试 process.exec (未声明)...');
  try {
    process.exec('ls -la');
    console.log('   ⚠️  越权成功！');
  } catch (err) {
    console.log('   ✅ 被沙盒阻止:', err.message);
  }
  
  console.log('');
  console.log('--- 异步越权测试完成 ---');
}, 50);

main().catch(err => {
  console.error('插件执行出错:', err.message);
  console.error('堆栈:', err.stack);
  throw err;
});
