const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class TestHelper {
  constructor() {
    this.testFilesDir = path.join(__dirname, 'test-files');
    this.results = [];
  }

  async init() {
    await fs.ensureDir(this.testFilesDir);
  }

  createTestCubeFile(filename, contentSeed = 'default') {
    const filePath = path.join(this.testFilesDir, filename);
    const hash = crypto.createHash('md5').update(contentSeed).digest('hex');

    const content = `# LUT File for testing
# Seed: ${contentSeed}
# Hash: ${hash}
TITLE "Test LUT - ${filename}"
LUT_3D_SIZE 33
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0
`;

    const lines = [];
    for (let i = 0; i < 33; i++) {
      for (let j = 0; j < 33; j++) {
        for (let k = 0; k < 33; k++) {
          const r = (i / 32 + hash.charCodeAt((i + j) % 32) / 1000).toFixed(6);
          const g = (j / 32 + hash.charCodeAt((j + k) % 32) / 1000).toFixed(6);
          const b = (k / 32 + hash.charCodeAt((k + i) % 32) / 1000).toFixed(6);
          lines.push(`${r} ${g} ${b}`);
        }
      }
    }

    fs.writeFileSync(filePath, content + lines.join('\n'));
    return filePath;
  }

  createInvalidFile(filename) {
    const filePath = path.join(this.testFilesDir, filename);
    fs.writeFileSync(filePath, 'This is not a valid LUT file');
    return filePath;
  }

  logResult(testName, passed, message = '') {
    this.results.push({ testName, passed, message });
    const status = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${status} - ${testName}`);
    if (message) {
      console.log(`    ${message}`);
    }
  }

  printSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    console.log('\n' + '='.repeat(60));
    console.log(`测试结果: ${passed}/${total} 通过`);
    console.log('='.repeat(60));

    if (passed < total) {
      console.log('\n失败的测试:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.testName}: ${r.message}`);
      });
    }
  }

  async cleanup() {
    await fs.remove(this.testFilesDir);
  }
}

module.exports = TestHelper;
