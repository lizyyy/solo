const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function calculateHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function generateTestFile(sizeInBytes, fileName) {
  const buffer = crypto.randomBytes(sizeInBytes);
  fs.writeFileSync(fileName, buffer);
  return buffer;
}

function splitFileIntoChunks(buffer, chunkSize) {
  const chunks = [];
  for (let i = 0; i < buffer.length; i += chunkSize) {
    chunks.push(buffer.slice(i, i + chunkSize));
  }
  return chunks;
}

const TEST_DIR = path.join(__dirname, '..', 'test_files');
fs.mkdirSync(TEST_DIR, { recursive: true });

const FILE_SIZE = 10 * 1024; // 10KB
const CHUNK_SIZE = 3 * 1024;  // 3KB 每个分片

console.log('生成测试文件...');
const testBuffer = generateTestFile(FILE_SIZE, path.join(TEST_DIR, 'test_file.txt'));
const fileHash = calculateHash(testBuffer);

console.log(`测试文件大小: ${testBuffer.length} 字节`);
console.log(`文件哈希 (SHA256): ${fileHash}`);
console.log();

const chunks = splitFileIntoChunks(testBuffer, CHUNK_SIZE);
console.log(`分片数量: ${chunks.length}`);
console.log(`分片大小: ${CHUNK_SIZE} 字节`);
console.log();

for (let i = 0; i < chunks.length; i++) {
  const chunkBuffer = chunks[i];
  const chunkHash = calculateHash(chunkBuffer);
  const chunkFileName = path.join(TEST_DIR, `chunk_${i + 1}`);
  fs.writeFileSync(chunkFileName, chunkBuffer);
  console.log(`分片 ${i + 1}: ${chunkBuffer.length} 字节, 哈希: ${chunkHash}`);
}

console.log();
console.log('=== 准备好的 curl 命令 ===');
console.log();
console.log('# 1. 创建上传会话');
console.log(`curl -X POST http://localhost:3000/api/upload/sessions \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -d '{`);
console.log(`    "fileName": "test_file.txt",`);
console.log(`    "fileSize": ${FILE_SIZE},`);
console.log(`    "totalChunks": ${chunks.length},`);
console.log(`    "chunkSize": ${CHUNK_SIZE},`);
console.log(`    "fileHash": "${fileHash}"`);
console.log(`  }'`);
console.log();

console.log('# 2. 上传分片（替换 SESSION_ID）');
for (let i = 0; i < chunks.length; i++) {
  const chunkHash = calculateHash(chunks[i]);
  console.log(`curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/chunks/${i + 1} \\`);
  console.log(`  -F "chunk=@${path.join(TEST_DIR, `chunk_${i + 1}`)}" \\`);
  console.log(`  -F "chunkHash=${chunkHash}"`);
  if (i < chunks.length - 1) console.log();
}
console.log();

console.log('# 3. 查看会话状态');
console.log('curl http://localhost:3000/api/upload/sessions/SESSION_ID');
console.log();

console.log('# 4. 完成上传');
console.log('curl -X POST http://localhost:3000/api/upload/sessions/SESSION_ID/complete');

module.exports = {
  generateTestFile,
  splitFileIntoChunks,
  calculateHash
};
