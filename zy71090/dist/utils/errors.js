"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisError = exports.ParseError = exports.FileNotFoundError = exports.ValidationError = exports.CLIError = void 0;
exports.formatErrorMessage = formatErrorMessage;
const types_1 = require("../types");
class CLIError extends Error {
    constructor(message, exitCode = types_1.EXIT_CODES.ERROR_ANALYSIS_FAILED) {
        super(message);
        this.name = 'CLIError';
        this.exitCode = exitCode;
    }
}
exports.CLIError = CLIError;
class ValidationError extends CLIError {
    constructor(message) {
        super(message, types_1.EXIT_CODES.ERROR_INVALID_ARGS);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class FileNotFoundError extends CLIError {
    constructor(filePath) {
        super(`文件不存在: ${filePath}`, types_1.EXIT_CODES.ERROR_FILE_NOT_FOUND);
        this.name = 'FileNotFoundError';
    }
}
exports.FileNotFoundError = FileNotFoundError;
class ParseError extends CLIError {
    constructor(message) {
        super(message, types_1.EXIT_CODES.ERROR_PARSE_FAILED);
        this.name = 'ParseError';
    }
}
exports.ParseError = ParseError;
class AnalysisError extends CLIError {
    constructor(message) {
        super(message, types_1.EXIT_CODES.ERROR_ANALYSIS_FAILED);
        this.name = 'AnalysisError';
    }
}
exports.AnalysisError = AnalysisError;
function formatErrorMessage(error, verbose = false) {
    if (error instanceof CLIError) {
        return error.message;
    }
    if (error instanceof Error) {
        return verbose ? error.stack || error.message : error.message;
    }
    return String(error);
}
//# sourceMappingURL=errors.js.map