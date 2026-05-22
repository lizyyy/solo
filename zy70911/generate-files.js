const fs = require('fs');
const path = require('path');

const files = {
  'src/utils/hash.js': `const crypto = require('crypto');

function generateMaterialHash(materials) {
  const sortedMaterials = JSON.stringify(materials, Object.keys(materials).sort());
  return crypto.createHash('sha256').update(sortedMaterials).digest('hex');
}

function generateId() {
  return crypto.randomUUID();
}

function now() {
  return Math.floor(Date.now() / 1000);
}

module.exports = {
  generateMaterialHash,
  generateId,
  now
};
`,
};

Object.entries(files).forEach(([filePath, content]) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
  console.log('Created:', filePath);
});

console.log('Done!');
