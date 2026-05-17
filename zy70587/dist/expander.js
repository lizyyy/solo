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
exports.expandYaml = expandYaml;
const yaml = __importStar(require("js-yaml"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class YamlExpander {
    constructor(options) {
        this.originalContent = '';
        this.lines = [];
        this.anchors = new Map();
        this.overrides = [];
        this.errors = [];
        this.warnings = [];
        this.detectedMerges = [];
        this.mergeNodes = [];
        this.options = options;
    }
    expand() {
        const timestamp = new Date().toISOString();
        const outputBase = this.options.outputBase || this.getOutputBase(timestamp);
        try {
            this.originalContent = fs.readFileSync(this.options.inputFile, 'utf-8');
            this.lines = this.originalContent.split('\n');
        }
        catch (error) {
            this.errors.push({
                message: `无法读取输入文件: ${error.message}`,
                location: { line: 0, column: 0 },
                severity: 'error',
            });
            return this.buildResult(false, 1, outputBase, timestamp, '');
        }
        let expandedYaml = '';
        let doc = null;
        try {
            this.scanAnchors();
            doc = yaml.load(this.originalContent, {
                filename: this.options.inputFile,
            });
            this.extractAnchorValues(doc);
            this.detectOverrides(doc);
            const { expanded } = this.expandNode(doc, '');
            expandedYaml = yaml.dump(expanded, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
            });
            this.buildMergeNodes(doc);
        }
        catch (error) {
            const yamlError = error;
            this.errors.push({
                message: yamlError.message || 'YAML解析错误',
                location: {
                    line: (yamlError.mark?.line ?? 0) + 1,
                    column: (yamlError.mark?.column ?? 0) + 1,
                },
                severity: 'error',
                context: this.getLineContext(yamlError.mark?.line ?? 0),
            });
            return this.buildResult(false, 2, outputBase, timestamp, '');
        }
        const exitCode = this.errors.length > 0 ? 3 : 0;
        return this.buildResult(exitCode === 0, exitCode, outputBase, timestamp, expandedYaml);
    }
    scanAnchors() {
        const anchorRegex = /&(\w+)/g;
        const singleMergeRegex = /<<:\s*\*(\w+)/g;
        const multiMergeRegex = /<<:\s*\[\s*([^\]]+)\s*\]/g;
        for (let lineNum = 0; lineNum < this.lines.length; lineNum++) {
            const line = this.lines[lineNum];
            let match;
            while ((match = anchorRegex.exec(line)) !== null) {
                const anchorName = match[1];
                this.anchors.set(anchorName, {
                    name: anchorName,
                    location: { line: lineNum + 1, column: match.index + 1 },
                    value: null,
                });
            }
            while ((match = singleMergeRegex.exec(line)) !== null) {
                const parentKey = this.findParentKey(lineNum);
                this.detectedMerges.push({
                    line: lineNum + 1,
                    column: match.index + 1,
                    anchorNames: [match[1]],
                    parentKey: parentKey,
                });
            }
            while ((match = multiMergeRegex.exec(line)) !== null) {
                const parentKey = this.findParentKey(lineNum);
                const anchorNames = match[1].split(',').map((a) => a.trim().replace(/^\*/, ''));
                this.detectedMerges.push({
                    line: lineNum + 1,
                    column: match.index + 1,
                    anchorNames: anchorNames,
                    parentKey: parentKey,
                });
            }
        }
    }
    findParentKey(mergeLine) {
        for (let i = mergeLine - 1; i >= 0; i--) {
            const line = this.lines[i];
            const keyMatch = line.match(/^(\s*)(\w+):\s*$/);
            if (keyMatch) {
                return keyMatch[2];
            }
        }
        return '';
    }
    extractAnchorValues(node, path = '') {
        if (!node || typeof node !== 'object')
            return;
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                this.extractAnchorValues(node[i], `${path}[${i}]`);
            }
            return;
        }
        for (const [key, value] of Object.entries(node)) {
            for (const [anchorName, anchorInfo] of this.anchors) {
                if (anchorInfo.value === null) {
                    const anchorLine = anchorInfo.location.line - 1;
                    if (this.isKeyAtLine(key, anchorLine)) {
                        anchorInfo.value = value;
                    }
                }
            }
            this.extractAnchorValues(value, `${path}.${key}`);
        }
    }
    isKeyAtLine(key, anchorLine) {
        const keyRegex = new RegExp(`^\\s*${key}\\s*:`);
        return keyRegex.test(this.lines[anchorLine]);
    }
    expandNode(node, path) {
        if (!node || typeof node !== 'object') {
            return { expanded: node };
        }
        if (Array.isArray(node)) {
            const result = [];
            for (let i = 0; i < node.length; i++) {
                const { expanded } = this.expandNode(node[i], `${path}[${i}]`);
                result.push(expanded);
            }
            return { expanded: result };
        }
        const result = {};
        const mergeSources = [];
        for (const [key, value] of Object.entries(node)) {
            if (key === '<<') {
                if (Array.isArray(value)) {
                    mergeSources.push(...value);
                }
                else {
                    mergeSources.push(value);
                }
            }
            else {
                const { expanded } = this.expandNode(value, `${path}.${key}`);
                result[key] = expanded;
            }
        }
        for (let i = mergeSources.length - 1; i >= 0; i--) {
            const mergeSource = mergeSources[i];
            if (mergeSource && typeof mergeSource === 'object') {
                for (const [key, value] of Object.entries(mergeSource)) {
                    if (!(key in result)) {
                        result[key] = value;
                    }
                }
            }
        }
        return { expanded: result };
    }
    buildMergeNodes(doc) {
        for (const detected of this.detectedMerges) {
            const sources = detected.anchorNames.map((anchorName) => {
                const anchorInfo = this.anchors.get(anchorName);
                const keys = anchorInfo?.value
                    ? Object.keys(anchorInfo.value)
                    : [];
                return {
                    anchorName: anchorName,
                    location: anchorInfo?.location || { line: 0, column: 0 },
                    keys: keys,
                };
            });
            this.mergeNodes.push({
                path: detected.parentKey,
                location: { line: detected.line, column: detected.column },
                sources: sources,
            });
        }
    }
    detectOverrides(doc) {
        for (const detected of this.detectedMerges) {
            const node = doc[detected.parentKey];
            if (!node || typeof node !== 'object')
                continue;
            const explicitKeys = Object.keys(node).filter((k) => k !== '<<');
            for (const anchorName of detected.anchorNames) {
                const anchorInfo = this.anchors.get(anchorName);
                if (!anchorInfo || !anchorInfo.value || typeof anchorInfo.value !== 'object')
                    continue;
                for (const [key, value] of Object.entries(anchorInfo.value)) {
                    if (explicitKeys.includes(key)) {
                        const newValue = node[key];
                        if (JSON.stringify(value) !== JSON.stringify(newValue)) {
                            this.overrides.push({
                                path: detected.parentKey,
                                key: key,
                                oldValue: value,
                                newValue: newValue,
                                sourceAnchor: anchorName,
                                overrideLocation: this.findLocationForKey(detected.parentKey, key),
                            });
                        }
                    }
                }
            }
        }
    }
    findLocationForKey(parentKey, key) {
        let parentFound = false;
        for (let lineNum = 0; lineNum < this.lines.length; lineNum++) {
            const line = this.lines[lineNum];
            if (!parentFound) {
                const keyMatch = line.match(new RegExp(`^${parentKey}:\\s*$`));
                if (keyMatch) {
                    parentFound = true;
                }
            }
            else {
                const keyMatch = line.match(new RegExp(`^\\s+${key}:\\s*`));
                if (keyMatch) {
                    return { line: lineNum + 1, column: line.indexOf(key) + 1 };
                }
                const nextTopLevel = line.match(/^\w+:\s*$/);
                if (nextTopLevel) {
                    break;
                }
            }
        }
        return { line: 0, column: 0 };
    }
    findAnchorNameForValue(value) {
        for (const [name, info] of this.anchors) {
            if (info.value === value) {
                return name;
            }
        }
        for (const [name, info] of this.anchors) {
            if (info.value &&
                typeof info.value === 'object' &&
                JSON.stringify(info.value) === JSON.stringify(value)) {
                return name;
            }
        }
        return undefined;
    }
    getOutputBase(timestamp) {
        const baseName = path
            .basename(this.options.inputFile)
            .replace(/\.ya?ml$/i, '') || 'output';
        const ts = timestamp.replace(/[:.]/g, '-');
        return `${baseName}-expanded-${ts}`;
    }
    getLineContext(lineNumber) {
        const context = [];
        for (let i = Math.max(0, lineNumber - 2); i <= lineNumber + 2 && i < this.lines.length; i++) {
            const prefix = i === lineNumber ? '> ' : '  ';
            context.push(`${prefix}${i + 1}: ${this.lines[i]}`);
        }
        return context.join('\n');
    }
    buildResult(success, exitCode, outputBase, timestamp, expandedYaml) {
        return {
            success,
            exitCode,
            inputFile: this.options.inputFile,
            outputBase,
            timestamp,
            originalYaml: this.originalContent,
            expandedYaml,
            anchors: Array.from(this.anchors.values()),
            mergeNodes: this.mergeNodes,
            overrides: this.overrides,
            errors: this.errors,
            warnings: this.warnings,
            statistics: {
                totalAnchors: this.anchors.size,
                totalMerges: this.mergeNodes.length,
                totalOverrides: this.overrides.length,
                totalErrors: this.errors.length,
                totalWarnings: this.warnings.length,
            },
        };
    }
}
function expandYaml(options) {
    const expander = new YamlExpander(options);
    return expander.expand();
}
