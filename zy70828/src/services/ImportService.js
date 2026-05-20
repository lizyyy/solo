const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const BedModel = require('../models/BedModel');
const PatientModel = require('../models/PatientModel');
const PatientTransferModel = require('../models/PatientTransferModel');
const CleaningOrderModel = require('../models/CleaningOrderModel');
const BatchModel = require('../models/BatchModel');
const TrackingRecordModel = require('../models/TrackingRecordModel');
const OperationLogModel = require('../models/OperationLogModel');

class ImportService {
  static async importBedsFromCSV(filePath, handler) {
    const results = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          try {
            const batch = await BatchModel.create({
              batch_type: 'bed_import',
              total_count: results.length,
              created_by: handler
            });

            let processed = 0;
            for (const row of results) {
              await BedModel.create({
                bed_no: row.bed_no || row.bedNo || row.床位号,
                ward: row.ward || row.病区,
                department: row.department || row.科室,
                status: row.status || 'available'
              });

              await TrackingRecordModel.create({
                batch_id: batch.id,
                bed_no: row.bed_no || row.bedNo || row.床位号,
                ward: row.ward || row.病区,
                department: row.department || row.科室,
                record_type: 'bed_import',
                status: 'approved',
                reason: '批量导入床位信息',
                handler: handler
              });

              processed++;
            }

            await BatchModel.updateProgress(batch.id, processed);
            await BatchModel.complete(batch.id);

            resolve({ batchNo: batch.batchNo, imported: processed, total: results.length });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  static async importPatientTransfersFromJSON(filePath, handler) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const transfers = Array.isArray(data) ? data : data.transfers || [];

    const batch = await BatchModel.create({
      batch_type: 'patient_transfer',
      total_count: transfers.length,
      created_by: handler
    });

    let processed = 0;
    for (const transfer of transfers) {
      await PatientModel.create({
        patient_id: transfer.patient_id || transfer.patientId,
        name: transfer.name,
        gender: transfer.gender,
        age: transfer.age,
        diagnosis: transfer.diagnosis,
        from_department: transfer.from_department,
        to_department: transfer.to_department
      });

      await PatientTransferModel.create({
        transfer_id: transfer.transfer_id || transfer.transferId || 'TF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        patient_id: transfer.patient_id || transfer.patientId,
        from_department: transfer.from_department,
        to_department: transfer.to_department,
        from_bed: transfer.from_bed,
        to_bed: transfer.to_bed,
        transfer_type: transfer.transfer_type || 'transfer',
        transfer_time: transfer.transfer_time
      });

      processed++;
    }

    await BatchModel.updateProgress(batch.id, processed);
    await BatchModel.complete(batch.id);

    return { batchNo: batch.batchNo, imported: processed, total: transfers.length };
  }

  static async importCleaningOrders(ordersData, handler) {
    const batch = await BatchModel.create({
      batch_type: 'cleaning_order',
      total_count: ordersData.length,
      created_by: handler
    });

    let processed = 0;
    for (const order of ordersData) {
      await CleaningOrderModel.create({
        order_id: order.order_id || order.orderId || 'CL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        bed_no: order.bed_no,
        ward: order.ward,
        assigned_to: order.assigned_to,
        timeout_hours: order.timeout_hours || 2
      });
      processed++;
    }

    await BatchModel.updateProgress(batch.id, processed);
    await BatchModel.complete(batch.id);

    return { batchNo: batch.batchNo, imported: processed, total: ordersData.length };
  }
}

module.exports = ImportService;
