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
exports.LogParser = void 0;
exports.parseLogFile = parseLogFile;
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
const constants_1 = require("./constants");
class LogParser {
    constructor(options) {
        this.options = options;
        const format = this.options.logFormat;
        if (format && format !== 'auto' && constants_1.LOG_PATTERNS[format]) {
            this.patterns = constants_1.LOG_PATTERNS[format];
        }
        else {
            this.patterns = constants_1.LOG_PATTERNS['github-actions'];
        }
    }
    async autoDetectPatterns() {
        const format = this.options.logFormat || 'auto';
        if (format !== 'auto' && constants_1.LOG_PATTERNS[format]) {
            return constants_1.LOG_PATTERNS[format];
        }
        try {
            const content = await fs.promises.readFile(this.options.input, 'utf8');
            const detectedFormat = this.detectFormatFromContent(content);
            if (detectedFormat) {
                return constants_1.LOG_PATTERNS[detectedFormat];
            }
        }
        catch (e) {
        }
        return constants_1.LOG_PATTERNS['github-actions'];
    }
    async parse() {
        this.patterns = await this.autoDetectPatterns();
        const entries = [];
        const badLines = [];
        let lineNumber = 0;
        let currentStage = 'unknown';
        const rl = readline.createInterface({
            input: fs.createReadStream(this.options.input),
            crlfDelay: Infinity,
        });
        for await (const line of rl) {
            lineNumber++;
            try {
                const entry = this.parseLine(line, lineNumber, currentStage);
                if (entry.stage && entry.stage !== currentStage) {
                    currentStage = entry.stage;
                }
                if (this.isValidEntry(entry)) {
                    entries.push(entry);
                }
                else if (line.trim()) {
                    badLines.push({
                        lineNumber,
                        raw: line,
                        reason: '无法识别的日志格式或缺少关键字段',
                    });
                }
            }
            catch (error) {
                badLines.push({
                    lineNumber,
                    raw: line,
                    reason: `解析异常: ${error.message}`,
                });
            }
        }
        return {
            entries,
            badLines,
            totalLines: lineNumber,
        };
    }
    parseLine(line, lineNumber, currentStage) {
        const entry = {
            lineNumber,
            raw: line,
        };
        const timestampMatch = line.match(this.patterns.timestamp);
        if (timestampMatch) {
            entry.timestamp = timestampMatch[0];
        }
        const stageMatch = line.match(this.patterns.stage);
        const isStageEndLine = /##\[endgroup\]/.test(line);
        const isStageRelatedLine = !!stageMatch || isStageEndLine;
        if (stageMatch) {
            entry.stage = stageMatch[1].trim();
        }
        const cacheHitMatch = line.match(this.patterns.cacheHit);
        if (cacheHitMatch) {
            entry.hitStatus = constants_1.CACHE_HIT_STATUS.HIT;
            entry.cacheKey = cacheHitMatch[1].trim();
            entry.message = `缓存命中: ${entry.cacheKey}`;
        }
        const cacheMissMatch = line.match(this.patterns.cacheMiss);
        if (cacheMissMatch) {
            entry.hitStatus = constants_1.CACHE_HIT_STATUS.MISS;
            entry.cacheKey = cacheMissMatch[1].trim();
            entry.message = `缓存未命中: ${entry.cacheKey}`;
        }
        const cacheKeyMatch = line.match(this.patterns.cacheKey);
        if (cacheKeyMatch && !entry.cacheKey) {
            entry.cacheKey = cacheKeyMatch[1].trim();
        }
        const durationMatch = line.match(this.patterns.duration);
        if (durationMatch) {
            const ms1 = durationMatch[1] ? parseInt(durationMatch[1], 10) : 0;
            const ms2 = durationMatch[2] ? parseInt(durationMatch[2], 10) : 0;
            const seconds = durationMatch[3] ? parseFloat(durationMatch[3]) : 0;
            entry.durationMs = ms1 > 0 ? ms1 : (ms2 > 0 ? ms2 : Math.round(seconds * 1000));
        }
        if (!entry.hitStatus && (entry.cacheKey || entry.durationMs)) {
            entry.hitStatus = constants_1.CACHE_HIT_STATUS.UNKNOWN;
        }
        // 只有当行有实际的缓存或耗时信息时，才附加阶段上下文
        // 阶段相关行本身已有stage属性或不需要附加
        if (!isStageRelatedLine && this.hasCacheOrDurationInfo(entry)) {
            entry.stage = currentStage;
        }
        if (!entry.message && line.length > 0) {
            entry.message = line.substring(0, 200);
        }
        return entry;
    }
    hasCacheOrDurationInfo(entry) {
        return !!(entry.hitStatus || entry.cacheKey || entry.durationMs);
    }
    isValidEntry(entry) {
        // 有效行条件：
        // 1. 有缓存或耗时信息（命中/未命中状态、缓存键、耗时）
        // 2. 或者是阶段相关行（阶段开始、阶段结束）
        return !!this.hasCacheOrDurationInfo(entry) ||
            !!(entry.stage && entry.stage !== 'unknown') ||
            /##\[endgroup\]/.test(entry.raw);
    }
    detectFormatFromContent(content) {
        for (const [format, patterns] of Object.entries(constants_1.LOG_PATTERNS)) {
            let matches = 0;
            for (const pattern of Object.values(patterns)) {
                if (pattern.test(content)) {
                    matches++;
                }
            }
            if (matches >= 2) {
                return format;
            }
        }
        return null;
    }
}
exports.LogParser = LogParser;
async function parseLogFile(options) {
    const parser = new LogParser(options);
    return parser.parse();
}
