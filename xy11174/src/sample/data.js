const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SampleData {
  constructor(logger) {
    this.logger = logger;
    this.tempDir = path.join(os.tmpdir(), 'gift-compare-samples');
    this.sampleFiles = [];
  }

  async generate() {
    this.logger.debug('生成企业礼品仓样例数据...');
    
    await fs.ensureDir(this.tempDir);
    
    const pdfSamples = [
      'sample-gift-brochure.pdf',
      'sample-vip-certificate.pdf',
      'sample-product-label.pdf'
    ];
    
    for (const pdfName of pdfSamples) {
      const pdfPath = path.join(this.tempDir, pdfName);
      await fs.writeFile(pdfPath, Buffer.from([0x25, 0x50, 0x44, 0x46]));
      this.sampleFiles.push(pdfPath);
    }
    
    const imageSamples = [
      'sample-product-main.jpg',
      'sample-product-detail.png',
      'sample-packaging-design.tiff',
      'sample-brand-logo.png'
    ];
    
    for (const imgName of imageSamples) {
      const imgPath = path.join(this.tempDir, imgName);
      await fs.writeFile(imgPath, Buffer.from([0x89, 0x50, 0x4E, 0x47]));
      this.sampleFiles.push(imgPath);
    }
    
    this.logger.debug(`生成 ${this.sampleFiles.length} 个样例文件`);
  }

  getPDFFiles() {
    return this.sampleFiles.filter(f => f.endsWith('.pdf'));
  }

  getImageFiles() {
    return this.sampleFiles.filter(f => 
      ['.jpg', '.jpeg', '.png', '.tiff', '.webp'].some(ext => f.endsWith(ext))
    );
  }

  async cleanup() {
    this.logger.debug('清理样例临时文件...');
    try {
      await fs.remove(this.tempDir);
    } catch (error) {
      this.logger.debug(`清理失败: ${error.message}`);
    }
  }
}

module.exports = SampleData;
