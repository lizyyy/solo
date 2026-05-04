const fs = require('fs');
const csv = require('csv-parser');

function parseWarehouseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const warehouseInfo = {
      warehouseId: null,
      warehouseName: null,
      measurements: []
    };

    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('headers', (headers) => {
        const headerMap = {};
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('warehouseid') || lowerHeader.includes('库房编号')) {
            headerMap.warehouseId = header;
          } else if (lowerHeader.includes('warehousename') || lowerHeader.includes('库房名称')) {
            headerMap.warehouseName = header;
          } else if (lowerHeader.includes('timestamp') || lowerHeader.includes('时间')) {
            headerMap.timestamp = header;
          } else if (lowerHeader.includes('oxygen') || lowerHeader.includes('氧浓度')) {
            headerMap.oxygen = header;
          } else if (lowerHeader.includes('temperature') || lowerHeader.includes('温度')) {
            headerMap.temperature = header;
          } else if (lowerHeader.includes('humidity') || lowerHeader.includes('湿度')) {
            headerMap.humidity = header;
          }
        });
        results.push(headerMap);
      })
      .on('data', (data) => {
        const headerMap = results[0];
        if (headerMap) {
          if (!warehouseInfo.warehouseId && headerMap.warehouseId) {
            warehouseInfo.warehouseId = data[headerMap.warehouseId]?.toString().trim();
          }
          if (!warehouseInfo.warehouseName && headerMap.warehouseName) {
            warehouseInfo.warehouseName = data[headerMap.warehouseName]?.toString().trim();
          }

          const measurement = {};
          if (headerMap.timestamp) {
            measurement.timestamp = data[headerMap.timestamp]?.toString().trim();
          }
          if (headerMap.oxygen) {
            measurement.oxygen = parseFloat(data[headerMap.oxygen]);
          }
          if (headerMap.temperature) {
            measurement.temperature = parseFloat(data[headerMap.temperature]);
          }
          if (headerMap.humidity) {
            measurement.humidity = parseFloat(data[headerMap.humidity]);
          }

          if (Object.keys(measurement).length > 0) {
            warehouseInfo.measurements.push(measurement);
          }
        }
      })
      .on('end', () => {
        if (!warehouseInfo.warehouseId) {
          warehouseInfo.warehouseId = `WH-${Date.now()}`;
        }
        if (!warehouseInfo.warehouseName) {
          warehouseInfo.warehouseName = `库房-${warehouseInfo.warehouseId}`;
        }

        const validMeasurements = warehouseInfo.measurements.filter(m => 
          m.timestamp && 
          !isNaN(m.oxygen) && 
          !isNaN(m.temperature) && 
          !isNaN(m.humidity)
        );

        warehouseInfo.measurements = validMeasurements;
        resolve(warehouseInfo);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function parseRetrievalCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const headerMap = {};

    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.trim()
      }))
      .on('headers', (headers) => {
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('taskid') || lowerHeader.includes('任务编号')) {
            headerMap.taskId = header;
          } else if (lowerHeader.includes('warehouseid') || lowerHeader.includes('库房编号')) {
            headerMap.warehouseId = header;
          } else if (lowerHeader.includes('date') || lowerHeader.includes('日期')) {
            headerMap.date = header;
          } else if (lowerHeader.includes('rackid') || lowerHeader.includes('密集架编号')) {
            headerMap.rackId = header;
          } else if (lowerHeader.includes('personnelid') || lowerHeader.includes('人员编号')) {
            headerMap.personnelId = header;
          } else if (lowerHeader.includes('personnelname') || lowerHeader.includes('人员姓名')) {
            headerMap.personnelName = header;
          } else if (lowerHeader.includes('qualification') || lowerHeader.includes('资质')) {
            headerMap.qualification = header;
          }
        });
      })
      .on('data', (data) => {
        const task = {
          taskId: data[headerMap.taskId]?.toString().trim(),
          warehouseId: data[headerMap.warehouseId]?.toString().trim(),
          date: data[headerMap.date]?.toString().trim(),
          rackId: data[headerMap.rackId]?.toString().trim(),
          personnel: []
        };

        const personnelId = data[headerMap.personnelId]?.toString().trim();
        const personnelName = data[headerMap.personnelName]?.toString().trim();
        const qualification = data[headerMap.qualification]?.toString().trim();

        if (personnelId && personnelName && qualification) {
          task.personnel.push({
            id: personnelId,
            name: personnelName,
            qualification: qualification
          });
        }

        if (task.taskId && task.warehouseId) {
          results.push(task);
        }
      })
      .on('end', () => {
        const mergedTasks = {};
        results.forEach(task => {
          if (!mergedTasks[task.taskId]) {
            mergedTasks[task.taskId] = {
              taskId: task.taskId,
              warehouseId: task.warehouseId,
              date: task.date,
              rackId: task.rackId,
              personnel: []
            };
          }
          task.personnel.forEach(p => {
            if (!mergedTasks[task.taskId].personnel.find(mp => mp.id === p.id)) {
              mergedTasks[task.taskId].personnel.push(p);
            }
          });
        });

        const tasks = Object.values(mergedTasks);
        resolve(tasks);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

module.exports = {
  parseWarehouseCsv,
  parseRetrievalCsv
};
