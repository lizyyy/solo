const { ArrivalNote, ArrivalNoteItem, PurchaseOrder, PurchaseOrderItem, Supplier } = require('../models');
const IdempotencyService = require('./IdempotencyService');
const moment = require('moment');

class ArrivalService {
  static async create(data, createdBy) {
    const { arrivalNo, poNo, supplierId, arrivalDate, items, idempotencyKey } = data;

    let idemKey = idempotencyKey;
    if (!idemKey) {
      idemKey = IdempotencyService.generateKey(arrivalNo, poNo, supplierId);
    }

    const existing = await IdempotencyService.checkAndGetExisting(idemKey);
    if (existing) {
      return {
        isDuplicate: true,
        arrivalNote: existing
      };
    }

    const po = await PurchaseOrder.findOne({ where: { poNo } });
    if (!po) {
      throw new Error('采购单不存在');
    }

    if (po.supplierId !== supplierId) {
      throw new Error('采购单供应商与到货单供应商不匹配');
    }

    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) {
      throw new Error('供应商不存在');
    }

    const poItems = await PurchaseOrderItem.findAll({ where: { poId: po.id } });
    const poItemMap = new Map(poItems.map(item => [item.id, item]));

    for (const item of items) {
      if (!poItemMap.has(item.poItemId)) {
        throw new Error(`采购单明细不存在: ${item.poItemId}`);
      }
    }

    const arrivalNote = await ArrivalNote.create({
      arrivalNo,
      poId: po.id,
      supplierId,
      arrivalDate: arrivalDate || moment().toDate(),
      status: 'pending_inspection',
      idempotencyKey: idemKey,
      createdBy
    });

    const arrivalItems = [];
    for (const item of items) {
      const poItem = poItemMap.get(item.poItemId);
      const arrivalItem = await ArrivalNoteItem.create({
        arrivalNoteId: arrivalNote.id,
        poItemId: item.poItemId,
        productCode: poItem.productCode,
        productName: poItem.productName,
        spec: item.spec || poItem.spec,
        quantity: item.quantity,
        batchNo: item.batchNo
      });
      arrivalItems.push(arrivalItem);
    }

    return {
      isDuplicate: false,
      arrivalNote: {
        ...arrivalNote.toJSON(),
        items: arrivalItems
      }
    };
  }

  static async findById(id) {
    const arrivalNote = await ArrivalNote.findByPk(id, {
      include: [
        { model: Supplier },
        { model: PurchaseOrder },
        { model: ArrivalNoteItem }
      ]
    });
    return arrivalNote;
  }

  static async findByArrivalNo(arrivalNo) {
    const arrivalNote = await ArrivalNote.findOne({
      where: { arrivalNo },
      include: [
        { model: Supplier },
        { model: PurchaseOrder },
        { model: ArrivalNoteItem }
      ]
    });
    return arrivalNote;
  }

  static async updateStatus(arrivalNoteId, status) {
    await ArrivalNote.update({ status }, { where: { id: arrivalNoteId } });
  }

  static async list(filters = {}) {
    const where = {};
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }
    if (filters.poId) {
      where.poId = filters.poId;
    }

    return await ArrivalNote.findAll({
      where,
      include: [
        { model: Supplier },
        { model: PurchaseOrder },
        { model: ArrivalNoteItem }
      ],
      order: [['createdAt', 'DESC']]
    });
  }
}

module.exports = ArrivalService;
