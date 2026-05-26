const fs = require('fs');
const csv = require('csv-parser');
const batchService = require('./batchService');
const recordService = require('./recordService');
const historyService = require('./historyService');

class ImportService {
  async importAlarmCSV(filePath, created_by, source_name = null) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          try {
            const batch = await batchService.createBatch({
              source_type: 'alarm_csv',
              source_name: source_name || `告警导入_${new Date().toLocaleDateString()}`,
              created_by
            });
            
            const importedRecords = [];
            for (const row of results) {
              const record = await recordService.createRecord({
                batch_id: batch.id,
                pole_no: row.pole_no || row.灯杆编号,
                light_no: row.light_no || row.灯具编号,
                record_type: 'alarm',
                alarm_type: row.alarm_type || row.告警类型,
                alarm_level: row.alarm_level || row.告警级别,
                location: row.location || row.位置,
                description: row.description || row.描述,
                maintenance_team: row.maintenance_team || row.维修队,
                handler: row.handler || row.处理人,
                report_time: row.report_time || row.上报时间,
                source_data: row
              });
              
              await historyService.addHistory({
                record_id: record.id,
                action_type: 'import',
                action_reason: 'CSV批量导入',
                action_by: created_by,
                previous_status: null,
                new_status: 'pending',
                remark: `批次号: ${batch.batch_no}`
              });
              
              importedRecords.push(record);
            }
            
            await batchService.updateBatchCount(batch.id, importedRecords.length);
            
            fs.unlinkSync(filePath);
            
            resolve({
              batch,
              imported_count: importedRecords.length,
              records: importedRecords
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  async importInspectionJSON(dataArray, created_by, source_name = null) {
    const batch = await batchService.createBatch({
      source_type: 'inspection_json',
      source_name: source_name || `巡查导入_${new Date().toLocaleDateString()}`,
      created_by
    });
    
    const importedRecords = [];
    for (const item of dataArray) {
      const record = await recordService.createRecord({
        batch_id: batch.id,
        pole_no: item.pole_no,
        light_no: item.light_no,
        record_type: 'inspection',
        alarm_type: item.issue_type,
        alarm_level: item.level,
        location: item.location,
        description: item.description,
        maintenance_team: item.maintenance_team,
        handler: item.inspector,
        report_time: item.inspection_time,
        source_data: item
      });
      
      await historyService.addHistory({
        record_id: record.id,
        action_type: 'import',
        action_reason: 'JSON批量导入',
        action_by: created_by,
        previous_status: null,
        new_status: 'pending',
        remark: `批次号: ${batch.batch_no}`
      });
      
      importedRecords.push(record);
    }
    
    await batchService.updateBatchCount(batch.id, importedRecords.length);
    
    return {
      batch,
      imported_count: importedRecords.length,
      records: importedRecords
    };
  }

  async importWorkOrder(orderData, created_by) {
    const batch = await batchService.createBatch({
      source_type: 'work_order',
      source_name: `维修单_${orderData.order_no || new Date().toLocaleDateString()}`,
      created_by
    });
    
    const record = await recordService.createRecord({
      batch_id: batch.id,
      pole_no: orderData.pole_no,
      light_no: orderData.light_no,
      record_type: 'repair',
      alarm_type: orderData.repair_type,
      location: orderData.location,
      description: orderData.description,
      maintenance_team: orderData.maintenance_team,
      handler: orderData.worker,
      report_time: orderData.repair_time,
      source_data: orderData
    });
    
    await historyService.addHistory({
      record_id: record.id,
      action_type: 'import',
      action_reason: '维修单导入',
      action_by: created_by,
      previous_status: null,
      new_status: 'pending',
      remark: `批次号: ${batch.batch_no}`
    });
    
    await batchService.updateBatchCount(batch.id, 1);
    
    return { batch, record };
  }
}

module.exports = new ImportService();
