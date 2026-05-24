"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRules = exports.writeLatestMarkdownReport = exports.writeMarkdownReport = exports.generateMarkdownReport = exports.writeLatestJsonReport = exports.writeJsonReport = exports.getExitCode = exports.printTerminalSummary = exports.renderTemplateDir = exports.renderTemplate = exports.findYamlFiles = exports.extractAllValues = exports.parseYamlFile = exports.validateOptions = exports.loadExceptions = exports.loadRules = exports.runSelfTests = exports.isExceptionExpired = exports.matchesException = exports.applyExceptions = exports.tryDecodeBase64 = exports.isBase64 = exports.scanValue = exports.scanContent = exports.ScanEngine = void 0;
var scan_engine_1 = require("./core/scan-engine");
Object.defineProperty(exports, "ScanEngine", { enumerable: true, get: function () { return scan_engine_1.ScanEngine; } });
var scanner_1 = require("./core/scanner");
Object.defineProperty(exports, "scanContent", { enumerable: true, get: function () { return scanner_1.scanContent; } });
Object.defineProperty(exports, "scanValue", { enumerable: true, get: function () { return scanner_1.scanValue; } });
Object.defineProperty(exports, "isBase64", { enumerable: true, get: function () { return scanner_1.isBase64; } });
Object.defineProperty(exports, "tryDecodeBase64", { enumerable: true, get: function () { return scanner_1.tryDecodeBase64; } });
var exception_manager_1 = require("./core/exception-manager");
Object.defineProperty(exports, "applyExceptions", { enumerable: true, get: function () { return exception_manager_1.applyExceptions; } });
Object.defineProperty(exports, "matchesException", { enumerable: true, get: function () { return exception_manager_1.matchesException; } });
Object.defineProperty(exports, "isExceptionExpired", { enumerable: true, get: function () { return exception_manager_1.isExceptionExpired; } });
var self_test_1 = require("./core/self-test");
Object.defineProperty(exports, "runSelfTests", { enumerable: true, get: function () { return self_test_1.runSelfTests; } });
var config_loader_1 = require("./utils/config-loader");
Object.defineProperty(exports, "loadRules", { enumerable: true, get: function () { return config_loader_1.loadRules; } });
Object.defineProperty(exports, "loadExceptions", { enumerable: true, get: function () { return config_loader_1.loadExceptions; } });
Object.defineProperty(exports, "validateOptions", { enumerable: true, get: function () { return config_loader_1.validateOptions; } });
var yaml_parser_1 = require("./utils/yaml-parser");
Object.defineProperty(exports, "parseYamlFile", { enumerable: true, get: function () { return yaml_parser_1.parseYamlFile; } });
Object.defineProperty(exports, "extractAllValues", { enumerable: true, get: function () { return yaml_parser_1.extractAllValues; } });
Object.defineProperty(exports, "findYamlFiles", { enumerable: true, get: function () { return yaml_parser_1.findYamlFiles; } });
var template_renderer_1 = require("./utils/template-renderer");
Object.defineProperty(exports, "renderTemplate", { enumerable: true, get: function () { return template_renderer_1.renderTemplate; } });
Object.defineProperty(exports, "renderTemplateDir", { enumerable: true, get: function () { return template_renderer_1.renderTemplateDir; } });
var terminal_reporter_1 = require("./reporters/terminal-reporter");
Object.defineProperty(exports, "printTerminalSummary", { enumerable: true, get: function () { return terminal_reporter_1.printTerminalSummary; } });
Object.defineProperty(exports, "getExitCode", { enumerable: true, get: function () { return terminal_reporter_1.getExitCode; } });
var json_reporter_1 = require("./reporters/json-reporter");
Object.defineProperty(exports, "writeJsonReport", { enumerable: true, get: function () { return json_reporter_1.writeJsonReport; } });
Object.defineProperty(exports, "writeLatestJsonReport", { enumerable: true, get: function () { return json_reporter_1.writeLatestJsonReport; } });
var markdown_reporter_1 = require("./reporters/markdown-reporter");
Object.defineProperty(exports, "generateMarkdownReport", { enumerable: true, get: function () { return markdown_reporter_1.generateMarkdownReport; } });
Object.defineProperty(exports, "writeMarkdownReport", { enumerable: true, get: function () { return markdown_reporter_1.writeMarkdownReport; } });
Object.defineProperty(exports, "writeLatestMarkdownReport", { enumerable: true, get: function () { return markdown_reporter_1.writeLatestMarkdownReport; } });
var default_rules_1 = require("./config/default-rules");
Object.defineProperty(exports, "defaultRules", { enumerable: true, get: function () { return default_rules_1.defaultRules; } });
__exportStar(require("./types"), exports);
