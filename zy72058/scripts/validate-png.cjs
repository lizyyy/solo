const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PNG_FILE = process.argv[2];

if (!PNG_FILE || !fs.existsSync(PNG_FILE)) {
  console.error('Usage: node validate-png.cjs <path-to-png>');
  console.error('File not found:', PNG_FILE);
  process.exit(1);
}

const buf = fs.readFileSync(PNG_FILE);
console.log(`📄 文件: ${PNG_FILE}`);
console.log(`📐 大小: ${buf.length} bytes (${(buf.length / 1024).toFixed(2)} KB)`);

const signature = buf.slice(0, 8);
const validSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
if (signature.equals(validSig)) {
  console.log('✅ PNG 文件签名正确');
} else {
  console.log('❌ PNG 文件签名无效');
  process.exit(1);
}

let offset = 8;
let chunks = [];
while (offset < buf.length) {
  const length = buf.readUInt32BE(offset);
  const type = buf.slice(offset + 4, offset + 8).toString('ascii');
  chunks.push({ type, length, offset });
  offset += 12 + length;
}

const chunkTypes = chunks.map(c => c.type);
console.log(`📦 PNG 块数: ${chunks.length}`);
console.log(`📋 块类型: ${chunkTypes.join(', ')}`);

const requiredChunks = ['IHDR', 'IDAT', 'IEND'];
const missing = requiredChunks.filter(r => !chunkTypes.includes(r));
if (missing.length === 0) {
  console.log('✅ 包含所有必需块: IHDR, IDAT, IEND');
} else {
  console.log(`❌ 缺少必需块: ${missing.join(', ')}`);
  process.exit(1);
}

const ihdr = chunks.find(c => c.type === 'IHDR');
if (ihdr) {
  const width = buf.readUInt32BE(ihdr.offset + 8);
  const height = buf.readUInt32BE(ihdr.offset + 12);
  const bitDepth = buf[ihdr.offset + 16];
  const colorType = buf[ihdr.offset + 17];
  console.log(`🖼️  IHDR: ${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType}`);
}

try {
  const idatChunks = chunks.filter(c => c.type === 'IDAT');
  let idatData = Buffer.concat(idatChunks.map(c => 
    buf.slice(c.offset + 8, c.offset + 8 + c.length)
  ));
  const decompressed = zlib.inflateSync(idatData);
  console.log(`✅ IDAT 解压成功: ${decompressed.length} bytes`);
  console.log('✅ PNG 文件验证完整，可正常打开');
  process.exit(0);
} catch (e) {
  console.log(`❌ IDAT 解压失败: ${e.message}`);
  process.exit(1);
}
