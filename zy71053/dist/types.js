"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExitCode = void 0;
var ExitCode;
(function (ExitCode) {
    ExitCode[ExitCode["SUCCESS"] = 0] = "SUCCESS";
    ExitCode[ExitCode["CRITICAL_ISSUES"] = 1] = "CRITICAL_ISSUES";
    ExitCode[ExitCode["HIGH_ISSUES"] = 2] = "HIGH_ISSUES";
    ExitCode[ExitCode["INPUT_ERROR"] = 3] = "INPUT_ERROR";
    ExitCode[ExitCode["SCHEMA_PARSE_ERROR"] = 4] = "SCHEMA_PARSE_ERROR";
    ExitCode[ExitCode["QUERY_PARSE_ERROR"] = 5] = "QUERY_PARSE_ERROR";
    ExitCode[ExitCode["MISSING_HISTORY"] = 6] = "MISSING_HISTORY";
    ExitCode[ExitCode["SELF_TEST_FAILED"] = 7] = "SELF_TEST_FAILED";
})(ExitCode || (exports.ExitCode = ExitCode = {}));
//# sourceMappingURL=types.js.map