"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairPartReturnService = exports.RepairPartReturnService = exports.ServiceErrorCode = void 0;
const types_1 = require("../types");
const repairPartReturn_1 = require("../models/repairPartReturn");
const csv_writer_1 = require("csv-writer");
var ServiceErrorCode;
(function (ServiceErrorCode) {
    ServiceErrorCode["SUCCESS"] = "SUCCESS";
    ServiceErrorCode["RECORD_NOT_FOUND"] = "RECORD_NOT_FOUND";
    ServiceErrorCode["INVALID_STATUS_TRANSITION"] = "INVALID_STATUS_TRANSITION";
    ServiceErrorCode["IDEMPOTENT_CONFLICT"] = "IDEMPOTENT_CONFLICT";
    ServiceErrorCode["STOCK_RECOVERED_BLOCKED"] = "STOCK_RECOVERED_BLOCKED";
    ServiceErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
})(ServiceErrorCode || (exports.ServiceErrorCode = ServiceErrorCode = {}));
const STATUS_TRANSITIONS = {
    [types_1.RepairPartReturnStatus.PENDING_SHIP]: [
        types_1.RepairPartReturnStatus.IN_TRANSIT,
        types_1.RepairPartReturnStatus.REJECTED
    ],
    [types_1.RepairPartReturnStatus.IN_TRANSIT]: [
        types_1.RepairPartReturnStatus.PENDING_INSPECTION,
        types_1.RepairPartReturnStatus.REJECTED
    ],
    [types_1.RepairPartReturnStatus.PENDING_INSPECTION]: [
        types_1.RepairPartReturnStatus.INSPECTED,
        types_1.RepairPartReturnStatus.REJECTED
    ],
    [types_1.RepairPartReturnStatus.INSPECTED]: [
        types_1.RepairPartReturnStatus.STOCKED,
        types_1.RepairPartReturnStatus.REJECTED
    ],
    [types_1.RepairPartReturnStatus.STOCKED]: [],
    [types_1.RepairPartReturnStatus.REJECTED]: [
        types_1.RepairPartReturnStatus.PENDING_SHIP
    ]
};
function canTransition(from, to) {
    return STATUS_TRANSITIONS[from].includes(to);
}
function validateCreateRequest(request) {
    if (!request.sparePart.partName)
        return '备件名称不能为空';
    if (!request.sparePart.partCode)
        return '备件编码不能为空';
    if (!request.sparePart.partModel)
        return '备件型号不能为空';
    if (!request.sparePart.quantity || request.sparePart.quantity <= 0)
        return '备件数量必须大于0';
    if (!request.sparePart.unit)
        return '备件单位不能为空';
    if (!request.repairOrder.repairOrderNo)
        return '维修单号不能为空';
    if (!request.repairOrder.customerName)
        return '客户姓名不能为空';
    if (!request.repairOrder.customerPhone)
        return '客户电话不能为空';
    if (!request.repairOrder.faultDescription)
        return '故障描述不能为空';
    if (!request.operatorId)
        return '操作人ID不能为空';
    if (!request.operatorName)
        return '操作人姓名不能为空';
    if (!request.idempotentKey)
        return '幂等键不能为空';
    return null;
}
function validateShipRequest(request) {
    if (!request.carrier)
        return '承运商不能为空';
    if (!request.trackingNo)
        return '运单号不能为空';
    if (!request.operatorId)
        return '操作人ID不能为空';
    if (!request.operatorName)
        return '操作人姓名不能为空';
    return null;
}
function validateReceiveRequest(request) {
    if (!request.receiverName)
        return '签收人姓名不能为空';
    if (!request.operatorId)
        return '操作人ID不能为空';
    if (!request.operatorName)
        return '操作人姓名不能为空';
    return null;
}
function validateInspectionRequest(request) {
    if (!request.result)
        return '检测结果不能为空';
    if (!request.inspectorId)
        return '检测人ID不能为空';
    if (!request.inspectorName)
        return '检测人姓名不能为空';
    return null;
}
function validateStockInRequest(request) {
    if (!request.operatorId)
        return '操作人ID不能为空';
    if (!request.operatorName)
        return '操作人姓名不能为空';
    return null;
}
function buildNextStepHint(result, stockRecovered) {
    if (result === types_1.InspectionResult.FAIL && stockRecovered) {
        return '检测不通过，但库存已恢复被拦截。请补充以下材料：1) 质量检测报告 2) 维修记录 3) 现场照片 4) 客户沟通记录。待材料齐全后重新发起入库申请。';
    }
    if (result === types_1.InspectionResult.FAIL) {
        return '检测不通过。请安排维修或报废处理。';
    }
    if (result === types_1.InspectionResult.NEED_REPAIR) {
        return '需维修。请安排维修人员处理。';
    }
    if (result === types_1.InspectionResult.SCRAP) {
        return '判定报废。请走报废流程。';
    }
    return undefined;
}
class RepairPartReturnService {
    create(request) {
        const validationError = validateCreateRequest(request);
        if (validationError) {
            return {
                success: false,
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: validationError
            };
        }
        const existing = repairPartReturn_1.repairPartReturnStore.findByIdempotentKey(request.idempotentKey);
        if (existing) {
            return {
                success: false,
                code: ServiceErrorCode.IDEMPOTENT_CONFLICT,
                message: '重复请求，该幂等键已存在',
                data: existing
            };
        }
        const result = repairPartReturn_1.repairPartReturnStore.create(request);
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '创建成功',
            data: result
        };
    }
    getById(id) {
        const result = repairPartReturn_1.repairPartReturnStore.findById(id);
        if (!result) {
            return {
                success: false,
                code: ServiceErrorCode.RECORD_NOT_FOUND,
                message: '记录不存在'
            };
        }
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '查询成功',
            data: result
        };
    }
    getByReturnNo(returnNo) {
        const result = repairPartReturn_1.repairPartReturnStore.findByReturnNo(returnNo);
        if (!result) {
            return {
                success: false,
                code: ServiceErrorCode.RECORD_NOT_FOUND,
                message: '记录不存在'
            };
        }
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '查询成功',
            data: result
        };
    }
    list(page = 1, pageSize = 20, status) {
        const result = repairPartReturn_1.repairPartReturnStore.list(page, pageSize, status);
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '查询成功',
            data: {
                ...result,
                page,
                pageSize
            }
        };
    }
    ship(id, request) {
        const validationError = validateShipRequest(request);
        if (validationError) {
            return {
                success: false,
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: validationError
            };
        }
        const repairReturn = repairPartReturn_1.repairPartReturnStore.findById(id);
        if (!repairReturn) {
            return {
                success: false,
                code: ServiceErrorCode.RECORD_NOT_FOUND,
                message: '记录不存在'
            };
        }
        if (!canTransition(repairReturn.status, types_1.RepairPartReturnStatus.IN_TRANSIT)) {
            return {
                success: false,
                code: ServiceErrorCode.INVALID_STATUS_TRANSITION,
                message: `当前状态[${repairReturn.status}]不允许寄出操作`
            };
        }
        const result = repairPartReturn_1.repairPartReturnStore.ship(id, request);
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '寄出成功',
            data: result
        };
    }
    receive(id, request) {
        const validationError = validateReceiveRequest(request);
        if (validationError) {
            return {
                success: false,
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: validationError
            };
        }
        const repairReturn = repairPartReturn_1.repairPartReturnStore.findById(id);
        if (!repairReturn) {
            return {
                success: false,
                code: ServiceErrorCode.RECORD_NOT_FOUND,
                message: '记录不存在'
            };
        }
        if (!canTransition(repairReturn.status, types_1.RepairPartReturnStatus.PENDING_INSPECTION)) {
            return {
                success: false,
                code: ServiceErrorCode.INVALID_STATUS_TRANSITION,
                message: `当前状态[${repairReturn.status}]不允许签收操作`
            };
        }
        const result = repairPartReturn_1.repairPartReturnStore.receive(id, request);
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '签收成功',
            data: result
        };
    }
    inspect(id, request, stockRecovered = false) {
        const validationError = validateInspectionRequest(request);
        if (validationError) {
            return {
                success: false,
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: validationError
            };
        }
        const repairReturn = repairPartReturn_1.repairPartReturnStore.findById(id);
        if (!repairReturn) {
            return {
                success: false,
                code: ServiceErrorCode.RECORD_NOT_FOUND,
                message: '记录不存在'
            };
        }
        if (!canTransition(repairReturn.status, types_1.RepairPartReturnStatus.INSPECTED)) {
            return {
                success: false,
                code: ServiceErrorCode.INVALID_STATUS_TRANSITION,
                message: `当前状态[${repairReturn.status}]不允许检测操作`
            };
        }
        const nextStepHint = buildNextStepHint(request.result, stockRecovered);
        if (nextStepHint && request.result === types_1.InspectionResult.FAIL && stockRecovered) {
            const result = repairPartReturn_1.repairPartReturnStore.inspect(id, request, stockRecovered);
            repairPartReturn_1.repairPartReturnStore.setNextStepHint(id, nextStepHint);
            return {
                success: false,
                code: ServiceErrorCode.STOCK_RECOVERED_BLOCKED,
                message: '检测不通过，库存已恢复被拦截',
                data: result,
                nextStepHint
            };
        }
        const result = repairPartReturn_1.repairPartReturnStore.inspect(id, request, stockRecovered);
        if (nextStepHint) {
            repairPartReturn_1.repairPartReturnStore.setNextStepHint(id, nextStepHint);
        }
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '检测完成',
            data: result,
            nextStepHint
        };
    }
    stockIn(id, request) {
        const validationError = validateStockInRequest(request);
        if (validationError) {
            return {
                success: false,
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: validationError
            };
        }
        const repairReturn = repairPartReturn_1.repairPartReturnStore.findById(id);
        if (!repairReturn) {
            return {
                success: false,
                code: ServiceErrorCode.RECORD_NOT_FOUND,
                message: '记录不存在'
            };
        }
        if (!canTransition(repairReturn.status, types_1.RepairPartReturnStatus.STOCKED)) {
            return {
                success: false,
                code: ServiceErrorCode.INVALID_STATUS_TRANSITION,
                message: `当前状态[${repairReturn.status}]不允许入库操作`
            };
        }
        if (repairReturn.inspectionConclusion?.result === types_1.InspectionResult.FAIL) {
            return {
                success: false,
                code: ServiceErrorCode.INVALID_STATUS_TRANSITION,
                message: '检测不通过，不允许入库'
            };
        }
        const result = repairPartReturn_1.repairPartReturnStore.stockIn(id, request);
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '入库成功',
            data: result
        };
    }
    reject(id, operatorId, operatorName, remark) {
        const repairReturn = repairPartReturn_1.repairPartReturnStore.findById(id);
        if (!repairReturn) {
            return {
                success: false,
                code: ServiceErrorCode.RECORD_NOT_FOUND,
                message: '记录不存在'
            };
        }
        if (!canTransition(repairReturn.status, types_1.RepairPartReturnStatus.REJECTED)) {
            return {
                success: false,
                code: ServiceErrorCode.INVALID_STATUS_TRANSITION,
                message: `当前状态[${repairReturn.status}]不允许驳回操作`
            };
        }
        const result = repairPartReturn_1.repairPartReturnStore.reject(id, operatorId, operatorName, remark);
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '驳回成功',
            data: result
        };
    }
    getHistories(returnId) {
        const repairReturn = repairPartReturn_1.repairPartReturnStore.findById(returnId);
        if (!repairReturn) {
            return {
                success: false,
                code: ServiceErrorCode.RECORD_NOT_FOUND,
                message: '记录不存在'
            };
        }
        const histories = repairPartReturn_1.repairPartReturnStore.getHistories(returnId);
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '查询成功',
            data: histories
        };
    }
    async exportCsv(status) {
        const result = repairPartReturn_1.repairPartReturnStore.list(1, 10000, status);
        const csvStringifier = (0, csv_writer_1.createObjectCsvStringifier)({
            header: [
                { id: 'returnNo', title: '返厂单号' },
                { id: 'status', title: '状态' },
                { id: 'partName', title: '备件名称' },
                { id: 'partCode', title: '备件编码' },
                { id: 'partModel', title: '备件型号' },
                { id: 'quantity', title: '数量' },
                { id: 'unit', title: '单位' },
                { id: 'repairOrderNo', title: '维修单号' },
                { id: 'customerName', title: '客户姓名' },
                { id: 'customerPhone', title: '客户电话' },
                { id: 'faultDescription', title: '故障描述' },
                { id: 'carrier', title: '承运商' },
                { id: 'trackingNo', title: '运单号' },
                { id: 'inspectionResult', title: '检测结果' },
                { id: 'stockRecovered', title: '库存是否恢复' },
                { id: 'createTime', title: '创建时间' },
                { id: 'updateTime', title: '更新时间' }
            ]
        });
        const records = result.list.map(item => ({
            returnNo: item.returnNo,
            status: item.status,
            partName: item.sparePart.partName,
            partCode: item.sparePart.partCode,
            partModel: item.sparePart.partModel,
            quantity: item.sparePart.quantity,
            unit: item.sparePart.unit,
            repairOrderNo: item.repairOrder.repairOrderNo,
            customerName: item.repairOrder.customerName,
            customerPhone: item.repairOrder.customerPhone,
            faultDescription: item.repairOrder.faultDescription,
            carrier: item.shippingInfo?.carrier || '',
            trackingNo: item.shippingInfo?.trackingNo || '',
            inspectionResult: item.inspectionConclusion?.result || '',
            stockRecovered: item.stockRecovered ? '是' : '否',
            createTime: item.createTime,
            updateTime: item.updateTime
        }));
        const csv = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
        return {
            success: true,
            code: ServiceErrorCode.SUCCESS,
            message: '导出成功',
            data: csv
        };
    }
}
exports.RepairPartReturnService = RepairPartReturnService;
exports.repairPartReturnService = new RepairPartReturnService();
