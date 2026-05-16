"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnotationParser = void 0;
class AnnotationParser {
    constructor(content) {
        this.content = content;
    }
    extractPlaceholders() {
        const placeholders = [];
        const regex = /\{\{\s*\.([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
        let match;
        while ((match = regex.exec(this.content)) !== null) {
            placeholders.push({
                name: match[1],
                fullMatch: match[0]
            });
        }
        return placeholders;
    }
    getAllPlaceholders() {
        const templatePlaceholders = this.extractPlaceholders().map(p => p.name);
        return [...new Set(templatePlaceholders)];
    }
}
exports.AnnotationParser = AnnotationParser;
