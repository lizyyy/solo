"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditAction = exports.AttachmentType = exports.ReturnStatus = void 0;
var ReturnStatus;
(function (ReturnStatus) {
    ReturnStatus["BATCH_CREATED"] = "BATCH_CREATED";
    ReturnStatus["ATTACHMENTS_PENDING"] = "ATTACHMENTS_PENDING";
    ReturnStatus["ATTACHMENTS_COMPLETE"] = "ATTACHMENTS_COMPLETE";
    ReturnStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    ReturnStatus["REVIEW_APPROVED"] = "REVIEW_APPROVED";
    ReturnStatus["REVIEW_REJECTED"] = "REVIEW_REJECTED";
    ReturnStatus["SETTLEMENT_FROZEN"] = "SETTLEMENT_FROZEN";
    ReturnStatus["SETTLEMENT_COMPLETED"] = "SETTLEMENT_COMPLETED";
    ReturnStatus["RETURNED"] = "RETURNED";
    ReturnStatus["ARCHIVED"] = "ARCHIVED";
})(ReturnStatus || (exports.ReturnStatus = ReturnStatus = {}));
var AttachmentType;
(function (AttachmentType) {
    AttachmentType["OUTBOUND_ORDER"] = "OUTBOUND_ORDER";
    AttachmentType["RETURN_PHOTO"] = "RETURN_PHOTO";
    AttachmentType["MAINTENANCE_ESTIMATE"] = "MAINTENANCE_ESTIMATE";
    AttachmentType["REFUND_RECEIPT"] = "REFUND_RECEIPT";
    AttachmentType["INVENTORY_REPORT"] = "INVENTORY_REPORT";
})(AttachmentType || (exports.AttachmentType = AttachmentType = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["STATUS_CHANGE"] = "STATUS_CHANGE";
    AuditAction["ATTACHMENT_UPLOAD"] = "ATTACHMENT_UPLOAD";
    AuditAction["ATTACHMENT_DELETE"] = "ATTACHMENT_DELETE";
    AuditAction["MANUAL_EDIT"] = "MANUAL_EDIT";
    AuditAction["FREEZE"] = "FREEZE";
    AuditAction["UNFREEZE"] = "UNFREEZE";
    AuditAction["ARCHIVE"] = "ARCHIVE";
    AuditAction["UNARCHIVE"] = "UNARCHIVE";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
//# sourceMappingURL=index.js.map