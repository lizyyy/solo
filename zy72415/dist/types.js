"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowStep = exports.ProcessingStatus = void 0;
var ProcessingStatus;
(function (ProcessingStatus) {
    ProcessingStatus["PENDING_REVIEW"] = "pending_review";
    ProcessingStatus["NORMAL"] = "normal";
    ProcessingStatus["ABNORMAL"] = "abnormal";
    ProcessingStatus["NEEDS_TEACHER_REVIEW"] = "needs_teacher_review";
})(ProcessingStatus || (exports.ProcessingStatus = ProcessingStatus = {}));
var WorkflowStep;
(function (WorkflowStep) {
    WorkflowStep["INITIAL_IMPORT"] = "initial_import";
    WorkflowStep["ENGINEER_MESSAGE_ADDED"] = "engineer_message_added";
    WorkflowStep["WEEKLY_REPORT_UPDATED"] = "weekly_report_updated";
})(WorkflowStep || (exports.WorkflowStep = WorkflowStep = {}));
