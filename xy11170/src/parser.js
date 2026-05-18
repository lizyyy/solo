const fs = require('fs');
const csv = require('csv-parser');

function parseDateTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function parseRow(row) {
  const scheduledStartTime = parseDateTime(row.预约日期, row.预约开始时间);
  let scheduledEndTime = parseDateTime(row.预约日期, row.预约结束时间);
  if (scheduledEndTime <= scheduledStartTime) {
    scheduledEndTime = new Date(scheduledEndTime.getTime() + 24 * 60 * 60 * 1000);
  }
  
  const actualStartTime = parseDateTime(row.实际日期, row.实际入场时间);
  let actualEndTime = parseDateTime(row.实际日期, row.实际离场时间);
  if (actualEndTime <= actualStartTime) {
    actualEndTime = new Date(actualEndTime.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return {
    bookingId: row.预约ID,
    studioName: row.排练室名称,
    customerName: row.客户姓名,
    danceType: row.舞种类型,
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime,
    actualEndTime,
    hourlyRate: parseFloat(row.小时单价),
    billedAmount: parseFloat(row.计费金额),
    remarks: row.备注 || ''
  };
}

async function parseCSV(filePath) {
  const results = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        try {
          const parsedResults = results.map(parseRow);
          resolve(parsedResults);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

module.exports = {
  parseCSV,
  parseDateTime
};
