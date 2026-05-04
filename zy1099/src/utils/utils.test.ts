import * as path from 'path';
import {
  getFileType,
  isExternalLink,
  isAnchorLink,
  slugify,
  isDangerousCode,
  calculateRiskLevel,
  calculateScore,
  formatDuration,
  normalizePath,
  resolveRelativeLink,
} from './index';

describe('utils', () => {
  describe('getFileType', () => {
    it('should correctly identify markdown files', () => {
      expect(getFileType('test.md')).toBe('markdown');
      expect(getFileType('test.markdown')).toBe('markdown');
      expect(getFileType('path/to/test.MD')).toBe('markdown');
    });

    it('should correctly identify HTML files', () => {
      expect(getFileType('test.html')).toBe('html');
      expect(getFileType('test.htm')).toBe('html');
    });

    it('should correctly identify image files', () => {
      expect(getFileType('test.jpg')).toBe('image');
      expect(getFileType('test.jpeg')).toBe('image');
      expect(getFileType('test.png')).toBe('image');
      expect(getFileType('test.gif')).toBe('image');
      expect(getFileType('test.svg')).toBe('image');
      expect(getFileType('test.webp')).toBe('image');
    });

    it('should correctly identify attachment files', () => {
      expect(getFileType('test.pdf')).toBe('attachment');
      expect(getFileType('test.doc')).toBe('attachment');
      expect(getFileType('test.docx')).toBe('attachment');
      expect(getFileType('test.zip')).toBe('attachment');
    });

    it('should correctly identify code files', () => {
      expect(getFileType('test.js')).toBe('code');
      expect(getFileType('test.ts')).toBe('code');
      expect(getFileType('test.py')).toBe('code');
      expect(getFileType('test.sh')).toBe('code');
      expect(getFileType('test.json')).toBe('code');
    });

    it('should return "other" for unknown file types', () => {
      expect(getFileType('test.xyz')).toBe('other');
      expect(getFileType('test.unknown')).toBe('other');
    });
  });

  describe('isExternalLink', () => {
    it('should return true for http links', () => {
      expect(isExternalLink('http://example.com')).toBe(true);
      expect(isExternalLink('https://example.com')).toBe(true);
    });

    it('should return true for mailto and tel links', () => {
      expect(isExternalLink('mailto:test@example.com')).toBe(true);
      expect(isExternalLink('tel:+123456789')).toBe(true);
    });

    it('should return false for internal links', () => {
      expect(isExternalLink('test.md')).toBe(false);
      expect(isExternalLink('./test.md')).toBe(false);
      expect(isExternalLink('../test.md')).toBe(false);
      expect(isExternalLink('/path/to/test.md')).toBe(false);
    });

    it('should return false for anchor links', () => {
      expect(isExternalLink('#section')).toBe(false);
    });
  });

  describe('isAnchorLink', () => {
    it('should return true for anchor links', () => {
      expect(isAnchorLink('#section')).toBe(true);
      expect(isAnchorLink('#my-section')).toBe(true);
    });

    it('should return false for other links', () => {
      expect(isAnchorLink('test.md')).toBe(false);
      expect(isAnchorLink('http://example.com')).toBe(false);
      expect(isAnchorLink('./test.md#section')).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('should normalize paths', () => {
      expect(normalizePath('path\\to\\file')).toBe('path/to/file');
      expect(normalizePath('./path/./to/../file')).toBe('path/file');
    });
  });

  describe('resolveRelativeLink', () => {
    it('should resolve relative links', () => {
      const base = '/course/chapter-01/index.md';
      expect(resolveRelativeLink(base, 'test.md')).toContain('course/chapter-01/test.md');
      expect(resolveRelativeLink(base, '../images/test.png')).toContain('course/images/test.png');
    });

    it('should strip anchors', () => {
      const base = '/course/index.md';
      const result = resolveRelativeLink(base, 'test.md#section');
      expect(result).not.toContain('#section');
    });
  });

  describe('slugify', () => {
    it('should convert text to slug format', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Hello   World')).toBe('hello-world');
      expect(slugify('Hello_World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
      expect(slugify('Test: Section')).toBe('test-section');
    });

    it('should handle Chinese characters', () => {
      expect(slugify('中文标题')).toBe('');
    });
  });

  describe('isDangerousCode', () => {
    describe('Shell/Bash', () => {
      it('should detect rm -rf as dangerous', () => {
        expect(isDangerousCode('bash', 'rm -rf /data')).toBe(true);
        expect(isDangerousCode('sh', 'rm -fr /data')).toBe(true);
      });

      it('should detect sudo rm as dangerous', () => {
        expect(isDangerousCode('bash', 'sudo rm -rf /')).toBe(true);
      });

      it('should detect chmod 777 as dangerous', () => {
        expect(isDangerousCode('bash', 'chmod 777 /file')).toBe(true);
      });

      it('should detect pipe to bash as dangerous', () => {
        expect(isDangerousCode('bash', 'curl http://example.com | bash')).toBe(true);
      });

      it('should return false for safe shell code', () => {
        expect(isDangerousCode('bash', 'echo "Hello"')).toBe(false);
        expect(isDangerousCode('bash', 'ls -la')).toBe(false);
      });
    });

    describe('JavaScript', () => {
      it('should detect eval as dangerous', () => {
        expect(isDangerousCode('javascript', 'eval("console.log(1)")')).toBe(true);
        expect(isDangerousCode('js', 'eval("1+2")')).toBe(true);
      });

      it('should detect Function constructor as dangerous', () => {
        expect(isDangerousCode('javascript', 'new Function("return 1")')).toBe(true);
        expect(isDangerousCode('js', 'Function("return 1")')).toBe(true);
      });

      it('should detect process.exit as dangerous', () => {
        expect(isDangerousCode('javascript', 'process.exit(0)')).toBe(true);
      });

      it('should return false for safe JS code', () => {
        expect(isDangerousCode('javascript', 'console.log("Hello")')).toBe(false);
        expect(isDangerousCode('js', 'const x = 1 + 2')).toBe(false);
      });
    });

    describe('Python', () => {
      it('should detect os.system as dangerous', () => {
        expect(isDangerousCode('python', "import os; os.system('ls')")).toBe(true);
        expect(isDangerousCode('py', 'os.popen("ls")')).toBe(true);
      });

      it('should detect eval and exec as dangerous', () => {
        expect(isDangerousCode('python', 'eval("1+2")')).toBe(true);
        expect(isDangerousCode('py', 'exec("print(1)")')).toBe(true);
      });

      it('should detect shutil.rmtree as dangerous', () => {
        expect(isDangerousCode('python', 'shutil.rmtree("/path")')).toBe(true);
      });

      it('should return false for safe Python code', () => {
        expect(isDangerousCode('python', 'print("Hello")')).toBe(false);
        expect(isDangerousCode('py', 'x = 1 + 2')).toBe(false);
      });
    });
  });

  describe('calculateRiskLevel', () => {
    it('should return high when there are errors', () => {
      expect(calculateRiskLevel(1, 0)).toBe('high');
      expect(calculateRiskLevel(1, 100)).toBe('high');
    });

    it('should return medium when there are many warnings', () => {
      expect(calculateRiskLevel(0, 4)).toBe('medium');
      expect(calculateRiskLevel(0, 10)).toBe('medium');
    });

    it('should return low when there are few or no issues', () => {
      expect(calculateRiskLevel(0, 0)).toBe('low');
      expect(calculateRiskLevel(0, 3)).toBe('low');
    });
  });

  describe('calculateScore', () => {
    it('should return 100 when no checks are performed', () => {
      expect(calculateScore(0, 0, 0, 0)).toBe(100);
    });

    it('should return 100 when all checks pass', () => {
      expect(calculateScore(10, 10, 0, 0)).toBe(100);
    });

    it('should penalize for errors', () => {
      expect(calculateScore(10, 10, 1, 0)).toBe(90);
      expect(calculateScore(10, 10, 2, 0)).toBe(80);
    });

    it('should penalize for warnings', () => {
      expect(calculateScore(10, 10, 0, 1)).toBe(98);
      expect(calculateScore(10, 10, 0, 5)).toBe(90);
    });

    it('should not return negative scores', () => {
      expect(calculateScore(10, 0, 100, 100)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(2500)).toBe('2.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('should format minutes', () => {
      expect(formatDuration(60000)).toBe('1.0m');
      expect(formatDuration(90000)).toBe('1.5m');
    });
  });
});
