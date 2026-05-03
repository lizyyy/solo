console.log('=== 越权测试插件启动 ===');

async function main() {
  console.log('1. 测试已声明的权限 fs:read...');
  try {
    const exists = await fs.exists('test.txt');
    console.log('   正常: 已声明权限调用成功', exists);
  } catch (err) {
    console.log('   已声明权限却失败:', err.message);
  }

  console.log('');
  console.log('2. 尝试越权使用 fs:write (未声明)...');
  try {
    await fs.writeFile('secret.txt', 'sensitive data');
    console.log('   ⚠️  越权成功! 这是安全漏洞');
  } catch (err) {
    console.log('   ✅ 沙盒成功阻止越权:', err.message);
  }

  console.log('');
  console.log('3. 尝试越权使用 network:fetch (未声明)...');
  try {
    await network.fetch('https://example.com');
    console.log('   ⚠️  越权成功! 这是安全漏洞');
  } catch (err) {
    console.log('   ✅ 沙盒成功阻止越权:', err.message);
  }

  console.log('');
  console.log('4. 尝试越权使用 env:read (未声明)...');
  try {
    const value = env.get('API_KEY');
    console.log('   env.get 返回:', value);
  } catch (err) {
    console.log('   错误:', err.message);
  }

  console.log('');
  console.log('5. 尝试越权使用 process.exec (未声明)...');
  try {
    process.exec('rm -rf /');
    console.log('   ⚠️  越权成功! 这是严重安全漏洞');
  } catch (err) {
    console.log('   ✅ 沙盒成功阻止越权:', err.message);
  }

  console.log('');
  console.log('=== 越权测试插件执行完成 ===');
}

main().catch(err => {
  console.error('插件执行出错:', err);
  throw err;
});
