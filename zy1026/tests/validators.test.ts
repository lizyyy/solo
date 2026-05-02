import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../src/config';
import { ImageValidator } from '../src/validators/image-validator';
import { LinkValidator } from '../src/validators/link-validator';
import { Config, SnapshotsManifest, ExtractedLink } from '../src/types';

describe('ConfigManager', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docguard-test-'));
    configPath = path.join(tempDir, 'docguard.config.json');
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should return default config when no file exists', () => {
    const manager = new ConfigManager(configPath);
    const config = manager.getConfig();

    expect(config.docsDir).toBe('./docs');
    expect(config.external.enabled).toBe(true);
    expect(config.images.enabled).toBe(true);
  });

  it('should load and merge user config', () => {
    const userConfig = {
      docsDir: './custom-docs',
      external: {
        concurrency: 10
      }
    };
    fs.writeFileSync(configPath, JSON.stringify(userConfig), 'utf-8');

    const manager = new ConfigManager(configPath);
    const config = manager.getConfig();

    expect(config.docsDir).toBe('./custom-docs');
    expect(config.external.concurrency).toBe(10);
    expect(config.external.enabled).toBe(true);
  });

  it('should initialize config file', () => {
    ConfigManager.initConfig(configPath);

    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.docsDir).toBe('./docs');
  });

  it('should update and save config', () => {
    ConfigManager.initConfig(configPath);
    const manager = new ConfigManager(configPath);

    manager.updateConfig({
      docsDir: './new-docs'
    });
    manager.saveConfig();

    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.docsDir).toBe('./new-docs');
  });
});

describe('ImageValidator', () => {
  let tempDir: string;
  let testDir: string;
  let config: Config;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docguard-test-'));
    testDir = path.join(tempDir, 'docs');
    fs.mkdirSync(testDir, { recursive: true });

    config = {
      ...ConfigManager.getDefaultConfig(),
      docsDir: testDir,
      images: {
        enabled: true,
        checkMtime: true,
        checkHash: false
      }
    };
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should detect missing images', () => {
    const validator = new ImageValidator(config);
    const link: ExtractedLink = {
      type: 'image',
      raw: '![Missing](./missing.png)',
      href: './missing.png',
      line: 1,
      column: 1
    };

    const result = validator.validate(link, path.join(testDir, 'test.md'));

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].message).toContain('不存在');
  });

  it('should pass valid existing images', () => {
    const imagePath = path.join(testDir, 'images', 'valid.png');
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, 'fake image content', 'utf-8');

    const validator = new ImageValidator(config);
    const link: ExtractedLink = {
      type: 'image',
      raw: '![Valid](./images/valid.png)',
      href: './images/valid.png',
      line: 1,
      column: 1
    };

    const result = validator.validate(link, path.join(testDir, 'test.md'));

    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('should skip data URI images', () => {
    const validator = new ImageValidator(config);
    const link: ExtractedLink = {
      type: 'image',
      raw: '![Data](data:image/png;base64,xxx)',
      href: 'data:image/png;base64,xxx',
      line: 1,
      column: 1
    };

    const result = validator.validate(link, path.join(testDir, 'test.md'));

    expect(result.valid).toBe(true);
  });

  it('should skip reference-style images', () => {
    const validator = new ImageValidator(config);
    const link: ExtractedLink = {
      type: 'image',
      raw: '![Ref][image-ref]',
      href: '[image-ref]',
      line: 1,
      column: 1
    };

    const result = validator.validate(link, path.join(testDir, 'test.md'));

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].message).toContain('跳过');
  });

  describe('with snapshots manifest', () => {
    let manifestPath: string;

    beforeEach(() => {
      manifestPath = path.join(tempDir, 'snapshots.manifest.json');
      config.images.manifestPath = manifestPath;
    });

    it('should detect expired images based on mtime', () => {
      const imagePath = path.join(testDir, 'images', 'old.png');
      fs.mkdirSync(path.dirname(imagePath), { recursive: true });
      fs.writeFileSync(imagePath, 'content', 'utf-8');

      const oldMtime = Date.now() - 1000 * 60 * 60 * 24 * 30;
      const manifest: SnapshotsManifest = {
        version: '1.0.0',
        snapshots: {
          './images/old.png': {
            mtime: Date.now() + 1000 * 60 * 60,
            lastUpdated: new Date().toISOString(),
            note: 'Expected newer mtime'
          }
        }
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf-8');
      fs.utimesSync(imagePath, oldMtime / 1000, oldMtime / 1000);

      const validator = new ImageValidator(config);
      const link: ExtractedLink = {
        type: 'image',
        raw: '![Old](./images/old.png)',
        href: './images/old.png',
        line: 1,
        column: 1
      };

      const result = validator.validate(link, path.join(testDir, 'test.md'));

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('过期');
    });
  });
});

describe('LinkValidator', () => {
  let tempDir: string;
  let testDir: string;
  let config: Config;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docguard-test-'));
    testDir = path.join(tempDir, 'docs');
    fs.mkdirSync(testDir, { recursive: true });

    config = {
      ...ConfigManager.getDefaultConfig(),
      docsDir: testDir
    };
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('should detect missing local files', () => {
    const validator = new LinkValidator(config);
    const link: ExtractedLink = {
      type: 'local',
      raw: '[Missing](./missing.md)',
      href: './missing.md',
      line: 1,
      column: 1
    };

    const result = validator.validateLocalLink(link, path.join(testDir, 'test.md'));

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBe(1);
  });

  it('should pass valid existing files', () => {
    const targetPath = path.join(testDir, 'target.md');
    fs.writeFileSync(targetPath, '# Target', 'utf-8');

    const validator = new LinkValidator(config);
    const link: ExtractedLink = {
      type: 'local',
      raw: '[Target](./target.md)',
      href: './target.md',
      line: 1,
      column: 1
    };

    const result = validator.validateLocalLink(link, path.join(testDir, 'test.md'));

    expect(result.valid).toBe(true);
  });

  it('should resolve files without extension', () => {
    const targetPath = path.join(testDir, 'target.md');
    fs.writeFileSync(targetPath, '# Target', 'utf-8');

    const validator = new LinkValidator(config);
    const link: ExtractedLink = {
      type: 'local',
      raw: '[Target](./target)',
      href: './target',
      line: 1,
      column: 1
    };

    const result = validator.validateLocalLink(link, path.join(testDir, 'test.md'));

    expect(result.valid).toBe(true);
  });

  describe('Anchor Validation', () => {
    it('should validate existing anchors', () => {
      const sourcePath = path.join(testDir, 'test.md');
      fs.writeFileSync(sourcePath, `
# Title

## Section 1

Content

## Section 2
`, 'utf-8');

      const validator = new LinkValidator(config);
      const link: ExtractedLink = {
        type: 'anchor',
        raw: '[Section 1](#section-1)',
        href: '#section-1',
        line: 1,
        column: 1
      };

      const result = validator.validateAnchor(link, sourcePath, 'section-1');

      expect(result.valid).toBe(true);
    });

    it('should detect missing anchors', () => {
      const sourcePath = path.join(testDir, 'test.md');
      fs.writeFileSync(sourcePath, `
# Title

## Section 1
`, 'utf-8');

      const validator = new LinkValidator(config);
      const link: ExtractedLink = {
        type: 'anchor',
        raw: '[Missing](#non-existent)',
        href: '#non-existent',
        line: 1,
        column: 1
      };

      const result = validator.validateAnchor(link, sourcePath, 'non-existent');

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBe(1);
    });

    it('should detect duplicate anchors when not allowed', () => {
      const sourcePath = path.join(testDir, 'test.md');
      fs.writeFileSync(sourcePath, `
# Title

## Section

## Section
`, 'utf-8');

      config.anchors.allowDuplicates = false;
      const validator = new LinkValidator(config);
      const link: ExtractedLink = {
        type: 'anchor',
        raw: '[Section](#section)',
        href: '#section',
        line: 1,
        column: 1
      };

      const result = validator.validateAnchor(link, sourcePath, 'section');

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.message.includes('重复'))).toBe(true);
    });

    it('should validate anchors in other files', () => {
      const targetPath = path.join(testDir, 'other.md');
      fs.writeFileSync(targetPath, `
# Other Doc

## Target Section
`, 'utf-8');

      const sourcePath = path.join(testDir, 'test.md');
      fs.writeFileSync(sourcePath, '# Test', 'utf-8');

      const validator = new LinkValidator(config);
      const link: ExtractedLink = {
        type: 'local',
        raw: '[Target](./other.md#target-section)',
        href: './other.md#target-section',
        line: 1,
        column: 1
      };

      const result = validator.validateLocalLink(link, sourcePath);

      expect(result.valid).toBe(true);
    });
  });

  describe('Special Links', () => {
    it('should skip mailto links', () => {
      const validator = new LinkValidator(config);
      const link: ExtractedLink = {
        type: 'local',
        raw: '[Email](mailto:test@example.com)',
        href: 'mailto:test@example.com',
        line: 1,
        column: 1
      };

      const result = validator.validateLocalLink(link, path.join(testDir, 'test.md'));

      expect(result.valid).toBe(true);
    });

    it('should skip tel links', () => {
      const validator = new LinkValidator(config);
      const link: ExtractedLink = {
        type: 'local',
        raw: '[Phone](tel:+1234567890)',
        href: 'tel:+1234567890',
        line: 1,
        column: 1
      };

      const result = validator.validateLocalLink(link, path.join(testDir, 'test.md'));

      expect(result.valid).toBe(true);
    });

    it('should skip reference-style links', () => {
      const validator = new LinkValidator(config);
      const link: ExtractedLink = {
        type: 'local',
        raw: '[Ref][link-ref]',
        href: '[link-ref]',
        line: 1,
        column: 1
      };

      const result = validator.validateLocalLink(link, path.join(testDir, 'test.md'));

      expect(result.valid).toBe(true);
    });
  });
});
