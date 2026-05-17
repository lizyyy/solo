"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceSystemLabel = exports.SourceSystem = exports.CorrectionReasonLabel = exports.CorrectionReason = exports.CorrectionStatusLabel = exports.CorrectionStatus = void 0;
var CorrectionStatus;
(function (CorrectionStatus) {
    CorrectionStatus["CAN_TRY"] = "can_try";
    CorrectionStatus["ABNORMAL_PENDING"] = "abnormal_pending";
    CorrectionStatus["CORRECTED"] = "corrected";
    CorrectionStatus["REVOKED"] = "revoked";
})(CorrectionStatus || (exports.CorrectionStatus = CorrectionStatus = {}));
exports.CorrectionStatusLabel = {
    [CorrectionStatus.CAN_TRY]: '可试看',
    [CorrectionStatus.ABNORMAL_PENDING]: '异常待判',
    [CorrectionStatus.CORRECTED]: '已纠偏',
    [CorrectionStatus.REVOKED]: '已撤销'
};
var CorrectionReason;
(function (CorrectionReason) {
    CorrectionReason["PAID_USER_BLOCKED_BY_OLD_RULE"] = "paid_user_blocked_by_old_rule";
    CorrectionReason["NEW_RULE_APPLIED"] = "new_rule_applied";
    CorrectionReason["MANUAL_CORRECTION"] = "manual_correction";
    CorrectionReason["DUPLICATE_CONFLICT"] = "duplicate_conflict";
    CorrectionReason["SYSTEM_ERROR"] = "system_error";
    CorrectionReason["DATA_INCONSISTENCY"] = "data_inconsistency";
})(CorrectionReason || (exports.CorrectionReason = CorrectionReason = {}));
exports.CorrectionReasonLabel = {
    [CorrectionReason.PAID_USER_BLOCKED_BY_OLD_RULE]: '付费用户被旧试看规则限制播放',
    [CorrectionReason.NEW_RULE_APPLIED]: '新试看规则已生效',
    [CorrectionReason.MANUAL_CORRECTION]: '人工手动纠偏',
    [CorrectionReason.DUPLICATE_CONFLICT]: '多系统数据冲突',
    [CorrectionReason.SYSTEM_ERROR]: '系统异常',
    [CorrectionReason.DATA_INCONSISTENCY]: '数据不一致'
};
var SourceSystem;
(function (SourceSystem) {
    SourceSystem["VOD_BACKEND"] = "vod_backend";
    SourceSystem["USER_CENTER"] = "user_center";
    SourceSystem["ORDER_SYSTEM"] = "order_system";
    SourceSystem["CONTENT_MANAGEMENT"] = "content_management";
    SourceSystem["IMPORT_BATCH"] = "import_batch";
})(SourceSystem || (exports.SourceSystem = SourceSystem = {}));
exports.SourceSystemLabel = {
    [SourceSystem.VOD_BACKEND]: '视频点播后台',
    [SourceSystem.USER_CENTER]: '用户中心',
    [SourceSystem.ORDER_SYSTEM]: '订单系统',
    [SourceSystem.CONTENT_MANAGEMENT]: '内容管理系统',
    [SourceSystem.IMPORT_BATCH]: '批量导入'
};
