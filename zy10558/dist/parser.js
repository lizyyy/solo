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
exports.parseLogFile = parseLogFile;
exports.parseJsonFile = parseJsonFile;
exports.parseInputFile = parseInputFile;
exports.loadBaseline = loadBaseline;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
function generateId(...parts) {
    return (0, crypto_1.createHash)('md5').update(parts.join('|')).digest('hex').slice(0, 12);
}
function parseLogFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const successes = [];
    const errors = [];
    let currentFailure = {};
    let inStackTrace = false;
    let stackLines = [];
    let failureStartLine = 0;
    let lastFailureEndLine = 0;
    let suspiciousLines = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        if (line.includes('TEST FAILED') || line.includes('FAIL:') || line.includes('✗')) {
            if (suspiciousLines.length > 0) {
                for (const sl of suspiciousLines) {
                    errors.push({
                        line: sl.line,
                        content: sl.content,
                        reason: 'Suspicious content between test failure entries'
                    });
                }
                suspiciousLines = [];
            }
            if (currentFailure.testName) {
                finishCurrentFailure();
            }
            currentFailure = {};
            stackLines = [];
            inStackTrace = false;
            failureStartLine = lineNum;
            continue;
        }
        if (failureStartLine === 0 && line.trim() !== '') {
            if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')) {
                errors.push({
                    line: lineNum,
                    content: line,
                    reason: 'Potential error outside test failure block'
                });
            }
            continue;
        }
        if (line.match(/^Test:/i) || line.match(/^\s*Test Name:/i)) {
            currentFailure.testName = line.replace(/^Test:\s*/i, '').trim();
            continue;
        }
        if (line.match(/^Error:/i) || line.match(/^AssertionError:/i) || line.match(/^Error /i)) {
            inStackTrace = true;
            currentFailure.errorMessage = line.replace(/^Error:\s*/i, '').trim();
            continue;
        }
        if (inStackTrace && (line.startsWith('    at ') || line.startsWith('\tat '))) {
            stackLines.push(line.trim());
            continue;
        }
        if (inStackTrace && line.trim() === '' && currentFailure.errorMessage) {
            finishCurrentFailure();
            lastFailureEndLine = lineNum;
            continue;
        }
        if (line.match(/^=====/) || line.match(/^-----/) || line.match(/^\*{5}/)) {
            if (currentFailure.errorMessage) {
                finishCurrentFailure();
                lastFailureEndLine = lineNum;
            }
            continue;
        }
        if (failureStartLine > 0 && line.trim() !== '' && !inStackTrace) {
            suspiciousLines.push({ line: lineNum, content: line });
        }
    }
    if (suspiciousLines.length > 0) {
        for (const sl of suspiciousLines) {
            errors.push({
                line: sl.line,
                content: sl.content,
                reason: 'Unparsable content in failure block'
            });
        }
    }
    finishCurrentFailure();
    function finishCurrentFailure() {
        if (currentFailure.testName && currentFailure.errorMessage) {
            const failure = {
                id: generateId(currentFailure.testName, currentFailure.errorMessage, String(failureStartLine)),
                testName: currentFailure.testName,
                errorMessage: currentFailure.errorMessage,
                stackTrace: stackLines.join('\n'),
                sourceLine: failureStartLine,
                raw: lines.slice(failureStartLine - 1, failureStartLine + stackLines.length + 2).join('\n')
            };
            successes.push(failure);
        }
        else if (currentFailure.errorMessage || stackLines.length > 0) {
            errors.push({
                line: failureStartLine,
                content: lines.slice(failureStartLine - 1, failureStartLine + 5).join('\n'),
                reason: 'Missing test name or incomplete failure entry'
            });
        }
        currentFailure = {};
        stackLines = [];
        inStackTrace = false;
    }
    return { successes, errors };
}
function parseJsonFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const successes = [];
    const errors = [];
    try {
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
            return {
                successes: [],
                errors: [{ line: 1, content: 'Root element is not an array', reason: 'Expected JSON array' }]
            };
        }
        data.forEach((item, index) => {
            const lineNum = index + 1;
            if (!item.testName || !item.errorMessage) {
                errors.push({
                    line: lineNum,
                    content: JSON.stringify(item),
                    reason: 'Missing required fields: testName or errorMessage'
                });
                return;
            }
            successes.push({
                id: generateId(item.testName, item.errorMessage, String(lineNum)),
                testName: item.testName,
                errorMessage: item.errorMessage,
                stackTrace: item.stackTrace || '',
                timestamp: item.timestamp,
                sourceLine: lineNum
            });
        });
    }
    catch (e) {
        const match = e.message?.match(/position (\d+)/);
        const lineNum = match ? parseInt(match[1]) : 1;
        return {
            successes: [],
            errors: [{ line: lineNum, content: content.slice(0, 100), reason: `JSON parse error: ${e.message}` }]
        };
    }
    return { successes, errors };
}
function parseInputFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
        return parseJsonFile(filePath);
    }
    return parseLogFile(filePath);
}
function loadBaseline(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}
