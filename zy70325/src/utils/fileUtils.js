const crypto = require('crypto');
const fs = require('fs-extra');

/**
 * 计算文件哈希值
 */
function calculateHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * 计算文件大小
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * 确保目录存在
 */
async function ensureDir(dirPath) {
  await fs.ensureDir(dirPath);
}

/**
 * 合并分片文件
 */
async function mergeChunks(chunkPaths, outputPath) {
  await fs.ensureFile(outputPath);
  const writeStream = fs.createWriteStream(outputPath);
  
  for (const chunkPath of chunkPaths) {
    const readStream = fs.createReadStream(chunkPath);
    await new Promise((resolve, reject) => {
      readStream.pipe(writeStream, { end: false });
      readStream.on('end', resolve);
      readStream.on('error', reject);
    });
  }
  
  await new Promise((resolve) => {
    writeStream.end(resolve);
  });
  
  return outputPath;
}

module.exports = {
  calculateHash,
  getFileSize,
  ensureDir,
  mergeChunks
};
