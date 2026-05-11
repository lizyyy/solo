const { Inventory, InventoryLog, ArrivalNote, ArrivalNoteItem, InspectionResult, DiscrepancyHandling, PurchaseOrderItem, PurchaseOrder } = require('../models');
const DiscrepancyService = require('./DiscrepancyService');
const { sequelize } = require('../models');
const moment = require('moment');

class InventoryService {
  static async stockIn(arrivalNoteId, createdBy, location = 'DEFAULT') {
    const transaction = await sequelize.transaction();

    try {
      const arrivalNote = await ArrivalNote.findByPk(arrivalNoteId, {
        include: [PurchaseOrder]
      });

      if (!arrivalNote) {
        throw new Error('到货单不存在');
      }

      if (arrivalNote.status === 'fully_stocked') {
        throw new Error('到货单已全部入库');
      }

      const arrivalItems = await ArrivalNoteItem.findAll({
        where: { arrivalNoteId },
        transaction
      });

      const stockedItems = [];

      for (const arrivalItem of arrivalItems) {
        const inspectionResult = await InspectionResult.findOne({
          where: { arrivalNoteItemId: arrivalItem.id },
          order: [['inspectionTime', 'DESC']],
          transaction
        });

        if (!inspectionResult) {
          throw new Error('到货单尚未验收');
        }

        const canStockInResult = await DiscrepancyService.canStockIn(inspectionResult.id);
        
        if (!canStockInResult.canStockIn) {
          throw new Error(`入库失败: ${canStockInResult.reason}`);
        }

        const stockQuantity = parseFloat(inspectionResult.qualifiedQuantity);
        
        if (stockQuantity <= 0) {
          continue;
        }

        const poItem = await PurchaseOrderItem.findByPk(arrivalItem.poItemId, { transaction });
        if (!poItem) {
          throw new Error('采购单明细不存在');
        }

        let inventory = await Inventory.findOne({
          where: {
            productCode: poItem.productCode,
            spec: poItem.spec,
            batchNo: arrivalItem.batchNo || 'DEFAULT'
          },
          transaction
        });

        if (!inventory) {
          inventory = await Inventory.create({
            productCode: poItem.productCode,
            productName: poItem.productName,
            spec: poItem.spec,
            quantity: 0,
            location,
            batchNo: arrivalItem.batchNo || 'DEFAULT'
          }, { transaction });
        }

        const newQuantity = parseFloat(inventory.quantity) + stockQuantity;
        await Inventory.update(
          { quantity: newQuantity },
          { where: { id: inventory.id }, transaction }
        );

        await InventoryLog.create({
          inventoryId: inventory.id,
          type: 'in',
          quantity: stockQuantity,
          referenceType: 'arrival_note',
          referenceId: arrivalNoteId,
          createdBy
        }, { transaction });

        const newReceivedQty = parseFloat(poItem.receivedQuantity) + stockQuantity;
        await PurchaseOrderItem.update(
          { receivedQuantity: newReceivedQty },
          { where: { id: poItem.id }, transaction }
        );

        stockedItems.push({
          productCode: poItem.productCode,
          productName: poItem.productName,
          spec: poItem.spec,
          quantity: stockQuantity,
          batchNo: arrivalItem.batchNo
        });
      }

      await ArrivalNote.update(
        { status: 'fully_stocked' },
        { where: { id: arrivalNoteId }, transaction }
      );

      if (arrivalNote.poId) {
        const poItems = await PurchaseOrderItem.findAll({
          where: { poId: arrivalNote.poId },
          transaction
        });

        let allReceived = true;
        for (const item of poItems) {
          if (parseFloat(item.receivedQuantity) < parseFloat(item.quantity)) {
            allReceived = false;
            break;
          }
        }

        await PurchaseOrder.update(
          { status: allReceived ? 'full_arrival' : 'partial_arrival' },
          { where: { id: arrivalNote.poId }, transaction }
        );
      }

      await transaction.commit();

      return {
        arrivalNoteId,
        stockedAt: moment().toDate(),
        stockedBy: createdBy,
        items: stockedItems
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getInventory(filters = {}) {
    const where = {};
    if (filters.productCode) {
      where.productCode = filters.productCode;
    }
    if (filters.spec) {
      where.spec = filters.spec;
    }

    return await Inventory.findAll({
      where,
      order: [['productCode', 'ASC']]
    });
  }

  static async getInventoryLog(filters = {}) {
    const where = {};
    if (filters.referenceId) {
      where.referenceId = filters.referenceId;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    return await InventoryLog.findAll({
      where,
      include: [Inventory],
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = InventoryService;
