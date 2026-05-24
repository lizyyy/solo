"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExitCode = exports.SamplingDecision = void 0;
var SamplingDecision;
(function (SamplingDecision) {
    SamplingDecision["RECORD_AND_SAMPLE"] = "RECORD_AND_SAMPLE";
    SamplingDecision["RECORD_ONLY"] = "RECORD_ONLY";
    SamplingDecision["DROP"] = "DROP";
    SamplingDecision["NOT_APPLICABLE"] = "NOT_APPLICABLE";
})(SamplingDecision || (exports.SamplingDecision = SamplingDecision = {}));
var ExitCode;
(function (ExitCode) {
    ExitCode[ExitCode["SUCCESS"] = 0] = "SUCCESS";
    ExitCode[ExitCode["VALIDATION_ERROR"] = 1] = "VALIDATION_ERROR";
    ExitCode[ExitCode["INPUT_ERROR"] = 2] = "INPUT_ERROR";
    ExitCode[ExitCode["PROCESSING_ERROR"] = 3] = "PROCESSING_ERROR";
    ExitCode[ExitCode["BUDGET_EXCEEDED"] = 4] = "BUDGET_EXCEEDED";
    ExitCode[ExitCode["TRACES_DROPPED"] = 5] = "TRACES_DROPPED";
})(ExitCode || (exports.ExitCode = ExitCode = {}));
//# sourceMappingURL=types.js.map