const { execSync } = require('child_process');
console.log('开始运行验证测试...');
try {
  execSync('node --input-type=commonjs -e "' + 
    "const fs = require('fs');" +
    "const code = fs.readFileSync('verify_fix.js', 'utf8');" +
    "eval(code);" +
    '"', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
  console.error('运行失败:', e.message);
  process.exit(1);
}
