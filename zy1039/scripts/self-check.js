#!/usr/bin/env node
/**
 * Stateflow Rehearsal 自检脚本
 * 检查项目是否正确安装、依赖是否完整、能否正常启动
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const EXAMPLES_DIR = path.join(ROOT_DIR, 'examples');

let hasErrors = false;
let hasWarnings = false;

function logStep(step, message) {
  console.log(`\n[${step}] ${message}`);
}

function logSuccess(message) {
  console.log(`  ✅ ${message}`);
}

function logWarning(message) {
  console.log(`  ⚠️  ${message}`);
  hasWarnings = true;
}

function logError(message) {
  console.log(`  ❌ ${message}`);
  hasErrors = true;
}

function checkFileExists(filePath, description, optional = false) {
  if (fs.existsSync(filePath)) {
    logSuccess(`${description} 存在`);
    return true;
  } else if (optional) {
    logWarning(`${description} 不存在（可选）`);
    return false;
  } else {
    logError(`${description} 不存在`);
    return false;
  }
}

function checkDirectory(dirPath, description, optional = false) {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    logSuccess(`${description} 存在`);
    return true;
  } else if (optional) {
    logWarning(`${description} 不存在（可选）`);
    return false;
  } else {
    logError(`${description} 不存在`);
    return false;
  }
}

function checkNodeModules(dirPath, name) {
  const nodeModules = path.join(dirPath, 'node_modules');
  if (fs.existsSync(nodeModules)) {
    logSuccess(`${name} node_modules 存在`);
    return true;
  } else {
    logWarning(`${name} node_modules 不存在，请运行 npm run install:all`);
    return false;
  }
}

function checkPackageJson(dirPath, name, expectedScripts = []) {
  const pkgPath = path.join(dirPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    logError(`${name} package.json 不存在`);
    return false;
  }
  
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    logSuccess(`${name} package.json 有效`);
    
    if (expectedScripts.length > 0) {
      const missingScripts = expectedScripts.filter(s => !pkg.scripts?.[s]);
      if (missingScripts.length === 0) {
        logSuccess(`${name} 包含所有必需脚本`);
      } else {
        logWarning(`${name} 缺少脚本: ${missingScripts.join(', ')}`);
      }
    }
    
    return true;
  } catch (e) {
    logError(`${name} package.json 解析失败: ${e.message}`);
    return false;
  }
}

function runQuickTest(description, testFn) {
  try {
    const result = testFn();
    if (result === true || (result && result.success)) {
      logSuccess(description);
      return true;
    } else {
      logError(description + (result?.message ? `: ${result.message}` : ''));
      return false;
    }
  } catch (e) {
    logError(`${description}: ${e.message}`);
    return false;
  }
}

console.log('='.repeat(60));
console.log('🚀 Stateflow Rehearsal 自检脚本');
console.log('='.repeat(60));

// Step 1: 检查项目结构
logStep(1, '检查项目结构');
checkDirectory(ROOT_DIR, '项目根目录');
checkDirectory(BACKEND_DIR, '后端目录');
checkDirectory(FRONTEND_DIR, '前端目录');
checkDirectory(EXAMPLES_DIR, '示例目录');

// Step 2: 检查核心配置文件
logStep(2, '检查核心配置文件');
checkFileExists(path.join(ROOT_DIR, 'package.json'), '根 package.json');
checkFileExists(path.join(BACKEND_DIR, 'package.json'), '后端 package.json');
checkFileExists(path.join(FRONTEND_DIR, 'package.json'), '前端 package.json');
checkFileExists(path.join(FRONTEND_DIR, 'tsconfig.json'), '前端 tsconfig.json');
checkFileExists(path.join(FRONTEND_DIR, 'vue.config.js'), '前端 vue.config.js');

// Step 3: 检查后端核心文件
logStep(3, '检查后端核心文件');
checkFileExists(path.join(BACKEND_DIR, 'src', 'app.js'), '后端入口 app.js');
checkDirectory(path.join(BACKEND_DIR, 'src', 'engine'), '后端 engine 模块');
checkFileExists(path.join(BACKEND_DIR, 'src', 'engine', 'parser.js'), '解析器 parser.js');
checkFileExists(path.join(BACKEND_DIR, 'src', 'engine', 'validator.js'), '验证器 validator.js');
checkFileExists(path.join(BACKEND_DIR, 'src', 'engine', 'executor.js'), '执行器 executor.js');
checkFileExists(path.join(BACKEND_DIR, 'src', 'engine', 'checker.js'), '检查器 checker.js');
checkDirectory(path.join(BACKEND_DIR, 'src', 'routes'), '后端 routes 模块');
checkDirectory(path.join(BACKEND_DIR, 'src', 'storage'), '后端 storage 模块');
checkDirectory(path.join(BACKEND_DIR, 'src', 'export'), '后端 export 模块');

// Step 4: 检查前端核心文件
logStep(4, '检查前端核心文件');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'main.ts'), '前端入口 main.ts');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'App.vue'), '根组件 App.vue');
checkDirectory(path.join(FRONTEND_DIR, 'src', 'views'), '前端 views 目录');
checkDirectory(path.join(FRONTEND_DIR, 'src', 'components'), '前端 components 目录');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'api', 'index.ts'), 'API 封装 index.ts');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'router', 'index.ts'), '路由配置 index.ts');

// Step 5: 检查前端组件
logStep(5, '检查前端组件');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'views', 'Home.vue'), '首页组件 Home.vue');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'views', 'Editor.vue'), '编辑器组件 Editor.vue');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'components', 'StateGraph.vue'), '状态图组件 StateGraph.vue');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'components', 'EventPanel.vue'), '事件面板组件 EventPanel.vue');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'components', 'TimelinePanel.vue'), '时间线组件 TimelinePanel.vue');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'components', 'PropertyPanel.vue'), '属性面板组件 PropertyPanel.vue');
checkFileExists(path.join(FRONTEND_DIR, 'src', 'components', 'CheckPanel.vue'), '检查面板组件 CheckPanel.vue');

// Step 6: 检查示例文件
logStep(6, '检查示例状态机');
const orderExample = checkFileExists(path.join(EXAMPLES_DIR, 'order-aftersale.yaml'), '订单售后示例');
const deviceExample = checkFileExists(path.join(EXAMPLES_DIR, 'device-inspection.yaml'), '设备巡检示例');

// Step 7: 检查依赖安装状态
logStep(7, '检查依赖安装状态');
checkPackageJson(ROOT_DIR, '根项目', ['dev', 'install:all', 'check', 'start']);
checkPackageJson(BACKEND_DIR, '后端', ['dev', 'start']);
checkPackageJson(FRONTEND_DIR, '前端', ['serve', 'build']);

const rootModules = checkNodeModules(ROOT_DIR, '根项目');
const backendModules = checkNodeModules(BACKEND_DIR, '后端');
const frontendModules = checkNodeModules(FRONTEND_DIR, '前端');

// Step 8: 快速功能测试（如果依赖已安装）
if (backendModules) {
  logStep(8, '快速功能测试');
  
  // 测试解析器
  runQuickTest('解析器能正常加载', () => {
    const parser = require(path.join(BACKEND_DIR, 'src', 'engine', 'parser'));
    return typeof parser.parse === 'function' && typeof parser.normalize === 'function';
  });
  
  // 测试验证器
  runQuickTest('验证器能正常加载', () => {
    const validator = require(path.join(BACKEND_DIR, 'src', 'engine', 'validator'));
    return typeof validator.validate === 'function';
  });
  
  // 测试执行器
  runQuickTest('执行器能正常加载', () => {
    const executor = require(path.join(BACKEND_DIR, 'src', 'engine', 'executor'));
    return executor && typeof executor.executeEvent === 'function';
  });
  
  // 测试检查器
  runQuickTest('检查器能正常加载', () => {
    const checker = require(path.join(BACKEND_DIR, 'src', 'engine', 'checker'));
    return checker && typeof checker.checkAll === 'function';
  });
  
  // 测试示例解析
  if (orderExample) {
    runQuickTest('订单售后示例能正确解析', () => {
      const fs = require('fs');
      const parser = require(path.join(BACKEND_DIR, 'src', 'engine', 'parser'));
      const content = fs.readFileSync(path.join(EXAMPLES_DIR, 'order-aftersale.yaml'), 'utf8');
      const machine = parser.parse(content);
      return machine 
        && machine.name === '订单售后状态机'
        && Object.keys(machine.states).length >= 7
        && machine.initialState === 'pending_apply';
    });
  }
  
  // 测试检查器功能
  if (orderExample) {
    runQuickTest('检查器能正常运行', () => {
      const fs = require('fs');
      const parser = require(path.join(BACKEND_DIR, 'src', 'engine', 'parser'));
      const checker = require(path.join(BACKEND_DIR, 'src', 'engine', 'checker'));
      const content = fs.readFileSync(path.join(EXAMPLES_DIR, 'order-aftersale.yaml'), 'utf8');
      const machine = parser.parse(content);
      const results = checker.checkAll(machine);
      return results 
        && results.summary
        && Array.isArray(results.checks)
        && results.checks.length >= 5;
    });
  }
}

// Step 9: 输出总结
console.log('\n' + '='.repeat(60));
console.log('📋 自检结果总结');
console.log('='.repeat(60));

if (!hasErrors && !hasWarnings) {
  console.log('\n✅ 所有检查通过！项目已准备就绪。');
  console.log('\n📌 下一步：');
  console.log('   1. 运行 npm run dev 同时启动前后端');
  console.log('   2. 或分别运行:');
  console.log('      - npm run dev:backend (后端端口 3000)');
  console.log('      - npm run dev:frontend (前端端口 8080)');
  console.log('   3. 打开浏览器访问 http://localhost:8080');
  process.exit(0);
} else if (!hasErrors && hasWarnings) {
  console.log('\n⚠️  存在警告，但无致命错误。');
  console.log('\n📌 建议：');
  console.log('   运行 npm run install:all 安装所有依赖');
  console.log('   然后运行 npm run check 重新检查');
  process.exit(0);
} else {
  console.log('\n❌ 存在致命错误，请检查上述问题后重试。');
  console.log('\n📌 可能的解决方案：');
  console.log('   1. 运行 npm run install:all 安装所有依赖');
  console.log('   2. 检查文件完整性');
  console.log('   3. 运行 npm run check 重新检查');
  process.exit(1);
}
