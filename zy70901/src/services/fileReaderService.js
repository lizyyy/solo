const fs = require('fs');
const csv = require('csv-parser');

function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function readJsonFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function readFiles(files) {
  const result = {
    inspectionRecords: [],
    sensorData: [],
    approvalRecords: []
  };

  if (files.inspectionCsv && files.inspectionCsv[0]) {
    result.inspectionRecords = await readCsvFile(files.inspectionCsv[0].path);
  }

  if (files.sensorJson && files.sensorJson[0]) {
    const sensorContent = await readJsonFile(files.sensorJson[0].path);
    result.sensorData = Array.isArray(sensorContent) ? sensorContent : [sensorContent];
  }

  if (files.approvalForm && files.approvalForm[0]) {
    const approvalContent = await readJsonFile(files.approvalForm[0].path);
    result.approvalRecords = Array.isArray(approvalContent) ? approvalContent : [approvalContent];
  }

  return result;
}

module.exports = {
  readCsvFile,
  readJsonFile,
  readFiles
};
