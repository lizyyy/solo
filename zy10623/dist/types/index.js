"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CarrierLabel = exports.Carrier = exports.InspectionResultLabel = exports.InspectionResult = exports.RepairPartReturnStatusLabel = exports.RepairPartReturnStatus = exports.RefundReasonLabel = exports.RefundReason = exports.ReviewConclusionLabel = exports.ReviewConclusion = exports.RiskTagLabel = exports.RiskTag = exports.RefundReviewStatusLabel = exports.RefundReviewStatus = void 0;
var RefundReviewStatus;
(function (RefundReviewStatus) {
    RefundReviewStatus["PENDING_REFUND"] = "PENDING_REFUND";
    RefundReviewStatus["INTERCEPTING"] = "INTERCEPTING";
    RefundReviewStatus["APPROVED"] = "APPROVED";
    RefundReviewStatus["REJECTED"] = "REJECTED";
})(RefundReviewStatus || (exports.RefundReviewStatus = RefundReviewStatus = {}));
exports.RefundReviewStatusLabel = {
    [RefundReviewStatus.PENDING_REFUND]: '待退款',
    [RefundReviewStatus.INTERCEPTING]: '拦截中',
    [RefundReviewStatus.APPROVED]: '放行',
    [RefundReviewStatus.REJECTED]: '拒绝'
};
var RiskTag;
(function (RiskTag) {
    RiskTag["SUSPICIOUS_FREQUENCY"] = "SUSPICIOUS_FREQUENCY";
    RiskTag["SPLIT_ORDER_EVASION"] = "SPLIT_ORDER_EVASION";
    RiskTag["ABNORMAL_REFUND_AMOUNT"] = "ABNORMAL_REFUND_AMOUNT";
    RiskTag["NEW_USER_RISK"] = "NEW_USER_RISK";
    RiskTag["HISTORICAL_FRAUD"] = "HISTORICAL_FRAUD";
    RiskTag["IP_ABNORMAL"] = "IP_ABNORMAL";
})(RiskTag || (exports.RiskTag = RiskTag = {}));
exports.RiskTagLabel = {
    [RiskTag.SUSPICIOUS_FREQUENCY]: '退款频率异常',
    [RiskTag.SPLIT_ORDER_EVASION]: '拆单绕开阈值',
    [RiskTag.ABNORMAL_REFUND_AMOUNT]: '退款金额异常',
    [RiskTag.NEW_USER_RISK]: '新用户风险',
    [RiskTag.HISTORICAL_FRAUD]: '历史欺诈记录',
    [RiskTag.IP_ABNORMAL]: 'IP异常'
};
var ReviewConclusion;
(function (ReviewConclusion) {
    ReviewConclusion["MANUAL_APPROVE"] = "MANUAL_APPROVE";
    ReviewConclusion["MANUAL_REJECT"] = "MANUAL_REJECT";
    ReviewConclusion["AUTO_APPROVE"] = "AUTO_APPROVE";
    ReviewConclusion["AUTO_REJECT"] = "AUTO_REJECT";
})(ReviewConclusion || (exports.ReviewConclusion = ReviewConclusion = {}));
exports.ReviewConclusionLabel = {
    [ReviewConclusion.MANUAL_APPROVE]: '人工放行',
    [ReviewConclusion.MANUAL_REJECT]: '人工拒绝',
    [ReviewConclusion.AUTO_APPROVE]: '自动放行',
    [ReviewConclusion.AUTO_REJECT]: '自动拒绝'
};
var RefundReason;
(function (RefundReason) {
    RefundReason["QUALITY_ISSUE"] = "QUALITY_ISSUE";
    RefundReason["WRONG_ITEM"] = "WRONG_ITEM";
    RefundReason["DAMAGED"] = "DAMAGED";
    RefundReason["NOT_AS_DESCRIBED"] = "NOT_AS_DESCRIBED";
    RefundReason["CHANGE_MIND"] = "CHANGE_MIND";
    RefundReason["OTHER"] = "OTHER";
})(RefundReason || (exports.RefundReason = RefundReason = {}));
exports.RefundReasonLabel = {
    [RefundReason.QUALITY_ISSUE]: '质量问题',
    [RefundReason.WRONG_ITEM]: '发错商品',
    [RefundReason.DAMAGED]: '商品破损',
    [RefundReason.NOT_AS_DESCRIBED]: '与描述不符',
    [RefundReason.CHANGE_MIND]: '不想要了',
    [RefundReason.OTHER]: '其他原因'
};
var RepairPartReturnStatus;
(function (RepairPartReturnStatus) {
    RepairPartReturnStatus["PENDING_SHIP"] = "PENDING_SHIP";
    RepairPartReturnStatus["IN_TRANSIT"] = "IN_TRANSIT";
    RepairPartReturnStatus["PENDING_INSPECTION"] = "PENDING_INSPECTION";
    RepairPartReturnStatus["INSPECTED"] = "INSPECTED";
    RepairPartReturnStatus["STOCKED"] = "STOCKED";
    RepairPartReturnStatus["REJECTED"] = "REJECTED";
})(RepairPartReturnStatus || (exports.RepairPartReturnStatus = RepairPartReturnStatus = {}));
exports.RepairPartReturnStatusLabel = {
    [RepairPartReturnStatus.PENDING_SHIP]: '待寄出',
    [RepairPartReturnStatus.IN_TRANSIT]: '返厂中',
    [RepairPartReturnStatus.PENDING_INSPECTION]: '待检测',
    [RepairPartReturnStatus.INSPECTED]: '已检测',
    [RepairPartReturnStatus.STOCKED]: '已入库',
    [RepairPartReturnStatus.REJECTED]: '驳回'
};
var InspectionResult;
(function (InspectionResult) {
    InspectionResult["PASS"] = "PASS";
    InspectionResult["FAIL"] = "FAIL";
    InspectionResult["NEED_REPAIR"] = "NEED_REPAIR";
    InspectionResult["SCRAP"] = "SCRAP";
})(InspectionResult || (exports.InspectionResult = InspectionResult = {}));
exports.InspectionResultLabel = {
    [InspectionResult.PASS]: '检测通过',
    [InspectionResult.FAIL]: '检测不通过',
    [InspectionResult.NEED_REPAIR]: '需维修',
    [InspectionResult.SCRAP]: '报废'
};
var Carrier;
(function (Carrier) {
    Carrier["SF"] = "SF";
    Carrier["JD"] = "JD";
    Carrier["ZTO"] = "ZTO";
    Carrier["YTO"] = "YTO";
    Carrier["EMS"] = "EMS";
})(Carrier || (exports.Carrier = Carrier = {}));
exports.CarrierLabel = {
    [Carrier.SF]: '顺丰',
    [Carrier.JD]: '京东',
    [Carrier.ZTO]: '中通',
    [Carrier.YTO]: '圆通',
    [Carrier.EMS]: 'EMS'
};
