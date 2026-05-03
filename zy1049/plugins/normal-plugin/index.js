console.log('=== 正常插件启动 ===');
console.log('插件上下文:', __context);

async function main() {
  console.log('1. 测试文件读取权限 (已声明)...');
  try {
    const exists = await fs.exists('test.txt');
    console.log('   文件存在检查结果:', exists);
  } catch (err) {
    console.error('   读取失败:', err.message);
  }

  console.log('2. 测试事件订阅权限 (已声明)...');
  event.subscribe('plugin:ready', (data) => {
    console.log('   收到事件: plugin:ready', data);
  });

  console.log('3. 测试事件发布权限 (已声明)...');
  event.publish('plugin:ready', { status: 'ok', timestamp: Date.now() });

  console.log('4. 测试文件写入权限 (已声明)...');
  try {
    await fs.writeFile('output.txt', 'Hello from Normal Plugin!');
    console.log('   写入成功');
  } catch (err) {
    console.error('   写入失败:', err.message);
  }

  console.log('=== 正常插件执行完成 ===');
}

main().catch(err => {
  console.error('插件执行出错:', err);
  throw err;
});
