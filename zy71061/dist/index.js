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
exports.normalizeServiceName = exports.formatRetention = exports.parseRetention = exports.writeMarkdownReport = exports.writeJsonReport = exports.printExitCodeInfo = exports.printServiceDetails = exports.printConsoleSummary = exports.determineExitCode = exports.generateReport = exports.calculateDifferences = exports.readAliasMap = exports.getSourceTypes = exports.filterServices = exports.normalizeServices = exports.readPlatformFile = exports.readTerraformFile = exports.readConfigFile = void 0;
__exportStar(require("./types"), exports);
var configReader_1 = require("./readers/configReader");
Object.defineProperty(exports, "readConfigFile", { enumerable: true, get: function () { return configReader_1.readConfigFile; } });
var terraformReader_1 = require("./readers/terraformReader");
Object.defineProperty(exports, "readTerraformFile", { enumerable: true, get: function () { return terraformReader_1.readTerraformFile; } });
var platformReader_1 = require("./readers/platformReader");
Object.defineProperty(exports, "readPlatformFile", { enumerable: true, get: function () { return platformReader_1.readPlatformFile; } });
var serviceNormalizer_1 = require("./normalizer/serviceNormalizer");
Object.defineProperty(exports, "normalizeServices", { enumerable: true, get: function () { return serviceNormalizer_1.normalizeServices; } });
Object.defineProperty(exports, "filterServices", { enumerable: true, get: function () { return serviceNormalizer_1.filterServices; } });
Object.defineProperty(exports, "getSourceTypes", { enumerable: true, get: function () { return serviceNormalizer_1.getSourceTypes; } });
Object.defineProperty(exports, "readAliasMap", { enumerable: true, get: function () { return serviceNormalizer_1.readAliasMap; } });
var diffCalculator_1 = require("./diff/diffCalculator");
Object.defineProperty(exports, "calculateDifferences", { enumerable: true, get: function () { return diffCalculator_1.calculateDifferences; } });
Object.defineProperty(exports, "generateReport", { enumerable: true, get: function () { return diffCalculator_1.generateReport; } });
Object.defineProperty(exports, "determineExitCode", { enumerable: true, get: function () { return diffCalculator_1.determineExitCode; } });
var consoleReporter_1 = require("./reporters/consoleReporter");
Object.defineProperty(exports, "printConsoleSummary", { enumerable: true, get: function () { return consoleReporter_1.printConsoleSummary; } });
Object.defineProperty(exports, "printServiceDetails", { enumerable: true, get: function () { return consoleReporter_1.printServiceDetails; } });
Object.defineProperty(exports, "printExitCodeInfo", { enumerable: true, get: function () { return consoleReporter_1.printExitCodeInfo; } });
var jsonReporter_1 = require("./reporters/jsonReporter");
Object.defineProperty(exports, "writeJsonReport", { enumerable: true, get: function () { return jsonReporter_1.writeJsonReport; } });
var markdownReporter_1 = require("./reporters/markdownReporter");
Object.defineProperty(exports, "writeMarkdownReport", { enumerable: true, get: function () { return markdownReporter_1.writeMarkdownReport; } });
var unitConverter_1 = require("./utils/unitConverter");
Object.defineProperty(exports, "parseRetention", { enumerable: true, get: function () { return unitConverter_1.parseRetention; } });
Object.defineProperty(exports, "formatRetention", { enumerable: true, get: function () { return unitConverter_1.formatRetention; } });
Object.defineProperty(exports, "normalizeServiceName", { enumerable: true, get: function () { return unitConverter_1.normalizeServiceName; } });
