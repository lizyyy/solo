"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportStatus = exports.ExportType = exports.EntityType = exports.FlowAction = exports.ReviewPriority = exports.ReviewStatus = exports.VoidReason = exports.MarketInspectionResult = exports.TransportStatus = exports.CertificateSource = exports.CertificateStatus = void 0;
var CertificateStatus;
(function (CertificateStatus) {
    CertificateStatus["ISSUED"] = "issued";
    CertificateStatus["BATCH_BOUND"] = "batch_bound";
    CertificateStatus["IN_TRANSPORT"] = "in_transport";
    CertificateStatus["TRANSPORT_VERIFIED"] = "transport_verified";
    CertificateStatus["MARKET_ACCEPTED"] = "market_accepted";
    CertificateStatus["VOIDED"] = "voided";
    CertificateStatus["MANUALLY_CORRECTED"] = "manually_corrected";
    CertificateStatus["DUPLICATE_DETECTED"] = "duplicate_detected";
})(CertificateStatus || (exports.CertificateStatus = CertificateStatus = {}));
var CertificateSource;
(function (CertificateSource) {
    CertificateSource["FARM"] = "farm";
    CertificateSource["SLAUGHTERHOUSE"] = "slaughterhouse";
    CertificateSource["TRANSPORT"] = "transport";
    CertificateSource["MARKET"] = "market";
})(CertificateSource || (exports.CertificateSource = CertificateSource = {}));
var TransportStatus;
(function (TransportStatus) {
    TransportStatus["PENDING"] = "pending";
    TransportStatus["IN_PROGRESS"] = "in_progress";
    TransportStatus["VERIFIED"] = "verified";
    TransportStatus["REJECTED"] = "rejected";
})(TransportStatus || (exports.TransportStatus = TransportStatus = {}));
var MarketInspectionResult;
(function (MarketInspectionResult) {
    MarketInspectionResult["ACCEPTED"] = "accepted";
    MarketInspectionResult["REJECTED"] = "rejected";
    MarketInspectionResult["NEEDS_REVIEW"] = "needs_review";
})(MarketInspectionResult || (exports.MarketInspectionResult = MarketInspectionResult = {}));
var VoidReason;
(function (VoidReason) {
    VoidReason["DUPLICATE"] = "duplicate";
    VoidReason["ERROR"] = "error";
    VoidReason["CANCELLED"] = "cancelled";
    VoidReason["OTHER"] = "other";
})(VoidReason || (exports.VoidReason = VoidReason = {}));
var ReviewStatus;
(function (ReviewStatus) {
    ReviewStatus["PENDING"] = "pending";
    ReviewStatus["APPROVED"] = "approved";
    ReviewStatus["REJECTED"] = "rejected";
    ReviewStatus["RESOLVED"] = "resolved";
})(ReviewStatus || (exports.ReviewStatus = ReviewStatus = {}));
var ReviewPriority;
(function (ReviewPriority) {
    ReviewPriority["HIGH"] = "high";
    ReviewPriority["MEDIUM"] = "medium";
    ReviewPriority["LOW"] = "low";
})(ReviewPriority || (exports.ReviewPriority = ReviewPriority = {}));
var FlowAction;
(function (FlowAction) {
    FlowAction["CERTIFICATE_ISSUED"] = "certificate_issued";
    FlowAction["BATCH_BOUND"] = "batch_bound";
    FlowAction["BATCH_UNBOUND"] = "batch_unbound";
    FlowAction["TRANSPORT_STARTED"] = "transport_started";
    FlowAction["TRANSPORT_VERIFIED"] = "transport_verified";
    FlowAction["TRANSPORT_REJECTED"] = "transport_rejected";
    FlowAction["MARKET_ACCEPTED"] = "market_accepted";
    FlowAction["MARKET_REJECTED"] = "market_rejected";
    FlowAction["CERTIFICATE_VOIDED"] = "certificate_voided";
    FlowAction["CERTIFICATE_REISSUED"] = "certificate_reissued";
    FlowAction["DUPLICATE_DETECTED"] = "duplicate_detected";
    FlowAction["MANUAL_CORRECTION"] = "manual_correction";
    FlowAction["REVIEW_CREATED"] = "review_created";
    FlowAction["REVIEW_RESOLVED"] = "review_resolved";
    FlowAction["EXPORT_REQUESTED"] = "export_requested";
    FlowAction["EXPORT_COMPLETED"] = "export_completed";
})(FlowAction || (exports.FlowAction = FlowAction = {}));
var EntityType;
(function (EntityType) {
    EntityType["CERTIFICATE"] = "certificate";
    EntityType["BATCH"] = "batch";
    EntityType["TRANSPORT"] = "transport";
    EntityType["MARKET_INSPECTION"] = "market_inspection";
    EntityType["VOID_RECORD"] = "void_record";
    EntityType["REVIEW_TASK"] = "review_task";
})(EntityType || (exports.EntityType = EntityType = {}));
var ExportType;
(function (ExportType) {
    ExportType["DAILY_REPORT"] = "daily_report";
    ExportType["DUPLICATE_ANALYSIS"] = "duplicate_analysis";
    ExportType["FLOW_HISTORY"] = "flow_history";
    ExportType["REVIEW_SUMMARY"] = "review_summary";
    ExportType["COMPLIANCE_CHECK"] = "compliance_check";
})(ExportType || (exports.ExportType = ExportType = {}));
var ExportStatus;
(function (ExportStatus) {
    ExportStatus["PENDING"] = "pending";
    ExportStatus["PROCESSING"] = "processing";
    ExportStatus["COMPLETED"] = "completed";
    ExportStatus["FAILED"] = "failed";
})(ExportStatus || (exports.ExportStatus = ExportStatus = {}));
//# sourceMappingURL=index.js.map