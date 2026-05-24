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
exports.detectLanguage = detectLanguage;
exports.getMatchingExtensions = getMatchingExtensions;
exports.findSourceFiles = findSourceFiles;
exports.readFileContent = readFileContent;
exports.extractLineContext = extractLineContext;
exports.getLineNumber = getLineNumber;
exports.getColumn = getColumn;
exports.isNegatedContext = isNegatedContext;
exports.findAllFlagMatches = findAllFlagMatches;
exports.scanSourceFiles = scanSourceFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const constants_1 = require("./constants");
function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    for (const [lang, exts] of Object.entries(constants_1.LANGUAGE_EXTENSIONS)) {
        if (exts.includes(ext)) {
            return lang;
        }
    }
    return 'other';
}
function getMatchingExtensions(languages) {
    return languages.flatMap(lang => constants_1.LANGUAGE_EXTENSIONS[lang]);
}
async function findSourceFiles(options) {
    const extensions = getMatchingExtensions(options.languages);
    if (extensions.length === 0) {
        return [];
    }
    const patterns = extensions.map(ext => `**/*${ext}`);
    const files = await (0, glob_1.glob)(patterns, {
        cwd: options.sourceDir,
        absolute: true,
        ignore: options.excludePatterns,
        nodir: true,
    });
    return files;
}
function readFileContent(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    }
    catch (error) {
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
}
function extractLineContext(content, lineNumber, contextRange = 2) {
    const lines = content.split('\n');
    const start = Math.max(0, lineNumber - 1 - contextRange);
    const end = Math.min(lines.length, lineNumber + contextRange);
    return lines.slice(start, end).join('\n');
}
function getLineNumber(content, charIndex) {
    return content.substring(0, charIndex).split('\n').length;
}
function getColumn(content, charIndex) {
    const lines = content.substring(0, charIndex).split('\n');
    return lines[lines.length - 1].length + 1;
}
function isNegatedContext(content, matchIndex, language) {
    const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
    const lineEnd = content.indexOf('\n', matchIndex);
    const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
    const posInLine = matchIndex - lineStart;
    const beforeMatchInLine = currentLine.substring(0, posInLine);
    const exclamationRegex = /!\s*(?:isEnabled|isActive|getFlag|featureEnabled|isFeatureEnabled|[\w_]+\s*\()?\s*$/;
    if (exclamationRegex.test(beforeMatchInLine)) {
        return true;
    }
    if (/!\s*[^\s!]*$/.test(beforeMatchInLine)) {
        return true;
    }
    const patterns = constants_1.LANGUAGE_PATTERNS[language];
    for (const word of patterns.negationWords) {
        if (word === '!') {
            continue;
        }
        const wordRegex = new RegExp(`\\b${word}\\b.*$`, 'i');
        if (wordRegex.test(beforeMatchInLine)) {
            return true;
        }
    }
    return false;
}
function findAllFlagMatches(filePath, content, flagNames, dynamicPatterns) {
    const language = detectLanguage(filePath);
    const matches = [];
    flagNames.forEach(flagName => {
        const escapedFlagName = flagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flagPatterns = [];
        if (language === 'typescript' || language === 'javascript') {
            flagPatterns.push(new RegExp(`isEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`isActive\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`getFlag\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`featureEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`isFeatureEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`featureFlags\\s*\\.\\s*${escapedFlagName}\\b`, 'g'), new RegExp(`flags\\s*\\.\\s*${escapedFlagName}\\b`, 'g'));
        }
        else if (language === 'python') {
            flagPatterns.push(new RegExp(`is_enabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`is_active\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`get_flag\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`feature_enabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`is_feature_enabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'), new RegExp(`feature_flags\\s*\\[\\s*['"\`]${escapedFlagName}['"\`]\\s*\\]`, 'g'), new RegExp(`flags\\s*\\[\\s*['"\`]${escapedFlagName}['"\`]\\s*\\]`, 'g'));
        }
        else {
            flagPatterns.push(new RegExp(`isEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'gi'), new RegExp(`IsEnabled\\s*\\(\\s*['"\`]${escapedFlagName}['"\`]\\s*\\)`, 'g'));
        }
        flagPatterns.forEach(regex => {
            let match;
            while ((match = regex.exec(content)) !== null) {
                const lineNumber = getLineNumber(content, match.index);
                const column = getColumn(content, match.index);
                const isNegated = isNegatedContext(content, match.index, language);
                if (!matches.some(m => m.flagName === flagName &&
                    m.lineNumber === lineNumber)) {
                    matches.push({
                        flagName,
                        filePath,
                        lineNumber,
                        column,
                        matchType: isNegated ? 'negated' : 'direct',
                        context: extractLineContext(content, lineNumber),
                        isNegated,
                        language,
                    });
                }
            }
        });
        const lineStartRegex = new RegExp(`^.*?\\b${escapedFlagName}\\b.*$`, 'gm');
        let lineMatch;
        while ((lineMatch = lineStartRegex.exec(content)) !== null) {
            const lineNumber = getLineNumber(content, lineMatch.index);
            if (matches.some(m => m.flagName === flagName &&
                m.lineNumber === lineNumber)) {
                continue;
            }
            const lineText = lineMatch[0];
            if (/^\s*\/\//.test(lineText)) {
                continue;
            }
            if (/^\s*\*/.test(lineText)) {
                continue;
            }
            if (lineText.includes('//') && lineText.indexOf('//') < lineText.indexOf(flagName)) {
                continue;
            }
            const flagInLineIndex = lineText.indexOf(flagName);
            const beforeFlag = lineText.substring(0, flagInLineIndex);
            if (!(beforeFlag.includes('if') || beforeFlag.includes('while') ||
                beforeFlag.includes('return') || beforeFlag.includes('&&') ||
                beforeFlag.includes('||') || beforeFlag.includes('?') ||
                beforeFlag.includes('=') || beforeFlag.includes('!'))) {
                continue;
            }
            const matchIndex = lineMatch.index + lineText.indexOf(flagName);
            const column = getColumn(content, matchIndex);
            const isNegated = isNegatedContext(content, matchIndex, language);
            matches.push({
                flagName,
                filePath,
                lineNumber,
                column,
                matchType: isNegated ? 'negated' : 'direct',
                context: extractLineContext(content, lineNumber),
                isNegated,
                language,
            });
        }
    });
    dynamicPatterns.forEach(pattern => {
        let dynamicMatch;
        while ((dynamicMatch = pattern.exec(content)) !== null) {
            const matchedFlagName = dynamicMatch[1] || dynamicMatch[0];
            const lineNumber = getLineNumber(content, dynamicMatch.index);
            if (!matches.some(m => m.flagName === matchedFlagName &&
                m.lineNumber === lineNumber)) {
                const column = getColumn(content, dynamicMatch.index);
                const isNegated = isNegatedContext(content, dynamicMatch.index, language);
                matches.push({
                    flagName: matchedFlagName,
                    filePath,
                    lineNumber,
                    column,
                    matchType: 'dynamic',
                    context: extractLineContext(content, lineNumber),
                    isNegated,
                    language,
                });
            }
        }
    });
    return matches;
}
async function scanSourceFiles(options) {
    const allMatches = [];
    const errors = [];
    const files = await findSourceFiles(options);
    const flagNames = options.flagDefinitions.map(f => f.name);
    const dynamicPatterns = options.flagDefinitions
        .filter(f => f.dynamicPattern)
        .map(f => new RegExp(f.dynamicPattern, 'g'));
    for (const filePath of files) {
        try {
            const content = readFileContent(filePath);
            const matches = findAllFlagMatches(filePath, content, flagNames, dynamicPatterns);
            allMatches.push(...matches);
        }
        catch (error) {
            errors.push(`Error scanning ${filePath}: ${error.message}`);
        }
    }
    return {
        matches: allMatches,
        filesScanned: files,
        errors,
    };
}
//# sourceMappingURL=scanner.js.map