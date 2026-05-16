"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationStatus = exports.ExportRequestStatus = void 0;
var ExportRequestStatus;
(function (ExportRequestStatus) {
    ExportRequestStatus["PENDING"] = "pending";
    ExportRequestStatus["APPROVED"] = "approved";
    ExportRequestStatus["REJECTED"] = "rejected";
    ExportRequestStatus["PROCESSING"] = "processing";
    ExportRequestStatus["COMPLETED"] = "completed";
    ExportRequestStatus["FAILED"] = "failed";
})(ExportRequestStatus || (exports.ExportRequestStatus = ExportRequestStatus = {}));
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["PENDING"] = "pending";
    VerificationStatus["VERIFIED"] = "verified";
    VerificationStatus["FAILED"] = "failed";
    VerificationStatus["PARTIAL"] = "partial";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
