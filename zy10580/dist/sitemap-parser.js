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
exports.SitemapParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fast_xml_parser_1 = require("fast-xml-parser");
class SitemapParser {
    parser;
    constructor() {
        this.parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            parseTagValue: false,
            trimValues: true,
        });
    }
    async parse(filePath) {
        const entries = [];
        const errors = [];
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const result = this.parseContent(content, filePath, errors);
            entries.push(...result.entries);
            errors.push(...result.errors);
        }
        catch (error) {
            errors.push({
                sourceFile: filePath,
                error: `无法读取文件: ${error.message}`,
            });
        }
        return { entries, errors };
    }
    async parseDirectory(dirPath) {
        const allEntries = [];
        const allErrors = [];
        const files = await this.findSitemapFiles(dirPath);
        for (const file of files) {
            const result = await this.parse(file);
            allEntries.push(...result.entries);
            allErrors.push(...result.errors);
        }
        return { entries: allEntries, errors: allErrors };
    }
    async findSitemapFiles(dirPath) {
        const files = [];
        const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dirPath, item.name);
            if (item.isDirectory()) {
                const subFiles = await this.findSitemapFiles(fullPath);
                files.push(...subFiles);
            }
            else if (item.isFile() && item.name.endsWith('.xml')) {
                files.push(fullPath);
            }
        }
        return files;
    }
    parseContent(content, sourceFile, errors) {
        const entries = [];
        const lines = content.split('\n');
        try {
            const parsed = this.parser.parse(content);
            if (parsed.urlset?.url) {
                const urls = Array.isArray(parsed.urlset.url)
                    ? parsed.urlset.url
                    : [parsed.urlset.url];
                for (let i = 0; i < urls.length; i++) {
                    const urlEntry = urls[i];
                    const url = urlEntry.loc?.trim();
                    if (!url) {
                        errors.push({
                            sourceFile,
                            lineNumber: this.findLineNumber(lines, '<loc>', i),
                            error: 'URL (loc标签) 为空',
                            rawContent: JSON.stringify(urlEntry),
                        });
                        continue;
                    }
                    entries.push({
                        url,
                        lastmod: urlEntry.lastmod?.trim(),
                        changefreq: urlEntry.changefreq?.trim(),
                        priority: urlEntry.priority?.trim(),
                        sourceFile,
                        lineNumber: this.findLineNumber(lines, url, i),
                    });
                }
            }
            if (parsed.sitemapindex?.sitemap) {
                errors.push({
                    sourceFile,
                    error: '检测到嵌套sitemap索引，请确保包含所有子sitemap文件',
                });
            }
        }
        catch (error) {
            errors.push({
                sourceFile,
                error: `XML解析失败: ${error.message}`,
                rawContent: content.substring(0, 500),
            });
        }
        return { entries, errors };
    }
    findLineNumber(lines, searchString, occurrence) {
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(searchString)) {
                if (count === occurrence) {
                    return i + 1;
                }
                count++;
            }
        }
        return -1;
    }
}
exports.SitemapParser = SitemapParser;
//# sourceMappingURL=sitemap-parser.js.map