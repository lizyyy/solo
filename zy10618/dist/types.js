"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewResult = exports.FlowType = exports.PlanStatus = void 0;
var PlanStatus;
(function (PlanStatus) {
    PlanStatus["RUNNING"] = "\u6295\u653E\u4E2D";
    PlanStatus["STOPPING"] = "\u6B62\u635F\u4E2D";
    PlanStatus["PENDING_COMPENSATION"] = "\u5F85\u8865\u507F";
    PlanStatus["CLOSED"] = "\u5DF2\u5173\u95ED";
})(PlanStatus || (exports.PlanStatus = PlanStatus = {}));
var FlowType;
(function (FlowType) {
    FlowType["NORMAL"] = "\u6B63\u5E38\u6D41";
    FlowType["REJECT"] = "\u9A73\u56DE\u6D41";
    FlowType["MANUAL_REVIEW"] = "\u4EBA\u5DE5\u590D\u6838\u6D41";
})(FlowType || (exports.FlowType = FlowType = {}));
var ReviewResult;
(function (ReviewResult) {
    ReviewResult["APPROVED"] = "\u901A\u8FC7";
    ReviewResult["REJECTED"] = "\u9A73\u56DE";
})(ReviewResult || (exports.ReviewResult = ReviewResult = {}));
