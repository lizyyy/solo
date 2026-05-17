"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationStatus = exports.DeliveryBatchStatus = void 0;
var DeliveryBatchStatus;
(function (DeliveryBatchStatus) {
    DeliveryBatchStatus["CREATED"] = "CREATED";
    DeliveryBatchStatus["PACKAGES_UPLOADED"] = "PACKAGES_UPLOADED";
    DeliveryBatchStatus["MANIFEST_VERIFIED"] = "MANIFEST_VERIFIED";
    DeliveryBatchStatus["SIGNATURE_VERIFIED"] = "SIGNATURE_VERIFIED";
    DeliveryBatchStatus["PATCH_ORDER_VERIFIED"] = "PATCH_ORDER_VERIFIED";
    DeliveryBatchStatus["COMPLETED"] = "COMPLETED";
    DeliveryBatchStatus["ERROR"] = "ERROR";
})(DeliveryBatchStatus || (exports.DeliveryBatchStatus = DeliveryBatchStatus = {}));
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["PENDING"] = "PENDING";
    VerificationStatus["PASSED"] = "PASSED";
    VerificationStatus["FAILED"] = "FAILED";
    VerificationStatus["MANUALLY_FIXED"] = "MANUALLY_FIXED";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
