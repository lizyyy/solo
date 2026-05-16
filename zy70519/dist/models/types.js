"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryStatus = exports.NodeStatus = exports.KeyStatus = exports.BatchStatus = void 0;
var BatchStatus;
(function (BatchStatus) {
    BatchStatus["PENDING"] = "pending";
    BatchStatus["RUNNING"] = "running";
    BatchStatus["PAUSED"] = "paused";
    BatchStatus["COMPLETED"] = "completed";
    BatchStatus["FAILED"] = "failed";
    BatchStatus["PARTIAL"] = "partial";
})(BatchStatus || (exports.BatchStatus = BatchStatus = {}));
var KeyStatus;
(function (KeyStatus) {
    KeyStatus["PENDING"] = "pending";
    KeyStatus["PROCESSING"] = "processing";
    KeyStatus["SUCCESS"] = "success";
    KeyStatus["FAILED"] = "failed";
    KeyStatus["SKIPPED"] = "skipped";
    KeyStatus["RETRYING"] = "retrying";
})(KeyStatus || (exports.KeyStatus = KeyStatus = {}));
var NodeStatus;
(function (NodeStatus) {
    NodeStatus["ONLINE"] = "online";
    NodeStatus["OFFLINE"] = "offline";
    NodeStatus["BUSY"] = "busy";
    NodeStatus["IDLE"] = "idle";
})(NodeStatus || (exports.NodeStatus = NodeStatus = {}));
var RetryStatus;
(function (RetryStatus) {
    RetryStatus["PENDING"] = "pending";
    RetryStatus["RUNNING"] = "running";
    RetryStatus["SUCCESS"] = "success";
    RetryStatus["FAILED"] = "failed";
})(RetryStatus || (exports.RetryStatus = RetryStatus = {}));
