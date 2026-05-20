const csv = require('csv-parser');
const fs = require('fs');

function parseSendCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function parseRecoveryJSON(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function parseRoomTypeConfig(filePath) {
  return new Promise((resolve, reject) => {
    if (filePath.endsWith('.csv')) {
      parseSendCSV(filePath).then(resolve).catch(reject);
    } else if (filePath.endsWith('.json')) {
      parseRecoveryJSON(filePath).then(resolve).catch(reject);
    } else {
      reject(new Error('不支持的文件格式'));
    }
  });
}

module.exports = {
  parseSendCSV,
  parseRecoveryJSON,
  parseRoomTypeConfig
};
