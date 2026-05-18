const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { getAllStops, addStop, updateStop, getStopById, deleteStop } = require('./data/sampleData');
const { SHUTTLE_LINES, STATION_STATUS } = require('./data/models');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const validateStopData = (data) => {
  const errors = [];
  const required = ['lineId', 'stopName', 'stopAddress', 'scheduledDate', 'scheduledTime', 
                     'direction', 'applicantName', 'applicantPhone', 'applicantDepartment',
                     'storeId', 'storeName', 'managerId', 'managerName', 'passengerCount', 'reason'];
  
  for (const field of required) {
    if (!data[field]) {
      errors.push(`缺少必填字段: ${field}`);
    }
  }

  if (data.passengerCount !== undefined && (typeof data.passengerCount !== 'number' || data.passengerCount < 1)) {
    errors.push('乘客人数必须为大于0的数字');
  }

  if (data.direction && !['上班', '下班'].includes(data.direction)) {
    errors.push('方向只能是"上班"或"下班"');
  }

  return errors;
};

const checkOverCapacity = (lineId, scheduledDate, scheduledTime, direction, newPassengers) => {
  const line = SHUTTLE_LINES.find(l => l.lineId === lineId);
  if (!line) return { overCapacity: false, message: '未找到对应班线' };

  const existingStops = getAllStops().filter(s => 
    s.lineId === lineId && 
    s.scheduledDate === scheduledDate && 
    s.direction === direction &&
    s.status !== STATION_STATUS.REJECTED &&
    s.status !== STATION_STATUS.CANCELLED
  );

  const totalPassengers = existingStops.reduce((sum, s) => sum + s.passengerCount, 0) + newPassengers;
  
  return {
    overCapacity: totalPassengers > line.capacity,
    currentPassengers: totalPassengers - newPassengers,
    newPassengers,
    totalPassengers,
    capacity: line.capacity,
    lineName: line.lineName
  };
};

app.get('/api/stops', (req, res) => {
  try {
    let stops = getAllStops();
    const { date, status, managerName, storeName, lineId, keyword } = req.query;

    if (date) {
      stops = stops.filter(s => s.scheduledDate === date);
    }
    if (status) {
      stops = stops.filter(s => s.status === status);
    }
    if (managerName) {
      stops = stops.filter(s => s.managerName.includes(managerName));
    }
    if (storeName) {
      stops = stops.filter(s => s.storeName.includes(storeName));
    }
    if (lineId) {
      stops = stops.filter(s => s.lineId === lineId);
    }
    if (keyword) {
      stops = stops.filter(s => 
        s.stopName.includes(keyword) || 
        s.applicantName.includes(keyword) ||
        s.reason.includes(keyword)
      );
    }

    res.json({
      success: true,
      total: stops.length,
      data: stops
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询临时加站列表失败: ' + error.message
    });
  }
});

app.get('/api/stops/:id', (req, res) => {
  try {
    const stop = getStopById(req.params.id);
    if (!stop) {
      return res.status(404).json({
        success: false,
        message: '未找到该临时加站记录'
      });
    }
    res.json({
      success: true,
      data: stop
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询临时加站详情失败: ' + error.message
    });
  }
});

app.post('/api/stops', (req, res) => {
  try {
    const errors = validateStopData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors
      });
    }

    const capacityCheck = checkOverCapacity(
      req.body.lineId,
      req.body.scheduledDate,
      req.body.scheduledTime,
      req.body.direction,
      req.body.passengerCount
    );

    const newStop = addStop(req.body);
    
    res.status(201).json({
      success: true,
      message: capacityCheck.overCapacity ? '创建成功，但该班次加站后可能超座，请留意' : '创建成功',
      capacityWarning: capacityCheck,
      data: newStop
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建临时加站失败: ' + error.message
    });
  }
});

app.put('/api/stops/:id', (req, res) => {
  try {
    const existingStop = getStopById(req.params.id);
    if (!existingStop) {
      return res.status(404).json({
        success: false,
        message: '未找到该临时加站记录'
      });
    }

    if (req.body.passengerCount !== undefined && (typeof req.body.passengerCount !== 'number' || req.body.passengerCount < 1)) {
      return res.status(400).json({
        success: false,
        message: '乘客人数必须为大于0的数字'
      });
    }

    const updatedStop = updateStop(req.params.id, req.body);
    
    res.json({
      success: true,
      message: '更新成功',
      data: updatedStop
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新临时加站失败: ' + error.message
    });
  }
});

app.delete('/api/stops/:id', (req, res) => {
  try {
    const success = deleteStop(req.params.id);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '未找到该临时加站记录'
      });
    }
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除临时加站失败: ' + error.message
    });
  }
});

app.post('/api/stops/batch-import', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '导入数据不能为空，且必须为数组格式'
      });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNumber = i + 1;
      
      const errors = validateStopData(item);
      if (errors.length > 0) {
        failCount++;
        results.push({
          row: rowNumber,
          success: false,
          message: '数据验证失败',
          errors,
          data: item
        });
        continue;
      }

      const capacityCheck = checkOverCapacity(
        item.lineId,
        item.scheduledDate,
        item.scheduledTime,
        item.direction,
        item.passengerCount
      );

      try {
        const newStop = addStop(item);
        successCount++;
        results.push({
          row: rowNumber,
          success: true,
          message: capacityCheck.overCapacity ? '导入成功，但加站后该班次可能超座' : '导入成功',
          capacityWarning: capacityCheck,
          data: newStop
        });
      } catch (error) {
        failCount++;
        results.push({
          row: rowNumber,
          success: false,
          message: '导入失败: ' + error.message,
          data: item
        });
      }
    }

    res.json({
      success: true,
      message: `批量导入完成，成功 ${successCount} 条，失败 ${failCount} 条`,
      summary: {
        total: items.length,
        success: successCount,
        fail: failCount
      },
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '批量导入失败: ' + error.message
    });
  }
});

app.post('/api/stops/:id/review', (req, res) => {
  try {
    const { status, reviewer, remark } = req.body;
    
    if (!status || !Object.values(STATION_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值，有效值为: ' + Object.values(STATION_STATUS).join(', ')
      });
    }

    const existingStop = getStopById(req.params.id);
    if (!existingStop) {
      return res.status(404).json({
        success: false,
        message: '未找到该临时加站记录'
      });
    }

    const updatedStop = updateStop(req.params.id, {
      status,
      reviewer,
      remark,
      reviewedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: '复核完成',
      data: updatedStop
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '复核失败: ' + error.message
    });
  }
});

app.get('/api/stops/export/csv', (req, res) => {
  try {
    let stops = getAllStops();
    const { date, status, managerName, storeName } = req.query;

    if (date) stops = stops.filter(s => s.scheduledDate === date);
    if (status) stops = stops.filter(s => s.status === status);
    if (managerName) stops = stops.filter(s => s.managerName.includes(managerName));
    if (storeName) stops = stops.filter(s => s.storeName.includes(storeName));

    const csvWriter = createCsvWriter({
      path: '/tmp/temporary_stops_export.csv',
      header: [
        { id: 'id', title: '申请编号' },
        { id: 'lineName', title: '班线名称' },
        { id: 'stopName', title: '站点名称' },
        { id: 'stopAddress', title: '站点地址' },
        { id: 'scheduledDate', title: '日期' },
        { id: 'scheduledTime', title: '时间' },
        { id: 'direction', title: '方向' },
        { id: 'applicantName', title: '申请人' },
        { id: 'applicantPhone', title: '申请人电话' },
        { id: 'applicantDepartment', title: '申请部门' },
        { id: 'storeName', title: '所属门店' },
        { id: 'managerName', title: '负责人' },
        { id: 'passengerCount', title: '乘客人数' },
        { id: 'reason', title: '申请原因' },
        { id: 'status', title: '状态' },
        { id: 'remark', title: '备注' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'reviewedAt', title: '复核时间' },
        { id: 'reviewer', title: '复核人' }
      ]
    });

    csvWriter.writeRecords(stops).then(() => {
      res.download('/tmp/temporary_stops_export.csv', `临时加站导出_${new Date().toISOString().split('T')[0]}.csv`);
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出CSV失败: ' + error.message
    });
  }
});

app.get('/api/lines', (req, res) => {
  res.json({
    success: true,
    data: SHUTTLE_LINES
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: STATION_STATUS
  });
});

app.listen(PORT, () => {
  console.log(`企业班车队班车临时加站 API 已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`API 文档请参考 README.md`);
});
