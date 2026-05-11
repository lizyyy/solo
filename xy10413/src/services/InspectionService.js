const { InspectionResult, ArrivalNote, ArrivalNoteItem, PurchaseOrderItem } = require('../models');
const ToleranceService = require('./ToleranceService');
const moment = require('moment');

class InspectionService {
  static async inspect(data) {
    const { arrivalNoteId, inspectorId, inspectorName, items, notes } = data;

    const arrivalNote = await ArrivalNote.findByPk(arrivalNoteId);
    if (!arrivalNote) {
      throw new Error('到货单不存在');
    }

    if (arrivalNote.status !== 'pending_inspection' && arrivalNote.status !== 'in_inspection') {
      throw new Error('到货单状态不允许验收');
    }

    const arrivalItems = await ArrivalNoteItem.findAll({ where: { arrivalNoteId } });
    const arrivalItemMap = new Map(arrivalItems.map(item => [item.id, item]));

    for (const item of items) {
      if (!arrivalItemMap.has(item.arrivalNoteItemId)) {
        throw new Error(`到货单明细不存在: ${item.arrivalNoteItemId}`);
      }
    }

    const inspectionResults = [];
    const inspectionTime = moment().toDate();

    for (const item of items) {
      const arrivalItem = arrivalItemMap.get(item.arrivalNoteItemId);
      
      const discrepancyResult = await ToleranceService.checkDiscrepancy(
        arrivalItem.poItemId,
        item.qualifiedQuantity,
        item.spec
      );

      const inspectionResult = await InspectionResult.create({
        arrivalNoteId,
        arrivalNoteItemId: item.arrivalNoteItemId,
        inspectorId,
        inspectorName,
        inspectionTime,
        receivedQuantity: arrivalItem.quantity,
        qualifiedQuantity: item.qualifiedQuantity || 0,
        defectQuantity: item.defectQuantity || 0,
        discrepancyType: discrepancyResult.discrepancyType,
        notes: item.notes
      });

      inspectionResults.push({
        ...inspectionResult.toJSON(),
        discrepancyInfo: discrepancyResult
      });
    }

    await ArrivalNote.update({ status: 'inspected' }, { where: { id: arrivalNoteId } });

    return {
      arrivalNoteId,
      inspectionTime,
      inspectorName,
      results: inspectionResults
    };
  }

  static async findByArrivalNote(arrivalNoteId) {
    return await InspectionResult.findAll({
      where: { arrivalNoteId },
      include: [
        { model: ArrivalNoteItem }
      ],
      order: [['inspectionTime', 'DESC']]
    });
  }

  static async getLatestByArrivalItem(arrivalNoteItemId) {
    return await InspectionResult.findOne({
      where: { arrivalNoteItemId },
      order: [['inspectionTime', 'DESC']]
    });
  }
}

module.exports = InspectionService;
