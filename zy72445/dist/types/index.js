"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisplayMode = exports.WorkflowStep = exports.ApprovalStatus = void 0;
var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["PENDING"] = "pending";
    ApprovalStatus["REVIEWING"] = "reviewing";
    ApprovalStatus["APPROVED"] = "approved";
    ApprovalStatus["REJECTED"] = "rejected";
    ApprovalStatus["REWORK_REQUIRED"] = "rework_required";
    ApprovalStatus["NORMAL"] = "normal";
})(ApprovalStatus || (exports.ApprovalStatus = ApprovalStatus = {}));
var WorkflowStep;
(function (WorkflowStep) {
    WorkflowStep["ALIAS_IMPORT"] = "alias_import";
    WorkflowStep["PHOTO_REVIEW"] = "photo_review";
    WorkflowStep["REHEARSAL_UPDATE"] = "rehearsal_update";
})(WorkflowStep || (exports.WorkflowStep = WorkflowStep = {}));
var DisplayMode;
(function (DisplayMode) {
    DisplayMode["LIST"] = "list";
    DisplayMode["CHART"] = "chart";
    DisplayMode["THREE_D"] = "three_d";
})(DisplayMode || (exports.DisplayMode = DisplayMode = {}));
//# sourceMappingURL=index.js.map