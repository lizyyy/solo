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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfigFromFile = exports.getDefaultConfig = exports.DiffEngine = exports.parseCassette = void 0;
exports.compareCassettes = compareCassettes;
const cassette_parser_1 = require("./parsers/cassette-parser");
Object.defineProperty(exports, "parseCassette", { enumerable: true, get: function () { return cassette_parser_1.parseCassette; } });
const diff_engine_1 = require("./diff/diff-engine");
Object.defineProperty(exports, "DiffEngine", { enumerable: true, get: function () { return diff_engine_1.DiffEngine; } });
const masking_engine_1 = require("./masking/masking-engine");
Object.defineProperty(exports, "getDefaultConfig", { enumerable: true, get: function () { return masking_engine_1.getDefaultConfig; } });
Object.defineProperty(exports, "loadConfigFromFile", { enumerable: true, get: function () { return masking_engine_1.loadConfigFromFile; } });
const terminal_reporter_1 = require("./reporters/terminal-reporter");
const json_reporter_1 = require("./reporters/json-reporter");
const markdown_reporter_1 = require("./reporters/markdown-reporter");
const types_1 = require("./types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function compareCassettes(options) {
    let config;
    if (options.config) {
        config = options.config;
    }
    else if (options.configFile) {
        try {
            config = (0, masking_engine_1.loadConfigFromFile)(options.configFile);
        }
        catch (error) {
            throw {
                message: `配置文件加载失败: ${error.message}`,
                code: types_1.ExitCodes.CONFIG_ERROR
            };
        }
    }
    else {
        config = (0, masking_engine_1.getDefaultConfig)();
    }
    if (options.ignoreOrder !== undefined) {
        config.ignoreOrder = options.ignoreOrder;
    }
    if (options.ignoreFields && options.ignoreFields.length > 0) {
        config.ignoreFields = [...new Set([...config.ignoreFields, ...options.ignoreFields])];
    }
    let expected, actual;
    try {
        expected = await (0, cassette_parser_1.parseCassette)(options.expectedFile);
    }
    catch (error) {
        throw {
            message: `解析期望文件失败: ${error.message}`,
            code: error.code || types_1.ExitCodes.PARSE_ERROR,
            line: error.line
        };
    }
    try {
        actual = await (0, cassette_parser_1.parseCassette)(options.actualFile);
    }
    catch (error) {
        throw {
            message: `解析实际文件失败: ${error.message}`,
            code: error.code || types_1.ExitCodes.PARSE_ERROR,
            line: error.line
        };
    }
    const diffEngine = new diff_engine_1.DiffEngine(config);
    const result = diffEngine.compare(expected, actual);
    const outputDir = options.outputDir || process.cwd();
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const format = options.format || 'text';
    if (!options.quiet) {
        const terminalReporter = new terminal_reporter_1.TerminalReporter(result, outputDir, options.expectedFile, options.actualFile, options.verbose);
        console.log(terminalReporter.generate());
    }
    if (format === 'json' || format === 'all') {
        const jsonReporter = new json_reporter_1.JsonReporter(result, outputDir, options.expectedFile, options.actualFile);
        const jsonPath = path.join(outputDir, 'cassette-diff.json');
        fs.writeFileSync(jsonPath, jsonReporter.generate(), 'utf-8');
        if (!options.quiet) {
            console.log(`\n📄 JSON 报告已保存: ${jsonPath}`);
        }
    }
    if (format === 'markdown' || format === 'all') {
        const mdReporter = new markdown_reporter_1.MarkdownReporter(result, outputDir, options.expectedFile, options.actualFile);
        const mdPath = path.join(outputDir, 'cassette-diff.md');
        fs.writeFileSync(mdPath, mdReporter.generate(), 'utf-8');
        if (!options.quiet) {
            console.log(`📄 Markdown 报告已保存: ${mdPath}`);
        }
    }
    return { result, exitCode: result.exitCode };
}
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map