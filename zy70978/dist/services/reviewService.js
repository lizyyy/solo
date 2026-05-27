"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewService = exports.ReviewService = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const dataStore_1 = require("../store/dataStore");
const reconciliationEngine_1 = require("./reconciliationEngine");
class ReviewService {
    updateOrderStatus(orderNo, newStatus, reviewer, comments, modifiedFields = []) {
        const order = dataStore_1.dataStore.getRentalOrderByNo(orderNo);
        if (!order) {
            throw new Error(`订单不存在: ${orderNo}`);
        }
        const previousStatus = order.status;
        if (previousStatus === newStatus) {
            throw new Error(`订单状态已是 ${newStatus}，无需更新`);
        }
        dataStore_1.dataStore.updateRentalOrder(order.id, { status: newStatus });
        const reviewRecord = {
            orderNo,
            reviewer,
            reviewDate: (0, dayjs_1.default)().toISOString(),
            previousStatus,
            newStatus,
            comments,
            modifiedFields,
        };
        const savedRecord = dataStore_1.dataStore.addReviewRecord(reviewRecord);
        reconciliationEngine_1.reconciliationEngine.reconcileOrder(orderNo);
        return savedRecord;
    }
    approveOrder(orderNo, reviewer, comments = '复核通过，同意按当前计算结果结算') {
        return this.updateOrderStatus(orderNo, 'approved', reviewer, comments, [
            'status',
        ]);
    }
    rejectOrder(orderNo, reviewer, comments) {
        if (!comments || comments.trim().length < 5) {
            throw new Error('退回订单必须填写详细原因');
        }
        return this.updateOrderStatus(orderNo, 'rejected', reviewer, comments, [
            'status',
        ]);
    }
    requestMoreInfo(orderNo, reviewer, comments) {
        if (!comments || comments.trim().length < 5) {
            throw new Error('要求补充材料必须说明需要哪些信息');
        }
        return this.updateOrderStatus(orderNo, 'need_more_info', reviewer, comments, [
            'status',
        ]);
    }
    resetToPending(orderNo, reviewer, comments) {
        return this.updateOrderStatus(orderNo, 'pending', reviewer, comments, [
            'status',
        ]);
    }
    updateRepairLiability(repairId, liability, reviewer, comments) {
        const repair = dataStore_1.dataStore.getRepairRecord(repairId);
        if (!repair) {
            throw new Error(`维修记录不存在: ${repairId}`);
        }
        dataStore_1.dataStore.updateRepairRecord(repairId, {
            liability,
            notes: repair.notes
                ? `${repair.notes}\n[${(0, dayjs_1.default)().format('YYYY-MM-DD')}] ${reviewer}: ${comments}`
                : `[${(0, dayjs_1.default)().format('YYYY-MM-DD')}] ${reviewer}: ${comments}`,
        });
        if (repair.boundOrderNo) {
            reconciliationEngine_1.reconciliationEngine.reconcileOrder(repair.boundOrderNo);
        }
    }
    bindRepairToOrder(repairId, orderNo) {
        const repair = dataStore_1.dataStore.getRepairRecord(repairId);
        const order = dataStore_1.dataStore.getRentalOrderByNo(orderNo);
        if (!repair) {
            throw new Error(`维修记录不存在: ${repairId}`);
        }
        if (!order) {
            throw new Error(`订单不存在: ${orderNo}`);
        }
        if (repair.equipmentSerialNo !== order.equipmentSerialNo) {
            throw new Error('维修记录与订单设备序列号不匹配');
        }
        dataStore_1.dataStore.updateRepairRecord(repairId, {
            isBoundToOrder: true,
            boundOrderNo: orderNo,
        });
        reconciliationEngine_1.reconciliationEngine.reconcileOrder(orderNo);
    }
    unbindRepairFromOrder(repairId) {
        const repair = dataStore_1.dataStore.getRepairRecord(repairId);
        if (!repair) {
            throw new Error(`维修记录不存在: ${repairId}`);
        }
        const orderNo = repair.boundOrderNo;
        dataStore_1.dataStore.updateRepairRecord(repairId, {
            isBoundToOrder: false,
            boundOrderNo: undefined,
        });
        if (orderNo) {
            reconciliationEngine_1.reconciliationEngine.reconcileOrder(orderNo);
        }
    }
    getOrderReviewHistory(orderNo) {
        return dataStore_1.dataStore.getReviewRecordsByOrderNo(orderNo);
    }
    getStatusExplanation(status) {
        const explanations = {
            pending: '待复核 - 订单已导入，等待人工审核确认',
            approved: '已通过 - 复核通过，可按计算结果进行结算',
            rejected: '已退回 - 订单存在问题，需重新处理或取消',
            need_more_info: '待补充 - 需要提供更多信息或材料后继续处理',
        };
        return explanations[status] || '未知状态';
    }
}
exports.ReviewService = ReviewService;
exports.reviewService = new ReviewService();
