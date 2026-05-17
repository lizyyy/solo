const fs = require('fs');
const path = require('path');

function exportJSON(results, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const jsonData = JSON.stringify(results, null, 2);
  fs.writeFileSync(outputPath, jsonData, 'utf-8');
  
  return outputPath;
}

module.exports = { exportJSON };
