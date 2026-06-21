const fs = require('fs');
const path = require('path');

const ROOT = '/Users/lzy/pro/solo/workspaces/zy72058';

const storeContent = fs.readFileSync(path.join(ROOT, 'src/store/useStore.ts'), 'utf8');
const sceneContent = fs.readFileSync(path.join(ROOT, 'src/components/ThreeScene/Scene.tsx'), 'utf8');
const typesContent = fs.readFileSync(path.join(ROOT, 'src/types/index.ts'), 'utf8');
const exportContent = fs.readFileSync(path.join(ROOT, 'src/utils/export.ts'), 'utf8');

const checks = [
  ['包含匹配选择器 [data-engine*="three.js"]', storeContent.includes('data-engine*="three.js"')],
  ['精确匹配已移除', !storeContent.includes('data-engine="three.js"')],
  ['store ref 兜底 (threeCanvasRef)', storeContent.includes('threeCanvasRef')],
  ['WebGL context 查找', storeContent.includes('getContext')],
  ['Canvas onCreated 回调', sceneContent.includes('onCreated')],
  ['preserveDrawingBuffer: true', sceneContent.includes('preserveDrawingBuffer: true')],
  ['导出历史 exportHistory', storeContent.includes('exportHistory')],
  ['canvasEngine 字段', storeContent.includes('canvasEngine')],
  ['reason 字段', storeContent.includes('reason:')],
  ['ExportRecord 类型', typesContent.includes('ExportRecord')],
  ['toDataURL 调用', exportContent.includes('toDataURL')],
  ['requestAnimationFrame', exportContent.includes('requestAnimationFrame')],
  ['r160精确匹配应失败', !(/^three\.js$/.test('three.js r160'))],
  ['r160包含匹配应成功', /three\.js/.test('three.js r160')],
];

let allOk = true;
checks.forEach(([name, result]) => {
  const status = result ? '✅' : '❌';
  console.log(`${status} ${name}`);
  if (!result) allOk = false;
});

console.log('\n' + (allOk ? '✅ ALL PASSED' : '❌ SOME FAILED'));
process.exit(allOk ? 0 : 1);
