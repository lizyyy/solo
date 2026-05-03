import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { RuleParser } from './rules';
import { FileScanner } from './scanner';
import { FileExecutor } from './executor';
import { UndoManager } from './undo';
import { ReportGenerator } from './report';
import { ArchiveOptions, ReportFormat, ReportData } from './types';

describe('File Archiver Integration', () => {
  let tempDir: string;
  let downloadsDir: string;
  let rulesDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-archiver-integration-'));
    downloadsDir = path.join(tempDir, 'Downloads');
    rulesDir = path.join(tempDir, 'rules');

    await fs.ensureDir(downloadsDir);
    await fs.ensureDir(rulesDir);

    const testFiles = [
      { name: 'invoice_2024.pdf', content: 'PDF content invoice' },
      { name: 'report_2024.docx', content: 'Word document' },
      { name: 'screenshot_001.png', content: 'PNG image' },
      { name: 'screenshot_002.jpg', content: 'JPG image' },
      { name: 'installer_v1.0.dmg', content: 'DMG installer' },
      { name: 'installer_v2.0.exe', content: 'EXE installer' },
      { name: 'notes.txt', content: 'Text notes' },
      { name: 'backup_2024.zip', content: 'ZIP archive' },
      { name: 'presentation.pptx', content: 'PowerPoint' },
      { name: 'unknown_type.xyz', content: 'Unknown' }
    ];

    for (const file of testFiles) {
      await fs.writeFile(path.join(downloadsDir, file.name), file.content, 'utf-8');
    }

    const duplicateContent = 'This is duplicate content';
    await fs.writeFile(path.join(downloadsDir, 'duplicate_1.txt'), duplicateContent, 'utf-8');
    await fs.writeFile(path.join(downloadsDir, 'duplicate_2.txt'), duplicateContent, 'utf-8');
  });

  afterEach(async () => {
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('规则解析', () => {
    it('应该解析 YAML 规则文件', async () => {
      const yamlContent = `
version: "1.0"
defaultConflictStrategy: rename
defaultOperation: move
rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents/PDF"
  - name: "图片文件"
    condition:
      extensions:
        - png
        - jpg
        - jpeg
    destination: "./Images"
  - name: "安装包"
    condition:
      extensions:
        - dmg
        - exe
        - pkg
    destination: "./Installers"
`;

      const rulesPath = path.join(rulesDir, 'rules.yaml');
      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      const parser = new RuleParser();
      const config = await parser.parseFile(rulesPath);

      expect(config.version).toBe('1.0');
      expect(config.rules).toHaveLength(3);
      expect(config.defaultConflictStrategy).toBe('rename');
    });
  });

  describe('文件扫描', () => {
    it('应该扫描目录并匹配规则', async () => {
      const yamlContent = `
version: "1.0"
rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents/PDF"
  - name: "图片文件"
    condition:
      extensions:
        - png
        - jpg
    destination: "./Images"
  - name: "安装包"
    condition:
      extensions:
        - dmg
        - exe
    destination: "./Installers"
`;

      const rulesPath = path.join(rulesDir, 'rules.yaml');
      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      const parser = new RuleParser();
      const config = await parser.parseFile(rulesPath);
      const scanner = new FileScanner(config);

      const result = await scanner.scan(downloadsDir, {
        calculateHash: true,
        verbose: false
      });

      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.matchedFiles).toHaveLength(5);
      expect(result.unmatchedFiles).toHaveLength(7);

      const pdfFiles = result.matchedFiles.filter(f => f.ruleName === 'PDF文档');
      expect(pdfFiles).toHaveLength(1);
      expect(pdfFiles[0].name).toBe('invoice_2024.pdf');

      const imageFiles = result.matchedFiles.filter(f => f.ruleName === '图片文件');
      expect(imageFiles).toHaveLength(2);

      const installerFiles = result.matchedFiles.filter(f => f.ruleName === '安装包');
      expect(installerFiles).toHaveLength(2);
    });

    it('应该检测重复文件', async () => {
      const yamlContent = `
version: "1.0"
rules:
  - name: "文本文件"
    condition:
      extensions:
        - txt
    destination: "./Text"
`;

      const rulesPath = path.join(rulesDir, 'rules.yaml');
      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      const parser = new RuleParser();
      const config = await parser.parseFile(rulesPath);
      const scanner = new FileScanner(config);

      const result = await scanner.scan(downloadsDir, {
        calculateHash: true,
        verbose: false
      });

      const duplicateGroups = result.duplicateFiles.filter(g => g.files.length > 1);
      expect(duplicateGroups.length).toBeGreaterThan(0);
    });
  });

  describe('dry-run 模式', () => {
    it('应该预览操作而不实际执行', async () => {
      const yamlContent = `
version: "1.0"
rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents/PDF"
`;

      const rulesPath = path.join(rulesDir, 'rules.yaml');
      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      const parser = new RuleParser();
      const config = await parser.parseFile(rulesPath);
      const scanner = new FileScanner(config);
      const executor = new FileExecutor(scanner);

      const options: ArchiveOptions = {
        dryRun: true,
        operation: 'move',
        conflictStrategy: 'rename',
        calculateHash: true,
        verbose: false
      };

      const result = await executor.execute(downloadsDir, options);

      expect(result.successfulOperations).toBe(0);
      expect(result.manifest).toBeUndefined();

      const pdfFile = path.join(downloadsDir, 'invoice_2024.pdf');
      expect(await fs.pathExists(pdfFile)).toBe(true);
    });
  });

  describe('执行归档', () => {
    it('应该执行移动操作并生成 manifest', async () => {
      const yamlContent = `
version: "1.0"
rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents/PDF"
`;

      const rulesPath = path.join(rulesDir, 'rules.yaml');
      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      const manifestPath = path.join(tempDir, 'manifest.json');

      const parser = new RuleParser();
      const config = await parser.parseFile(rulesPath);
      const scanner = new FileScanner(config);
      const executor = new FileExecutor(scanner);

      const options: ArchiveOptions = {
        dryRun: false,
        operation: 'move',
        conflictStrategy: 'rename',
        outputManifest: manifestPath,
        calculateHash: true,
        verbose: false
      };

      const result = await executor.execute(downloadsDir, options);

      expect(result.successfulOperations).toBe(1);
      expect(result.manifest).toBeDefined();
      expect(result.manifest?.entries).toHaveLength(1);

      const originalPdfPath = path.join(downloadsDir, 'invoice_2024.pdf');
      expect(await fs.pathExists(originalPdfPath)).toBe(false);

      const newPdfPath = path.join(downloadsDir, 'Documents', 'PDF', 'invoice_2024.pdf');
      expect(await fs.pathExists(newPdfPath)).toBe(true);

      expect(await fs.pathExists(manifestPath)).toBe(true);
    });

    it('应该执行复制操作', async () => {
      const yamlContent = `
version: "1.0"
rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents/PDF"
`;

      const rulesPath = path.join(rulesDir, 'rules.yaml');
      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      const parser = new RuleParser();
      const config = await parser.parseFile(rulesPath);
      const scanner = new FileScanner(config);
      const executor = new FileExecutor(scanner);

      const options: ArchiveOptions = {
        dryRun: false,
        operation: 'copy',
        conflictStrategy: 'rename',
        calculateHash: true,
        verbose: false
      };

      const result = await executor.execute(downloadsDir, options);

      expect(result.successfulOperations).toBe(1);

      const originalPdfPath = path.join(downloadsDir, 'invoice_2024.pdf');
      expect(await fs.pathExists(originalPdfPath)).toBe(true);

      const newPdfPath = path.join(downloadsDir, 'Documents', 'PDF', 'invoice_2024.pdf');
      expect(await fs.pathExists(newPdfPath)).toBe(true);
    });
  });

  describe('冲突处理', () => {
    it('应该使用 rename 策略处理冲突', async () => {
      const yamlContent = `
version: "1.0"
excludePatterns:
  - "Documents/**"
rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents/PDF"
`;

      const rulesPath = path.join(rulesDir, 'rules.yaml');
      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      const targetDir = path.join(downloadsDir, 'Documents', 'PDF');
      await fs.ensureDir(targetDir);
      await fs.writeFile(path.join(targetDir, 'invoice_2024.pdf'), 'Existing content', 'utf-8');

      const parser = new RuleParser();
      const config = await parser.parseFile(rulesPath);
      const scanner = new FileScanner(config);
      const executor = new FileExecutor(scanner);

      const options: ArchiveOptions = {
        dryRun: false,
        operation: 'move',
        conflictStrategy: 'rename',
        calculateHash: true,
        verbose: false
      };

      const result = await executor.execute(downloadsDir, options);

      expect(result.successfulOperations).toBe(1);

      const renamedPath = path.join(targetDir, 'invoice_2024_1.pdf');
      expect(await fs.pathExists(renamedPath)).toBe(true);
    });

    it('应该使用 skip 策略跳过冲突文件', async () => {
      const yamlContent = `
version: "1.0"
excludePatterns:
  - "Documents/**"
rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents/PDF"
`;

      const rulesPath = path.join(rulesDir, 'rules.yaml');
      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      const targetDir = path.join(downloadsDir, 'Documents', 'PDF');
      await fs.ensureDir(targetDir);
      await fs.writeFile(path.join(targetDir, 'invoice_2024.pdf'), 'Existing content', 'utf-8');

      const parser = new RuleParser();
      const config = await parser.parseFile(rulesPath);
      const scanner = new FileScanner(config);
      const executor = new FileExecutor(scanner);

      const options: ArchiveOptions = {
        dryRun: false,
        operation: 'move',
        conflictStrategy: 'skip',
        calculateHash: true,
        verbose: false
      };

      const result = await executor.execute(downloadsDir, options);

      expect(result.skippedOperations).toBe(1);

      const originalPath = path.join(downloadsDir, 'invoice_2024.pdf');
      expect(await fs.pathExists(originalPath)).toBe(true);
    });
  });

  describe('撤销操作', () => {
    it('应该撤销之前的归档操作', async () => {
      const yamlContent = `
version: "1.0"
rules:
  - name: "PDF文档"
    condition:
      extensions:
        - pdf
    destination: "./Documents/PDF"
`;

      const rulesPath = path.join(rulesDir, 'rules.yaml');
      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      const manifestPath = path.join(tempDir, 'manifest.json');

      const parser = new RuleParser();
      const config = await parser.parseFile(rulesPath);
      const scanner = new FileScanner(config);
      const executor = new FileExecutor(scanner);

      const options: ArchiveOptions = {
        dryRun: false,
        operation: 'move',
        conflictStrategy: 'rename',
        outputManifest: manifestPath,
        calculateHash: true,
        verbose: false
      };

      await executor.execute(downloadsDir, options);

      const originalPdfPath = path.join(downloadsDir, 'invoice_2024.pdf');
      expect(await fs.pathExists(originalPdfPath)).toBe(false);

      const undoManager = new UndoManager();
      const manifest = await undoManager.loadManifest(manifestPath);
      const undoResult = await undoManager.undo(manifest, false);

      expect(undoResult.successfulRestores).toBe(1);
      expect(await fs.pathExists(originalPdfPath)).toBe(true);

      const newPdfPath = path.join(downloadsDir, 'Documents', 'PDF', 'invoice_2024.pdf');
      expect(await fs.pathExists(newPdfPath)).toBe(false);
    });
  });

  describe('报告生成', () => {
    it('应该生成 JSON 报告', async () => {
      const reportGenerator = new ReportGenerator();
      
      const reportData: ReportData = {
        type: 'scan',
        timestamp: new Date().toISOString(),
        scanResult: {
          totalFiles: 10,
          matchedFiles: [],
          unmatchedFiles: [],
          duplicateFiles: [],
          potentialConflicts: []
        }
      };

      const outputPath = path.join(tempDir, 'report.json');
      const content = await reportGenerator.generate(
        reportData,
        'json',
        outputPath
      );

      expect(await fs.pathExists(outputPath)).toBe(true);
      
      const savedContent = await fs.readFile(outputPath, 'utf-8');
      const parsed = JSON.parse(savedContent);
      expect(parsed.type).toBe('scan');
      expect(parsed.scanResult.totalFiles).toBe(10);
    });

    it('应该生成 Markdown 报告', async () => {
      const reportGenerator = new ReportGenerator();
      
      const reportData: ReportData = {
        type: 'execution',
        timestamp: new Date().toISOString(),
        executionResult: {
          totalFiles: 10,
          matchedFiles: [],
          unmatchedFiles: [],
          duplicateFiles: [],
          potentialConflicts: [],
          successfulOperations: 5,
          failedOperations: 0,
          skippedOperations: 0,
          errors: []
        }
      };

      const content = await reportGenerator.generate(reportData, 'markdown');
      
      expect(content).toContain('# 文件归档报告');
      expect(content).toContain('执行结果');
    });

    it('应该生成 HTML 报告', async () => {
      const reportGenerator = new ReportGenerator();
      
      const reportData: ReportData = {
        type: 'execution',
        timestamp: new Date().toISOString(),
        executionResult: {
          totalFiles: 10,
          matchedFiles: [],
          unmatchedFiles: [],
          duplicateFiles: [],
          potentialConflicts: [],
          successfulOperations: 5,
          failedOperations: 0,
          skippedOperations: 0,
          errors: []
        }
      };

      const content = await reportGenerator.generate(reportData, 'html');
      
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<html');
      expect(content).toContain('文件归档报告');
    });
  });
});
