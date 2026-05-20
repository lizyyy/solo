"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationType = exports.RecordStatus = void 0;
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING"] = "pending";
    RecordStatus["APPROVED"] = "approved";
    RecordStatus["REJECTED"] = "rejected";
    RecordStatus["RETURNED"] = "returned";
    RecordStatus["WAITLISTED"] = "waitlisted";
    RecordStatus["PROCESSED"] = "processed";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
var OperationType;
(function (OperationType) {
    OperationType["IMPORT"] = "import";
    OperationType["CREATE_BATCH"] = "create_batch";
    OperationType["MARK_PROCESSED"] = "mark_processed";
    OperationType["RETURN"] = "return";
    OperationType["EXPORT"] = "export";
    OperationType["WAITLIST"] = "waitlist";
    OperationType["CONTRAINDICATION_BLOCK"] = "contraindication_block";
    OperationType["DUPLICATE_BLOCK"] = "duplicate_block";
    OperationType["APPROVE"] = "approve";
    OperationType["REJECT"] = "reject";
})(OperationType || (exports.OperationType = OperationType = {}));
