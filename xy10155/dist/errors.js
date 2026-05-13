"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = void 0;
exports.exitWithError = exitWithError;
class CLIError extends Error {
    constructor(message, exitCode = 1) {
        super(message);
        this.name = 'CLIError';
        this.exitCode = exitCode;
    }
}
exports.CLIError = CLIError;
function exitWithError(message, exitCode = 1) {
    throw new CLIError(message, exitCode);
}
