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
exports.FileReader = void 0;
exports.resolveInputPath = resolveInputPath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
class FileReader {
    constructor(filePath) {
        this.filePath = filePath;
    }
    read() {
        const content = fs.readFileSync(this.filePath, "utf-8");
        const lines = content.split("\n");
        return { content, lines };
    }
    parseYaml() {
        const { content } = this.read();
        const parsed = yaml.load(content);
        if (!parsed.groups) {
            throw new Error("Invalid Prometheus rules file: missing groups field");
        }
        return parsed;
    }
    findRuleLineNumber(ruleName, groupName) {
        const { lines } = this.read();
        let inGroup = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(`name: ${groupName}`)) {
                inGroup = true;
            }
            if (inGroup && line.includes(`alert: ${ruleName}`)) {
                return i + 1;
            }
            if (inGroup && line.match(/^\s*- name:/) && !line.includes(groupName)) {
                break;
            }
        }
        return undefined;
    }
    parseSamplesYaml() {
        const { content } = this.read();
        const parsed = yaml.load(content);
        if (!parsed.samples || !Array.isArray(parsed.samples)) {
            throw new Error("Invalid samples file: missing 'samples' array field");
        }
        return parsed.samples;
    }
}
exports.FileReader = FileReader;
function resolveInputPath(inputPath) {
    const resolved = path.resolve(inputPath);
    if (fs.statSync(resolved).isDirectory()) {
        return fs.readdirSync(resolved)
            .filter(f => f.endsWith(".yml") || f.endsWith(".yaml"))
            .map(f => path.join(resolved, f));
    }
    return [resolved];
}
