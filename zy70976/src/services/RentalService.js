const RentalModel = require('../models/RentalModel');
const OperationLogModel = require('../models/OperationLogModel');
const ExceptionModel = require('../models/ExceptionModel');
const BatchModel = require('../models/BatchModel');
const RepairModel = require('../models/RepairModel');
const fs = require('fs');
const csv = require('csv-parser');
const { Parser } = require('json2csv');

class RentalService {
  static async importRentalCSV(filePath, batchId, operator) {
    const results = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          try {
            const createdIds = [];
            for (const row of results) {
              const rentalId = await RentalModel.create({
                batch_id: batchId,
                device_serial: row.device_serial,
                device_name: row.device_name,
                customer_name: row.customer_name,
                customer_phone: row.customer_phone,
                rental_start_date: row.rental_start_date,
                rental_end_date: row.rental_end_date,
                daily_rate: parseFloat(row.daily_rate) || 0,
                deposit_amount: parseFloat(row.deposit_amount) || 0,
                deposit_flow_id: row.deposit_flow_id,
                total_rental_fee: parseFloat(row.total_rental_fee) || 0,
                actual_payment: parseFloat(row.actual_payment) || 0,
                status: 'pending'
              });
              createdIds.push(rentalId);

              await this.checkForExceptions(rentalId, row, operator);
            }
            await BatchModel.updateProcessedCount(batchId, results.length);
            resolve({ count: results.length, ids: createdIds });
          } catch (err) {
            reject(err);
          }
        })
        .on('error', reject);
    });
  }

  static async importRepairJSON(data) {
    const createdIds = [];
    for (const repair of data.repairs) {
      const id = await RepairModel.create({
        rental_id: repair.rental_id || null,
        device_serial: repair.device_serial,
        repair_type: repair.repair_type,
        repair_description: repair.repair_description,
        repair_cost: parseFloat(repair.repair_cost) || 0,
        is_customer_fault: repair.is_customer_fault ? 1 : 0,
        fault_reason: repair.fault_reason,
        report_date: repair.report_date,
        repair_date: repair.repair_date
      });
      createdIds.push(id);

      if (repair.rental_id && repair.is_customer_fault) {
        const rental = await RentalModel.findById(repair.rental_id);
        if (rental) {
          await RentalModel.update(repair.rental_id, {
            repair_fee: (rental.repair_fee || 0) + parseFloat(repair.repair_cost),
            has_repair: 1
          });
          await ExceptionModel.create({
            rental_id: repair.rental_id,
            exception_type: 'repair_liability',
            description: `客户责任维修: ${repair.repair_description}`,
            amount: parseFloat(repair.repair_cost)
          });
        }
      }
    }
    return { count: createdIds.length, ids: createdIds };
  }

  static async importDepositRules(rules) {
    const createdIds = [];
    for (const rule of rules) {
      const id = await require('../models/DepositRuleModel').create({
        device_type: rule.device_type,
        device_model: rule.device_model,
        deposit_amount: parseFloat(rule.deposit_amount),
        overdue_rate: parseFloat(rule.overdue_rate) || 0.1
      });
      createdIds.push(id);
    }
    return { count: createdIds.length, ids: createdIds };
  }

  static async checkForExceptions(rentalId, row, operator) {
    const startDate = new Date(row.rental_start_date);
    const endDate = new Date(row.rental_end_date);
    const actualReturn = row.actual_return_date ? new Date(row.actual_return_date) : new Date();
    
    if (actualReturn > endDate) {
      const overdueDays = Math.ceil((actualReturn - endDate) / (1000 * 60 * 60 * 24));
      const dailyRate = parseFloat(row.daily_rate) || 0;
      const overdueFee = overdueDays * dailyRate;
      
      await RentalModel.update(rentalId, {
        overdue_days: overdueDays,
        overdue_fee: overdueFee
      });
      await ExceptionModel.create({
        rental_id: rentalId,
        exception_type: 'overdue',
        description: `逾期 ${overdueDays} 天`,
        amount: overdueFee
      });
    }

    const totalRental = parseFloat(row.total_rental_fee) || 0;
    const actualPayment = parseFloat(row.actual_payment) || 0;
    if (actualPayment > totalRental + 1) {
      await ExceptionModel.create({
        rental_id: rentalId,
        exception_type: 'duplicate_payment',
        description: `重复扣款: 实收 ${actualPayment}, 应收 ${totalRental}`,
        amount: actualPayment - totalRental
      });
    }
  }

  static async processRental(rentalId, operator, reason, status = 'approved') {
    const rental = await RentalModel.findById(rentalId);
    if (!rental) throw new Error('租赁记录不存在');

    await OperationLogModel.create({
      rental_id: rentalId,
      batch_id: rental.batch_id,
      operation_type: 'process',
      operator: operator,
      reason: reason,
      old_status: rental.status,
      new_status: status
    });

    await RentalModel.update(rentalId, { status });
    return { success: true, status };
  }

  static async returnForModification(rentalId, operator, reason) {
    const rental = await RentalModel.findById(rentalId);
    if (!rental) throw new Error('租赁记录不存在');

    await OperationLogModel.create({
      rental_id: rentalId,
      batch_id: rental.batch_id,
      operation_type: 'return',
      operator: operator,
      reason: reason,
      old_status: rental.status,
      new_status: 'returned'
    });

    await RentalModel.update(rentalId, { status: 'returned' });
    return { success: true, status: 'returned' };
  }

  static async getRentalDetails(rentalId) {
    const rental = await RentalModel.findById(rentalId);
    if (!rental) return null;

    const logs = await OperationLogModel.findByRentalId(rentalId);
    const repairs = await RepairModel.findByRentalId(rentalId);
    const exceptions = await ExceptionModel.findByRentalId(rentalId);

    return {
      rental,
      operation_logs: logs,
      repairs,
      exceptions
    };
  }

  static async exportRentals(filters = {}) {
    const rentals = await RentalModel.findAll(filters);
    const fields = [
      'id', 'batch_id', 'device_serial', 'device_name', 'customer_name',
      'customer_phone', 'rental_start_date', 'rental_end_date',
      'actual_return_date', 'daily_rate', 'deposit_amount',
      'deposit_flow_id', 'total_rental_fee', 'actual_payment',
      'status', 'overdue_days', 'overdue_fee', 'repair_fee',
      'has_repair', 'created_at', 'updated_at'
    ];
    
    const parser = new Parser({ fields });
    const csv = parser.parse(rentals);
    return { csv, count: rentals.length };
  }

  static async createBatch(batchName, totalCount, operator) {
    const batchId = 'BATCH' + Date.now();
    await BatchModel.create({
      batch_id: batchId,
      batch_name: batchName,
      total_count: totalCount,
      operator: operator
    });
    return { batch_id: batchId, batch_name: batchName };
  }

  static async resolveException(exceptionId, operator, resolutionNote) {
    await ExceptionModel.resolve(exceptionId, {
      resolved_by: operator,
      resolution_note: resolutionNote
    });
    return { success: true };
  }
}

module.exports = RentalService;
