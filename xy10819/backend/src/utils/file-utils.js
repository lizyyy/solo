const fs = require('fs');
const path = require('path');

const screenshotDir = process.env.SCREENSHOT_DIR || './data/screenshots';
const exportDir = process.env.EXPORT_DIR || './data/exports';

function initDirectories() {
  return new Promise((resolve, reject) => {
    try {
      [screenshotDir, exportDir].forEach(dir => {
        const fullPath = path.join(__dirname, '../../', dir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
      });
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

function saveScreenshot(buffer, filename) {
  const fullPath = path.join(__dirname, '../../', screenshotDir, filename);
  return new Promise((resolve, reject) => {
    fs.writeFile(fullPath, buffer, (err) => {
      if (err) reject(err);
      else resolve(filename);
    });
  });
}

function getScreenshotPath(filename) {
  return path.join(__dirname, '../../', screenshotDir, filename);
}

function saveExport(content, filename) {
  const fullPath = path.join(__dirname, '../../', exportDir, filename);
  return new Promise((resolve, reject) => {
    fs.writeFile(fullPath, content, (err) => {
      if (err) reject(err);
      else resolve(`/exports/${filename}`);
    });
  });
}

module.exports = { initDirectories, saveScreenshot, getScreenshotPath, saveExport };
