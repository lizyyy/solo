const fs = require('fs');
const path = require('path');

const testResults = [];
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    testResults.push({ status: 'PASS', message });
    console.log(`✅ PASS: ${message}`);
  } else {
    failedTests++;
    testResults.push({ status: 'FAIL', message });
    console.log(`❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const condition = JSON.stringify(actual) === JSON.stringify(expected);
  assert(condition, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function assertClose(actual, expected, tolerance = 0.001, message) {
  const condition = Math.abs(actual - expected) < tolerance;
  assert(condition, `${message} (expected: ${expected} ± ${tolerance}, got: ${actual})`);
}

console.log('========================================');
console.log('  吊点荷载沙盘 - 模块测试');
console.log('========================================\n');

console.log('📦 测试1: 项目结构验证');
const projectRoot = path.resolve(__dirname, '..');
const requiredFiles = [
  'package.json',
  'index.html',
  'styles.css',
  'README.md',
  'src/main.js',
  'src/models/SceneModel.js',
  'src/engine/LoadCalculator.js',
  'src/engine/CollisionDetector.js',
  'src/renderer/ThreeRenderer.js',
  'src/ui/InteractionManager.js',
  'src/storage/SceneStorage.js',
  'src/export/Exporter.js',
  'src/data/SampleScenes.js'
];

for (const file of requiredFiles) {
  const filePath = path.join(projectRoot, file);
  const exists = fs.existsSync(filePath);
  assert(exists, `文件存在: ${file}`);
}

console.log('\n📋 测试2: package.json 验证');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

assert(packageJson.name === 'hanging-point-sandbox', '项目名称正确');
assert(packageJson.version === '1.0.0', '版本号正确');
assert(typeof packageJson.scripts.dev === 'string', '存在 dev 脚本');
assert(typeof packageJson.scripts.test === 'string', '存在 test 脚本');

console.log('\n📐 测试3: 基本数学计算验证');

class Vector3Test {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  add(v) {
    return new Vector3Test(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  multiplyScalar(s) {
    return new Vector3Test(this.x * s, this.y * s, this.z * s);
  }
  distanceTo(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  clone() {
    return new Vector3Test(this.x, this.y, this.z);
  }
}

const v1 = new Vector3Test(1, 2, 3);
const v2 = new Vector3Test(4, 5, 6);
const vAdd = v1.add(v2);
assertClose(vAdd.x, 5, 0.001, '向量加法 X 分量');
assertClose(vAdd.y, 7, 0.001, '向量加法 Y 分量');
assertClose(vAdd.z, 9, 0.001, '向量加法 Z 分量');

const vMul = v1.multiplyScalar(2);
assertClose(vMul.x, 2, 0.001, '向量数乘 X 分量');
assertClose(vMul.y, 4, 0.001, '向量数乘 Y 分量');
assertClose(vMul.z, 6, 0.001, '向量数乘 Z 分量');

console.log('\n⚖️ 测试4: 载荷计算算法验证');

function calculateTwoPointLoad(weight, position, point1, point2) {
  const totalDistance = Math.abs(point2 - point1);
  if (totalDistance === 0) return { point1Load: weight / 2, point2Load: weight / 2 };
  
  const distanceFromPoint1 = Math.abs(position - point1);
  const distanceFromPoint2 = Math.abs(point2 - position);
  
  const point1Load = weight * (distanceFromPoint2 / totalDistance);
  const point2Load = weight * (distanceFromPoint1 / totalDistance);
  
  return { point1Load, point2Load };
}

const test1 = calculateTwoPointLoad(100, 0, -5, 5);
assertClose(test1.point1Load, 50, 0.01, '中心位置 - 左吊点载荷');
assertClose(test1.point2Load, 50, 0.01, '中心位置 - 右吊点载荷');

const test2 = calculateTwoPointLoad(100, -5, -5, 5);
assertClose(test2.point1Load, 100, 0.01, '左端点位置 - 左吊点载荷');
assertClose(test2.point2Load, 0, 0.01, '左端点位置 - 右吊点载荷');

const test3 = calculateTwoPointLoad(100, 2.5, -5, 5);
assertClose(test3.point1Load, 25, 0.01, '1/4位置 - 左吊点载荷');
assertClose(test3.point2Load, 75, 0.01, '1/4位置 - 右吊点载荷');

const testSum = test3.point1Load + test3.point2Load;
assertClose(testSum, 100, 0.01, '载荷总和等于总重量');

console.log('\n🎯 测试5: 重心计算验证');

function calculateCenterOfGravity(devices) {
  let totalWeight = 0;
  let cogX = 0, cogY = 0, cogZ = 0;
  
  for (const device of devices) {
    const weight = device.weight || 0;
    totalWeight += weight;
    cogX += device.position.x * weight;
    cogY += device.position.y * weight;
    cogZ += device.position.z * weight;
  }
  
  if (totalWeight > 0) {
    cogX /= totalWeight;
    cogY /= totalWeight;
    cogZ /= totalWeight;
  }
  
  return { x: cogX, y: cogY, z: cogZ, totalWeight };
}

const devices1 = [
  { weight: 50, position: { x: -2, y: 6, z: 0 } },
  { weight: 50, position: { x: 2, y: 6, z: 0 } }
];
const cog1 = calculateCenterOfGravity(devices1);
assertClose(cog1.x, 0, 0.001, '对称分布重心 X');
assertClose(cog1.totalWeight, 100, 0.001, '总重量计算正确');

const devices2 = [
  { weight: 100, position: { x: 10, y: 0, z: 0 } }
];
const cog2 = calculateCenterOfGravity(devices2);
assertClose(cog2.x, 10, 0.001, '单点重心 X');

console.log('\n📦 测试6: 碰撞检测算法验证');

function checkBoxCollision(box1, box2) {
  return !(box1.max.x < box2.min.x || box1.min.x > box2.max.x ||
           box1.max.y < box2.min.y || box1.min.y > box2.max.y ||
           box1.max.z < box2.min.z || box1.min.z > box2.max.z);
}

function createBox(pos, size) {
  return {
    min: {
      x: pos.x - size.x / 2,
      y: pos.y - size.y / 2,
      z: pos.z - size.z / 2
    },
    max: {
      x: pos.x + size.x / 2,
      y: pos.y + size.y / 2,
      z: pos.z + size.z / 2
    }
  };
}

const box1 = createBox({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
const box2 = createBox({ x: 1, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
const box3 = createBox({ x: 10, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
const box4 = createBox({ x: 0, y: 3, z: 0 }, { x: 2, y: 2, z: 2 });

assert(checkBoxCollision(box1, box2) === true, '重叠的盒子应该碰撞');
assert(checkBoxCollision(box1, box3) === false, '远离的盒子不应该碰撞');
assert(checkBoxCollision(box1, box4) === false, 'Y轴分离的盒子不应该碰撞');

function getBoxDistance(box1, box2) {
  let dx = 0, dy = 0, dz = 0;
  
  if (box1.max.x < box2.min.x) dx = box2.min.x - box1.max.x;
  else if (box1.min.x > box2.max.x) dx = box1.min.x - box2.max.x;
  
  if (box1.max.y < box2.min.y) dy = box2.min.y - box1.max.y;
  else if (box1.min.y > box2.max.y) dy = box1.min.y - box2.max.y;
  
  if (box1.max.z < box2.min.z) dz = box2.min.z - box1.max.z;
  else if (box1.min.z > box2.max.z) dz = box1.min.z - box2.max.z;
  
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const dist1 = getBoxDistance(box1, box2);
assertClose(dist1, 0, 0.001, '重叠盒子距离为0');

const dist2 = getBoxDistance(box1, box3);
assertClose(dist2, 8, 0.001, '分离盒子距离计算正确');

console.log('\n📄 测试7: 示例数据模块验证');
const sampleScenesPath = path.join(projectRoot, 'src/data/SampleScenes.js');
const sampleScenesContent = fs.readFileSync(sampleScenesPath, 'utf-8');

assert(sampleScenesContent.includes('createBasicStageScene'), '包含基础舞台场景');
assert(sampleScenesContent.includes('createComplexConcertScene'), '包含演唱会场景');
assert(sampleScenesContent.includes('createOverloadWarningScene'), '包含超载警告场景');
assert(sampleScenesContent.includes('createCollisionTestScene'), '包含碰撞测试场景');

console.log('\n🔧 测试8: 模块导出验证');
const moduleFiles = [
  { path: 'src/models/SceneModel.js', exports: ['sceneManager'] },
  { path: 'src/engine/LoadCalculator.js', exports: ['loadCalculator'] },
  { path: 'src/engine/CollisionDetector.js', exports: ['collisionDetector'] },
  { path: 'src/renderer/ThreeRenderer.js', exports: ['threeRenderer'] },
  { path: 'src/ui/InteractionManager.js', exports: ['interactionManager'] },
  { path: 'src/storage/SceneStorage.js', exports: ['sceneStorage'] },
  { path: 'src/export/Exporter.js', exports: ['exporter'] },
  { path: 'src/data/SampleScenes.js', exports: ['sampleScenes'] }
];

function checkExport(content, exportName) {
  if (content.includes(`export const ${exportName}`)) return true;
  if (content.includes(`export let ${exportName}`)) return true;
  if (content.includes(`export var ${exportName}`)) return true;
  
  const exportBlockPattern = /export\s*\{([^}]*)\}/s;
  const match = content.match(exportBlockPattern);
  if (match) {
    const exports = match[1].split(',').map(e => e.trim());
    if (exports.includes(exportName)) return true;
  }
  
  return false;
}

for (const module of moduleFiles) {
  const modulePath = path.join(projectRoot, module.path);
  const content = fs.readFileSync(modulePath, 'utf-8');
  
  for (const exp of module.exports) {
    assert(checkExport(content, exp), 
      `模块 ${module.path} 导出 ${exp}`);
  }
}

console.log('\n🌐 测试9: HTML结构验证');
const htmlPath = path.join(projectRoot, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

assert(htmlContent.includes('<!DOCTYPE html>'), '包含DOCTYPE声明');
assert(htmlContent.includes('<title>吊点荷载沙盘'), '包含正确的页面标题');
assert(htmlContent.includes('canvas-container'), '包含画布容器');
assert(htmlContent.includes('three.js'), '包含Three.js引用');
assert(htmlContent.includes('src/main.js'), '包含主入口脚本');

console.log('\n🎨 测试10: CSS样式验证');
const cssPath = path.join(projectRoot, 'styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

assert(cssContent.includes('#app'), '包含应用容器样式');
assert(cssContent.includes('#canvas-container'), '包含画布容器样式');
assert(cssContent.includes('.status-ok'), '包含状态样式');
assert(cssContent.includes('.status-warning'), '包含警告样式');
assert(cssContent.includes('.status-error'), '包含错误样式');

console.log('\n========================================');
console.log('  测试完成');
console.log('========================================');
console.log(`\n📊 结果: ${passedTests} 通过, ${failedTests} 失败`);
console.log(`   总计: ${passedTests + failedTests} 个测试用例`);

if (failedTests > 0) {
  console.log('\n❌ 失败的测试:');
  for (const result of testResults.filter(r => r.status === 'FAIL')) {
    console.log(`   - ${result.message}`);
  }
  process.exit(1);
} else {
  console.log('\n✅ 所有测试通过!');
  process.exit(0);
}
