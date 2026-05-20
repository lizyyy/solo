"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationService = void 0;
const types_1 = require("./types");
class ReconciliationService {
    constructor(currentDate) {
        this.currentDate = currentDate || new Date().toISOString().split('T')[0];
    }
    detectOverdue(shipment) {
        if (shipment.status === types_1.SampleStatus.OVERDUE) {
            return {
                id: (0, types_1.generateId)(),
                shipmentId: shipment.id,
                type: types_1.DiscrepancyType.OVERDUE_NOT_RETURNED,
                description: `样品超期未还，应还日期${shipment.dueDate}，当前已超期`,
                amount: shipment.totalValue,
                source: '系统自动检测 - 超期未还',
                isResolved: false
            };
        }
        if (!shipment.returnDate && shipment.status !== types_1.SampleStatus.RETURNED) {
            const dueDate = new Date(shipment.dueDate);
            const today = new Date(this.currentDate);
            if (today > dueDate) {
                return {
                    id: (0, types_1.generateId)(),
                    shipmentId: shipment.id,
                    type: types_1.DiscrepancyType.OVERDUE_NOT_RETURNED,
                    description: `样品超期未还，应还日期${shipment.dueDate}，已超期${Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))}天`,
                    amount: shipment.totalValue,
                    source: '系统自动检测 - 超期未还',
                    isResolved: false
                };
            }
        }
        return null;
    }
    detectDamaged(shipment) {
        if (shipment.status === types_1.SampleStatus.DAMAGED) {
            return {
                id: (0, types_1.generateId)(),
                shipmentId: shipment.id,
                type: types_1.DiscrepancyType.DAMAGED_DEDUCTION,
                description: `样品归还时破损，需按价值扣款`,
                amount: shipment.totalValue,
                source: '系统自动检测 - 破损扣款',
                isResolved: false
            };
        }
        return null;
    }
    detectDuplicateShipments(shipments) {
        const discrepancies = [];
        const influencerSampleMap = new Map();
        shipments.forEach(shipment => {
            shipment.items.forEach(item => {
                const key = `${shipment.influencerId}_${item.sampleCode}`;
                if (!influencerSampleMap.has(key)) {
                    influencerSampleMap.set(key, []);
                }
                influencerSampleMap.get(key).push(shipment);
            });
        });
        influencerSampleMap.forEach((shipmentList, key) => {
            if (shipmentList.length > 1) {
                const [first, ...rest] = shipmentList;
                rest.forEach(dupShipment => {
                    const dupItem = dupShipment.items.find(i => `${dupShipment.influencerId}_${i.sampleCode}` === key);
                    if (dupItem) {
                        discrepancies.push({
                            id: (0, types_1.generateId)(),
                            shipmentId: dupShipment.id,
                            type: types_1.DiscrepancyType.DUPLICATE_SHIPMENT,
                            description: `同样品重复寄送，达人${dupShipment.influencerName}已收到相同样品`,
                            amount: dupItem.totalValue,
                            source: `系统自动检测 - 重复寄送（与${first.id}重复`,
                            isResolved: false
                        });
                    }
                });
            }
        });
        return discrepancies;
    }
    detectAllDiscrepancies(shipments) {
        const discrepancyMap = new Map();
        const duplicateDiscrepancies = this.detectDuplicateShipments(shipments);
        duplicateDiscrepancies.forEach(d => {
            if (!discrepancyMap.has(d.shipmentId)) {
                discrepancyMap.set(d.shipmentId, []);
            }
            discrepancyMap.get(d.shipmentId).push(d);
        });
        shipments.forEach(shipment => {
            const shipmentDiscrepancies = discrepancyMap.get(shipment.id) || [];
            const overdue = this.detectOverdue(shipment);
            if (overdue)
                shipmentDiscrepancies.push(overdue);
            const damaged = this.detectDamaged(shipment);
            if (damaged)
                shipmentDiscrepancies.push(damaged);
            if (shipmentDiscrepancies.length > 0) {
                discrepancyMap.set(shipment.id, shipmentDiscrepancies);
            }
        });
        return discrepancyMap;
    }
    createReconciliationRecords(shipments, discrepancyMap) {
        const records = [];
        shipments.forEach(shipment => {
            shipment.items.forEach(item => {
                const discrepancies = discrepancyMap.get(shipment.id) || [];
                const itemDiscrepancies = discrepancies.map(d => ({ ...d }));
                const totalDeduction = discrepancies.reduce((sum, d) => sum + d.amount, 0);
                records.push({
                    id: (0, types_1.generateId)(),
                    shipmentId: shipment.id,
                    batchCode: shipment.batchCode,
                    influencerName: shipment.influencerName,
                    sampleName: item.sampleName,
                    sampleCode: item.sampleCode,
                    originalStatus: shipment.status,
                    currentStatus: shipment.status,
                    discrepancies: itemDiscrepancies,
                    reviewStatus: discrepancies.length > 0 ? types_1.ReviewStatus.PENDING_REVIEW : types_1.ReviewStatus.REVIEWED,
                    deductionAmount: discrepancies.length > 0 ? totalDeduction : 0,
                    isModified: false
                });
            });
        });
        return records;
    }
    calculateSummary(records) {
        const summary = {
            totalShipments: records.length,
            returnedOnTime: 0,
            overdue: 0,
            damaged: 0,
            lost: 0,
            totalDeduction: 0,
            pendingReview: 0,
            reviewed: 0
        };
        records.forEach(record => {
            switch (record.currentStatus) {
                case types_1.SampleStatus.RETURNED:
                    summary.returnedOnTime++;
                    break;
                case types_1.SampleStatus.OVERDUE:
                    summary.overdue++;
                    break;
                case types_1.SampleStatus.DAMAGED:
                    summary.damaged++;
                    break;
                case types_1.SampleStatus.LOST:
                    summary.lost++;
                    break;
            }
            summary.totalDeduction += record.deductionAmount;
            if (record.reviewStatus === types_1.ReviewStatus.PENDING_REVIEW) {
                summary.pendingReview++;
            }
            else {
                summary.reviewed++;
            }
        });
        return summary;
    }
    runReconciliation(shipments) {
        const discrepancyMap = this.detectAllDiscrepancies(shipments);
        const records = this.createReconciliationRecords(shipments, discrepancyMap);
        const summary = this.calculateSummary(records);
        const allDiscrepancies = Array.from(discrepancyMap.values()).flat();
        return { records, summary, discrepancies: allDiscrepancies };
    }
}
exports.ReconciliationService = ReconciliationService;
