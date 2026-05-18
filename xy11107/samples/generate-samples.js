const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');

const samplesDir = __dirname;
const imagesDir = path.join(samplesDir, 'images');

const photoTypes = [
  '卧室',
  '卫生间', 
  '厨房',
  '客厅',
  '阳台'
];

const managers = ['张三', '李四', '王五', '赵六'];
const homestayIds = ['MS001', 'MS002', 'MS003', 'MS004'];

function generateFilename(index, type, daysAgo = 0) {
  const manager = managers[index % managers.length];
  const homestayId = homestayIds[index % homestayIds.length];
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  return `${homestayId}_${manager}_${dateStr}_${type}.jpg`;
}

function createMockJpg(filepath) {
  const header = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
  const body = Buffer.from('This is a mock JPG file for homestay cleaning inspection sample');
  const footer = Buffer.from([0xFF, 0xD9]);
  
  fs.writeFileSync(filepath, Buffer.concat([header, body, footer]));
}

async function generateSamples() {
  fs.ensureDirSync(imagesDir);

  console.log('生成正常照片样本（最近3天内）...');
  for (let i = 0; i < 5; i++) {
    const filename = generateFilename(i, photoTypes[i % photoTypes.length], Math.floor(Math.random() * 3));
    const filepath = path.join(imagesDir, filename);
    createMockJpg(filepath);
    console.log(`  ✓ ${filename}`);
  }

  console.log('\n生成时间错位照片样本（超过7天）...');
  for (let i = 0; i < 3; i++) {
    const filename = generateFilename(i + 10, photoTypes[i % photoTypes.length], 10 + Math.floor(Math.random() * 20));
    const filepath = path.join(imagesDir, '异常_' + filename);
    createMockJpg(filepath);
    console.log(`  ⚠ ${filename} (时间错位模拟)`);
  }

  console.log('\n生成压缩包嵌套样本...');
  const nestedDir = path.join(samplesDir, 'nested');
  fs.ensureDirSync(nestedDir);
  
  const innerZip = new AdmZip();
  for (let i = 0; i < 2; i++) {
    const filename = generateFilename(i + 20, photoTypes[i], 1);
    const tempPath = path.join(nestedDir, filename);
    createMockJpg(tempPath);
    innerZip.addLocalFile(tempPath);
    fs.removeSync(tempPath);
  }
  const innerZipPath = path.join(nestedDir, '内层压缩包.zip');
  innerZip.writeZip(innerZipPath);
  console.log(`  ✓ 创建内层压缩包`);

  const outerZip = new AdmZip();
  outerZip.addLocalFile(innerZipPath);
  
  for (let i = 0; i < 2; i++) {
    const filename = generateFilename(i + 30, photoTypes[i + 2], 2);
    const tempPath = path.join(nestedDir, filename);
    createMockJpg(tempPath);
    outerZip.addLocalFile(tempPath);
    fs.removeSync(tempPath);
  }
  
  const outerZipPath = path.join(samplesDir, '民宿管家5月保洁照片.zip');
  outerZip.writeZip(outerZipPath);
  fs.removeSync(nestedDir);
  console.log(`  ✓ 创建嵌套压缩包: ${path.basename(outerZipPath)}`);

  console.log('\n✅ 样本数据生成完成！');
  console.log(`\n使用方法：`);
  console.log(`  1. 预览: node src/index.js preview samples/民宿管家5月保洁照片.zip`);
  console.log(`  2. 执行: node src/index.js run samples/民宿管家5月保洁照片.zip`);
  console.log(`  3. 报告: node src/index.js report`);
}

generateSamples().catch(console.error);
