"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationSource = exports.CertificateStatus = void 0;
var CertificateStatus;
(function (CertificateStatus) {
    CertificateStatus["PENDING_UPLOAD"] = "pending_upload";
    CertificateStatus["VERIFYING"] = "verifying";
    CertificateStatus["DEPLOYED"] = "deployed";
    CertificateStatus["NEED_ROLLBACK"] = "need_rollback";
})(CertificateStatus || (exports.CertificateStatus = CertificateStatus = {}));
var OperationSource;
(function (OperationSource) {
    OperationSource["FRONTEND"] = "frontend";
    OperationSource["BACKEND"] = "backend";
    OperationSource["API"] = "api";
    OperationSource["IMPORT"] = "import";
})(OperationSource || (exports.OperationSource = OperationSource = {}));
