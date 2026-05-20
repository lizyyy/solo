const MaterialRecord = require('../models/MaterialRecord');
const RepairOrder = require('../models/RepairOrder');
const Vehicle = require('../models/Vehicle');
const Inventory = require('../models/Inventory');
const ExceptionLog = require('../models/ExceptionLog');
const AuditLog = require('../models/AuditLog');
const { Parser } = require('json2csv');

class QueryService {
  static async queryRecords(filters, options = {}) {
    try {
      const query = {};

      if (filters.orderNumber) {
        query.orderNumber = filters.orderNumber;
      }

      if (filters.teamName) {
        query.teamName = filters.teamName;
      }

      if (filters.batchNumber) {
        query.batchNumber = filters.batchNumber;
      }

      if (filters.materialCode) {
        query.materialCode = filters.materialCode;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.recordType) {
        query.recordType = filters.recordType;
      }

      if (filters.hasException !== undefined) {
        query.hasException = filters.hasException;
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      const page = parseInt(options.page) || 1;
      const pageSize = parseInt(options.pageSize) || 50;
      const skip = (page - 1) * pageSize;

      const sort = {};
      if (options.sortBy) {
        sort[options.sortBy] = options.sortOrder === 'asc' ? 1 : -1;
      } else {
        sort.createdAt = -1;
      }

      const records = await MaterialRecord.find(query)
        .sort(sort)
        .skip(skip)
        .limit(pageSize);

      const total = await MaterialRecord.countDocuments(query);

      return {
        success: true,
        data: {
          records,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async queryByOrderNumber(orderNumber) {
    try {
      const records = await MaterialRecord.find({ orderNumber }).sort({ createdAt: -1 });
      const repairOrder = await RepairOrder.findOne({ orderNumber });

      return {
        success: true,
        data: {
          repairOrder,
          records,
          count: records.length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async queryByTeamName(teamName, dateRange = {}) {
    try {
      const query = { teamName };
      
      if (dateRange.startDate || dateRange.endDate) {
        query.createdAt = {};
        if (dateRange.startDate) {
          query.createdAt.$gte = new Date(dateRange.startDate);
        }
        if (dateRange.endDate) {
          query.createdAt.$lte = new Date(dateRange.endDate);
        }
      }

      const records = await MaterialRecord.find(query).sort({ createdAt: -1 });
      const vehicle = await Vehicle.findOne({ teamName });

      return {
        success: true,
        data: {
          vehicle,
          records,
          count: records.length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async queryByBatchNumber(batchNumber) {
    try {
      const records = await MaterialRecord.find({ batchNumber }).sort({ createdAt: -1 });
      const inventory = await Inventory.find({ batchNumber });

      return {
        success: true,
        data: {
          inventory,
          records,
          count: records.length
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getExceptionLogs(filters = {}) {
    try {
      const query = {};

      if (filters.exceptionType) {
        query.exceptionType = filters.exceptionType;
      }

      if (filters.orderNumber) {
        query.orderNumber = filters.orderNumber;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      const logs = await ExceptionLog.find(query).sort({ createdAt: -1 });

      return {
        success: true,
        data: logs
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getAuditLogs(recordId) {
    try {
      const logs = await AuditLog.find({ recordId }).sort({ createdAt: -1 });

      return {
        success: true,
        data: logs
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getCompleteReport(recordId) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      const repairOrder = await RepairOrder.findOne({ orderNumber: record.orderNumber });
      const vehicle = record.vehicleId ? await Vehicle.findOne({ vehicleId: record.vehicleId }) : null;
      const inventory = record.batchNumber ? await Inventory.findOne({
        materialCode: record.materialCode,
        batchNumber: record.batchNumber
      }) : null;
      const auditLogs = await AuditLog.find({ recordId }).sort({ createdAt: 1 });
      const exceptionLogs = await ExceptionLog.find({ recordId }).sort({ createdAt: 1 });

      return {
        success: true,
        data: {
          basicInfo: {
            recordId: record.recordId,
            orderNumber: record.orderNumber,
            materialCode: record.materialCode,
            materialName: record.materialName,
            specification: record.specification,
            unit: record.unit,
            requestedQuantity: record.requestedQuantity,
            actualQuantity: record.actualQuantity,
            returnedQuantity: record.returnedQuantity,
            batchNumber: record.batchNumber,
            warehouse: record.warehouse,
            recordType: record.recordType,
            status: record.status,
            applicant: record.applicant,
            applicationTime: record.applicationTime,
            handler: record.handler,
            handleTime: record.handleTime,
            reason: record.reason,
            rejectionReason: record.rejectionReason,
            returnReason: record.returnReason,
            remarks: record.remarks,
            hasException: record.hasException,
            exceptionType: record.exceptionType,
            exceptionReason: record.exceptionReason,
            exceptionHandler: record.exceptionHandler,
            exceptionTime: record.exceptionTime
          },
          repairOrder: repairOrder ? {
            repairType: repairOrder.repairType,
            location: repairOrder.location,
            description: repairOrder.description,
            priority: repairOrder.priority,
            reporter: repairOrder.reporter,
            reportTime: repairOrder.reportTime,
            startTime: repairOrder.startTime,
            endTime: repairOrder.endTime,
            responsiblePerson: repairOrder.responsiblePerson
          } : null,
          vehicle: vehicle ? {
            vehicleId: vehicle.vehicleId,
            plateNumber: vehicle.plateNumber,
            teamName: vehicle.teamName,
            driver: vehicle.driver,
            crewMembers: vehicle.crewMembers
          } : null,
          inventory: inventory ? {
            materialCode: inventory.materialCode,
            materialName: inventory.materialName,
            specification: inventory.specification,
            unit: inventory.unit,
            quantity: inventory.quantity,
            batchNumber: inventory.batchNumber,
            warehouse: inventory.warehouse,
            status: inventory.status
          } : null,
          auditTrail: auditLogs.map(log => ({
            action: log.action,
            previousStatus: log.previousStatus,
            newStatus: log.newStatus,
            operator: log.operator,
            operateTime: log.operateTime,
            reason: log.reason,
            remarks: log.remarks
          })),
          exceptions: exceptionLogs.map(log => ({
            exceptionType: log.exceptionType,
            quantity: log.quantity,
            expectedQuantity: log.expectedQuantity,
            actualQuantity: log.actualQuantity,
            reason: log.reason,
            handler: log.handler,
            handleTime: log.handleTime,
            status: log.status,
            resolution: log.resolution,
            resolvedBy: log.resolvedBy,
            resolvedTime: log.resolvedTime
          }))
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getStatistics(filters = {}) {
    try {
      const query = {};

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      const totalRecords = await MaterialRecord.countDocuments(query);
      const pendingCount = await MaterialRecord.countDocuments({ ...query, status: 'pending' });
      const processingCount = await MaterialRecord.countDocuments({ ...query, status: 'processing' });
      const approvedCount = await MaterialRecord.countDocuments({ ...query, status: 'approved' });
      const rejectedCount = await MaterialRecord.countDocuments({ ...query, status: 'rejected' });
      const returnedCount = await MaterialRecord.countDocuments({ ...query, status: 'returned' });
      const completedCount = await MaterialRecord.countDocuments({ ...query, status: 'completed' });
      const exceptionCount = await MaterialRecord.countDocuments({ ...query, hasException: true });

      return {
        success: true,
        data: {
          total: totalRecords,
          byStatus: {
            pending: pendingCount,
            processing: processingCount,
            approved: approvedCount,
            rejected: rejectedCount,
            returned: returnedCount,
            completed: completedCount
          },
          withExceptions: exceptionCount
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = QueryService;
