const fs = require('fs');
const csv = require('csv-parser');

async function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function parseJson(filePath) {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function parseReceipt(file) {
  const content = await fs.promises.readFile(file.path, 'utf8');
  try {
    return JSON.parse(content);
  } catch (e) {
    return {
      filename: file.originalname,
      content: content,
      rawData: null
    };
  }
}

module.exports = {
  parseCsv,
  parseJson,
  parseReceipt
};
