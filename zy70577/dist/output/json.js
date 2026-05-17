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
exports.JsonOutput = void 0;
exports.writeJsonOutput = writeJsonOutput;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class JsonOutput {
    write(result, options) {
        const outputPath = this.getOutputPath(options);
        this.ensureOutputDir(outputPath);
        const json = JSON.stringify(result, null, 2);
        fs.writeFileSync(outputPath, json, 'utf8');
        return outputPath;
    }
    getOutputPath(options) {
        if (options.outputJson) {
            return options.outputJson;
        }
        const inputName = path.basename(options.input, path.extname(options.input));
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${inputName}-analysis-${timestamp}.json`;
        if (options.outputDir) {
            return path.join(options.outputDir, filename);
        }
        return path.join(process.cwd(), filename);
    }
    ensureOutputDir(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
exports.JsonOutput = JsonOutput;
function writeJsonOutput(result, options) {
    const output = new JsonOutput();
    return output.write(result, options);
}
