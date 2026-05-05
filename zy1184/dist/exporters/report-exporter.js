"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportSummaryCsv = exports.exportCsv = exports.exportJson = exports.exportMarkdown = void 0;
exports.exportReport = exportReport;
exports.exportReportsBatch = exportReportsBatch;
const markdown_exporter_1 = require("./markdown-exporter");
Object.defineProperty(exports, "exportMarkdown", { enumerable: true, get: function () { return markdown_exporter_1.exportMarkdown; } });
const json_exporter_1 = require("./json-exporter");
Object.defineProperty(exports, "exportJson", { enumerable: true, get: function () { return json_exporter_1.exportJson; } });
const csv_exporter_1 = require("./csv-exporter");
Object.defineProperty(exports, "exportCsv", { enumerable: true, get: function () { return csv_exporter_1.exportCsv; } });
Object.defineProperty(exports, "exportSummaryCsv", { enumerable: true, get: function () { return csv_exporter_1.exportSummaryCsv; } });
function exportReport(analysisResults, simulationResults, options = {}) {
    const { format = 'markdown', includeSql = false, includeSuggestions = true } = options;
    const exportOpts = { includeSql, includeSuggestions };
    switch (format) {
        case 'markdown':
            return (0, markdown_exporter_1.exportMarkdown)(analysisResults, simulationResults, exportOpts);
        case 'json':
            return (0, json_exporter_1.exportJson)(analysisResults, simulationResults, exportOpts);
        case 'csv':
            return (0, csv_exporter_1.exportCsv)(analysisResults, exportOpts);
        default:
            throw new Error(`不支持的导出格式: ${format}`);
    }
}
function exportReportsBatch(analysisResults, simulationResults, options = {}) {
    const { formats = ['markdown'], includeSql = false, includeSuggestions = true } = options;
    const results = {};
    const exportOpts = { includeSql, includeSuggestions };
    if (formats.includes('markdown')) {
        results.markdown = (0, markdown_exporter_1.exportMarkdown)(analysisResults, simulationResults, exportOpts);
    }
    if (formats.includes('json')) {
        results.json = (0, json_exporter_1.exportJson)(analysisResults, simulationResults, exportOpts);
    }
    if (formats.includes('csv')) {
        results.csv = (0, csv_exporter_1.exportCsv)(analysisResults, exportOpts);
        results.summaryCsv = (0, csv_exporter_1.exportSummaryCsv)(analysisResults);
    }
    return results;
}
//# sourceMappingURL=report-exporter.js.map