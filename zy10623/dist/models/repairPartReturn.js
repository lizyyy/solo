"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairPartReturnStore = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class RepairPartReturnStore {
    constructor() {
        this.returns = new Map();
        this.histories = new Map();
        this.returnNoCounter = 1;
    }
    create(request) {
        const now = new Date().toISOString();
        const id = (0, uuid_1.v4)();
        const returnNo = `RPR${String(this.returnNoCounter++).padStart(6, '0')}`;
        const sparePart = {
            ...request.sparePart,
            partId: (0, uuid_1.v4)()
        };
        const repairOrder = {
            ...request.repairOrder,
            repairOrderId: (0, uuid_1.v4)()
        };
        const repairReturn = {
            id,
            returnNo,
            sparePart,
            repairOrder,
            status: types_1.RepairPartReturnStatus.PENDING_SHIP,
            stockRecovered: false,
            remark: request.remark,
            createTime: now,
            updateTime: now,
            operatorId: request.operatorId,
            operatorName: request.operatorName,
            idempotentKey: request.idempotentKey
        };
        this.returns.set(id, repairReturn);
        this.histories.set(id, []);
        this.addHistory(id, {
            newStatus: types_1.RepairPartReturnStatus.PENDING_SHIP,
            operatorId: request.operatorId,
            operatorName: request.operatorName,
            remark: '创建返厂单'
        });
        return repairReturn;
    }
    findById(id) {
        return this.returns.get(id);
    }
    findByReturnNo(returnNo) {
        return Array.from(this.returns.values()).find(r => r.returnNo === returnNo);
    }
    findByIdempotentKey(idempotentKey) {
        return Array.from(this.returns.values()).find(r => r.idempotentKey === idempotentKey);
    }
    list(page = 1, pageSize = 20, status) {
        let list = Array.from(this.returns.values());
        if (status) {
            list = list.filter(r => r.status === status);
        }
        list.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
        const total = list.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return {
            list: list.slice(start, end),
            total
        };
    }
    updateStatus(id, newStatus, operatorId, operatorName, remark) {
        const repairReturn = this.returns.get(id);
        const oldStatus = repairReturn.status;
        repairReturn.status = newStatus;
        repairReturn.updateTime = new Date().toISOString();
        repairReturn.operatorId = operatorId;
        repairReturn.operatorName = operatorName;
        if (remark) {
            repairReturn.remark = remark;
        }
        this.addHistory(id, {
            oldStatus,
            newStatus,
            operatorId,
            operatorName,
            remark
        });
        return repairReturn;
    }
    ship(id, request) {
        const repairReturn = this.returns.get(id);
        const now = new Date().toISOString();
        repairReturn.shippingInfo = {
            carrier: request.carrier,
            trackingNo: request.trackingNo,
            shipTime: now
        };
        return this.updateStatus(id, types_1.RepairPartReturnStatus.IN_TRANSIT, request.operatorId, request.operatorName, request.remark || '已寄出');
    }
    receive(id, request) {
        const repairReturn = this.returns.get(id);
        const now = new Date().toISOString();
        if (repairReturn.shippingInfo) {
            repairReturn.shippingInfo.receiveTime = now;
            repairReturn.shippingInfo.receiverName = request.receiverName;
        }
        return this.updateStatus(id, types_1.RepairPartReturnStatus.PENDING_INSPECTION, request.operatorId, request.operatorName, request.remark || '已签收，待检测');
    }
    inspect(id, request, stockRecovered) {
        const repairReturn = this.returns.get(id);
        const now = new Date().toISOString();
        repairReturn.inspectionConclusion = {
            inspectorId: request.inspectorId,
            inspectorName: request.inspectorName,
            inspectionTime: now,
            result: request.result,
            remark: request.remark,
            defectDescription: request.defectDescription,
            repairSuggestion: request.repairSuggestion,
            requiredMaterials: request.requiredMaterials
        };
        repairReturn.stockRecovered = stockRecovered;
        return this.updateStatus(id, types_1.RepairPartReturnStatus.INSPECTED, request.inspectorId, request.inspectorName, request.remark || '检测完成');
    }
    setNextStepHint(id, hint) {
        const repairReturn = this.returns.get(id);
        if (repairReturn) {
            repairReturn.nextStepHint = hint;
        }
    }
    stockIn(id, request) {
        return this.updateStatus(id, types_1.RepairPartReturnStatus.STOCKED, request.operatorId, request.operatorName, request.remark || '已入库');
    }
    reject(id, operatorId, operatorName, remark) {
        return this.updateStatus(id, types_1.RepairPartReturnStatus.REJECTED, operatorId, operatorName, remark || '驳回');
    }
    getHistories(returnId) {
        return this.histories.get(returnId) || [];
    }
    addHistory(returnId, history) {
        const histories = this.histories.get(returnId) || [];
        histories.push({
            ...history,
            id: (0, uuid_1.v4)(),
            returnId,
            createTime: new Date().toISOString()
        });
        this.histories.set(returnId, histories);
    }
    getAll() {
        return Array.from(this.returns.values());
    }
}
exports.repairPartReturnStore = new RepairPartReturnStore();
