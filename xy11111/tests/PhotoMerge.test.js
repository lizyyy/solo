const fs = require('fs');
const path = require('path');
const PhotoMerge = require('../src/PhotoMerge');

describe('PhotoMerge - 摄影工作室选片合并测试', () => {
  const testDir = path.resolve('tests/temp');
  const config = {
    sourceDirs: {
      '精修': path.join(testDir, '精修'),
      '原片': path.join(testDir, '原片'),
      '花絮': path.join(testDir, '花絮')
    },
    outputDir: path.join(testDir, 'output'),
    logDir: path.join(testDir, 'logs'),
    rules: {
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.cr2', '.nef', '.arw'],
      normalizeExtension: true,
      duplicateStrategy: 'rename',
      skipProcessed: true,
      maxFilenameLength: 100
    },
    filenamePattern: '{拍摄日期}_{客户姓名}_{照片类型}_{序号}{扩展名}',
    '客户信息': {
      '拍摄日期': '20240515',
      '客户姓名': '张三_李四',
      '套餐类型': '婚纱摄影A套系'
    }
  };

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    Object.values(config.sourceDirs).forEach(dir => {
      fs.mkdirSync(dir, { recursive: true });
    });
    fs.mkdirSync(config.outputDir, { recursive: true });
    fs.mkdirSync(config.logDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('1. 空目录处理 - 源目录为空时应正常运行', () => {
    const merger = new PhotoMerge(config, { preview: false });
    const files = merger.scanSourceDirs();
    
    expect(files.length).toBe(0);
    
    const { successCount, skipCount, total } = merger.buildPlan();
    expect(total).toBe(0);
    expect(successCount).toBe(0);
    expect(skipCount).toBe(0);
  });

  test('2. 扩展名大小写规范化 - JPG应转为小写jpg', () => {
    fs.writeFileSync(path.join(config.sourceDirs['精修'], 'TEST123.JPG'), '');
    fs.writeFileSync(path.join(config.sourceDirs['精修'], 'TEST456.PNG'), '');
    
    const merger = new PhotoMerge(config, { preview: false });
    merger.buildPlan();
    
    const copyPlans = merger.plan.filter(p => p.action === 'copy');
    expect(copyPlans.length).toBe(2);
    
    copyPlans.forEach(plan => {
      const ext = path.extname(plan.target);
      expect(ext).toBe(ext.toLowerCase());
    });
  });

  test('3. 跳过非照片文件 - .db和.txt文件应被跳过', () => {
    fs.writeFileSync(path.join(config.sourceDirs['原片'], 'Thumbs.db'), '');
    fs.writeFileSync(path.join(config.sourceDirs['原片'], '备注.txt'), '');
    fs.writeFileSync(path.join(config.sourceDirs['原片'], 'valid_photo.jpg'), '');
    
    const merger = new PhotoMerge(config, { preview: false });
    merger.buildPlan();
    
    const skipPlans = merger.plan.filter(p => p.action === 'skip');
    const copyPlans = merger.plan.filter(p => p.action === 'copy');
    
    expect(skipPlans.length).toBe(2);
    expect(copyPlans.length).toBe(1);
  });

  test('4. 重复文件名处理 - 目标文件已存在时应自动重命名', () => {
    const sourceFile = path.join(config.sourceDirs['精修'], 'test.jpg');
    fs.writeFileSync(sourceFile, 'source content');
    
    const targetFile = path.join(config.outputDir, '20240515_张三_李四_精修_0001.jpg');
    fs.writeFileSync(targetFile, 'existing content');
    
    const merger = new PhotoMerge(config, { preview: false });
    merger.buildPlan();
    
    const copyPlans = merger.plan.filter(p => p.action === 'copy');
    expect(copyPlans.length).toBe(1);
    expect(copyPlans[0].renamed).toBe(true);
    expect(path.basename(copyPlans[0].target)).toBe('20240515_张三_李四_精修_0001_1.jpg');
  });

  test('5. 可复跑机制 - 已处理文件应被跳过', () => {
    fs.writeFileSync(path.join(config.sourceDirs['精修'], 'photo1.jpg'), '');
    fs.writeFileSync(path.join(config.sourceDirs['精修'], 'photo2.jpg'), '');
    
    const merger1 = new PhotoMerge(config, { preview: false });
    merger1.buildPlan();
    merger1.executePlan();
    
    expect(fs.readdirSync(config.outputDir).length).toBe(2);
    
    fs.writeFileSync(path.join(config.sourceDirs['精修'], 'photo3.jpg'), '');
    
    const merger2 = new PhotoMerge(config, { preview: false });
    merger2.buildPlan();
    
    const skipPlans = merger2.plan.filter(p => p.action === 'skip');
    const copyPlans = merger2.plan.filter(p => p.action === 'copy');
    
    expect(skipPlans.length).toBe(2);
    expect(copyPlans.length).toBe(1);
  });

  test('6. 日志记录 - 执行后应生成详细日志文件', () => {
    fs.writeFileSync(path.join(config.sourceDirs['精修'], 'test.jpg'), '');
    
    const merger = new PhotoMerge(config, { preview: false });
    merger.buildPlan();
    merger.executePlan();
    const logPath = merger.saveExecutionLog();
    
    expect(fs.existsSync(logPath)).toBe(true);
    
    const logData = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    expect(logData.summary.total).toBe(1);
    expect(logData.summary.copied).toBe(1);
    expect(logData.mode).toBe('run');
  });

  test('7. 多目录合并 - 精修、原片、花絮应合并到同一输出目录', () => {
    fs.writeFileSync(path.join(config.sourceDirs['精修'], 'retouched.jpg'), '');
    fs.writeFileSync(path.join(config.sourceDirs['原片'], 'raw.CR2'), '');
    fs.writeFileSync(path.join(config.sourceDirs['花絮'], 'behind.jpg'), '');
    
    const merger = new PhotoMerge(config, { preview: false });
    merger.buildPlan();
    
    const copyPlans = merger.plan.filter(p => p.action === 'copy');
    expect(copyPlans.length).toBe(3);
    
    const types = copyPlans.map(p => p.photoType);
    expect(types).toContain('精修');
    expect(types).toContain('原片');
    expect(types).toContain('花絮');
  });

  test('8. 预览标记 - 预览模式应正确记录', () => {
    fs.writeFileSync(path.join(config.sourceDirs['精修'], 'test.jpg'), '');
    
    const merger = new PhotoMerge(config, { preview: true });
    merger.buildPlan();
    
    const beforeCount = fs.readdirSync(config.outputDir).length;
    
    expect(beforeCount).toBe(0);
    expect(merger.isPreviewMode).toBe(true);
  });

  test('9. 序号补零 - 文件名序号应为4位补零格式', () => {
    for (let i = 0; i < 15; i++) {
      fs.writeFileSync(path.join(config.sourceDirs['精修'], `photo${i}.jpg`), '');
    }
    
    const merger = new PhotoMerge(config, { preview: false });
    merger.buildPlan();
    
    const copyPlans = merger.plan.filter(p => p.action === 'copy');
    expect(copyPlans.length).toBe(15);
    
    copyPlans.forEach(plan => {
      const basename = path.basename(plan.target);
      const match = basename.match(/_(\d{4})\.jpg$/);
      expect(match).not.toBeNull();
      expect(match[1].length).toBe(4);
    });
  });
});
