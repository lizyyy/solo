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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runChecks = runChecks;
exports.loadConfigFile = loadConfigFile;
exports.generateConfigHash = generateConfigHash;
const path = __importStar(require("path"));
const parser_1 = require("./parser");
const widthCalculator_1 = require("./widthCalculator");
const placeholderChecker_1 = require("./placeholderChecker");
const riskAssessor_1 = require("./riskAssessor");
function runChecks(inputFiles, checkConfigs, options = {}) {
    const allEntries = [];
    const parseErrors = [];
    for (const file of inputFiles) {
        try {
            const entries = (0, parser_1.parseI18nFile)(file);
            allEntries.push(...entries);
        }
        catch (error) {
            const errorMessage = error.message;
            parseErrors.push({ file, error: errorMessage });
            console.error(`解析文件失败 ${file}:`, errorMessage);
        }
    }
    const results = [];
    const sourceEntries = options.sourceLocale
        ? allEntries.filter(e => e.locale === options.sourceLocale)
        : [];
    for (const entry of allEntries) {
        const matchingConfigs = checkConfigs.filter(config => config.locale === entry.locale || config.locale === '*');
        for (const config of matchingConfigs) {
            const result = checkEntry(entry, config, sourceEntries);
            results.push(result);
        }
    }
    return { results, parseErrors };
}
function checkEntry(entry, config, sourceEntries) {
    const sourceEntry = sourceEntries.find(s => s.key === entry.key && s.pluralForm === entry.pluralForm);
    const sourceText = sourceEntry?.value || entry.value;
    let checkedText = entry.value;
    const placeholders = (0, parser_1.extractPlaceholders)(checkedText);
    for (const placeholder of placeholders) {
        const estimatedWidth = (0, placeholderChecker_1.estimatePlaceholderMaxWidth)(placeholder);
        const replacement = 'X'.repeat(estimatedWidth);
        checkedText = checkedText.replace(placeholder, replacement);
    }
    const widthResult = (0, widthCalculator_1.calculateWidth)(checkedText);
    const widthOverflow = Math.max(0, widthResult.charWidth - config.maxWidth);
    const placeholderIssues = [
        ...(0, placeholderChecker_1.checkPlaceholders)(sourceText, entry.value, config.placeholders),
        ...(0, placeholderChecker_1.validatePlaceholderOrder)(sourceText, entry.value),
    ];
    const riskAssessment = (0, riskAssessor_1.assessRisk)(widthResult, config.maxWidth, placeholderIssues, config.maxChars);
    return {
        key: entry.key,
        locale: entry.locale,
        interfacePosition: config.interfacePosition,
        originalText: entry.value,
        checkedText,
        pluralForm: entry.pluralForm,
        widthResult,
        maxWidth: config.maxWidth,
        widthOverflow,
        placeholderIssues,
        riskLevel: riskAssessment.level,
        riskExplanation: riskAssessment.explanation,
    };
}
function loadConfigFile(configPath) {
    const fs = require('fs');
    const ext = path.extname(configPath).toLowerCase();
    let configData;
    if (ext === '.json') {
        configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    else if (ext === '.yaml' || ext === '.yml') {
        const { parseYaml } = require('./parser');
        configData = parseYaml(fs.readFileSync(configPath, 'utf-8'));
    }
    else {
        throw new Error(`不支持的配置文件格式: ${ext}`);
    }
    const checks = configData.checks?.map((check) => ({
        locale: check.locale,
        interfacePosition: check.interfacePosition,
        maxWidth: check.maxWidth,
        maxChars: check.maxChars,
        placeholders: check.placeholders || configData.defaults?.placeholders,
        keyPattern: check.keyPattern,
    })) || [];
    return {
        checks,
        outputDir: configData.output?.dir,
        formats: configData.output?.formats,
    };
}
function generateConfigHash(config) {
    const crypto = require('crypto');
    function stableStringify(obj) {
        if (obj === null || obj === undefined) {
            return String(obj);
        }
        if (typeof obj !== 'object') {
            return JSON.stringify(obj);
        }
        if (Array.isArray(obj)) {
            return '[' + obj.map(item => stableStringify(item)).join(',') + ']';
        }
        const keys = Object.keys(obj).sort();
        return '{' + keys.map(key => JSON.stringify(key) + ':' + stableStringify(obj[key])).join(',') + '}';
    }
    const configString = stableStringify(config);
    return crypto.createHash('md5').update(configString).digest('hex').substring(0, 8);
}
//# sourceMappingURL=checker.js.map