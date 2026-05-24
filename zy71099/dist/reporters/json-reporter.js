"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonReporter = void 0;
const base_reporter_1 = require("./base-reporter");
class JsonReporter extends base_reporter_1.BaseReporter {
    generate() {
        const report = {
            metadata: {
                generatedAt: this.result.generatedAt,
                version: '1.0.0',
                expectedFile: this.expectedFile,
                actualFile: this.actualFile
            },
            summary: this.result.summary,
            config: this.result.config,
            differences: this.result.differences.map(diff => ({
                interactionId: diff.interactionId,
                type: diff.type,
                severity: diff.severity,
                message: diff.message,
                details: diff.details,
                expectedSource: diff.expectedSource,
                actualSource: diff.actualSource
            })),
            exitCode: {
                code: this.result.exitCode,
                explanation: this.getExitCodeExplanation()
            }
        };
        return JSON.stringify(report, null, 2);
    }
    getFileName() {
        return 'cassette-diff.json';
    }
}
exports.JsonReporter = JsonReporter;
//# sourceMappingURL=json-reporter.js.map