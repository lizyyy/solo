"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalNode = exports.ProcessingStatus = exports.RiskType = void 0;
var RiskType;
(function (RiskType) {
    RiskType["PATH_ERROR"] = "compression_path_error";
    RiskType["DATA_INCONSISTENCY"] = "data_inconsistency";
    RiskType["TIMEOUT"] = "processing_timeout";
    RiskType["FORMAT_ERROR"] = "format_error";
    RiskType["DUPLICATE_RECORD"] = "duplicate_record";
    RiskType["MANUAL_REVIEW"] = "manual_review_required";
})(RiskType || (exports.RiskType = RiskType = {}));
var ProcessingStatus;
(function (ProcessingStatus) {
    ProcessingStatus["PENDING"] = "pending";
    ProcessingStatus["PROCESSING"] = "processing";
    ProcessingStatus["SUCCESS"] = "success";
    ProcessingStatus["FAILED"] = "failed";
    ProcessingStatus["MANUAL_CORRECTED"] = "manual_corrected";
})(ProcessingStatus || (exports.ProcessingStatus = ProcessingStatus = {}));
var ApprovalNode;
(function (ApprovalNode) {
    ApprovalNode["UPLOAD"] = "upload";
    ApprovalNode["PRE_CHECK"] = "pre_check";
    ApprovalNode["DATA_EXTRACTION"] = "data_extraction";
    ApprovalNode["RISK_ASSESSMENT"] = "risk_assessment";
    ApprovalNode["FINAL_REVIEW"] = "final_review";
    ApprovalNode["COMPLETED"] = "completed";
})(ApprovalNode || (exports.ApprovalNode = ApprovalNode = {}));
