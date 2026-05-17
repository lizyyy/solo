"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnotationParser = void 0;
class AnnotationParser {
    constructor(content) {
        this.content = content;
    }
    extractPlaceholders() {
        const placeholders = [];
        const dotSyntaxRegex = /\{\{\s*\.([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
        let match;
        while ((match = dotSyntaxRegex.exec(this.content)) !== null) {
            placeholders.push({
                name: match[1],
                fullMatch: match[0]
            });
        }
        const dollarSyntaxRegex = /\{\{\s*\$([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;
        while ((match = dollarSyntaxRegex.exec(this.content)) !== null) {
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
    extractLabelNames() {
        const placeholders = this.extractPlaceholders();
        const labelNames = [];
        for (const placeholder of placeholders) {
            if (placeholder.name.startsWith('labels.')) {
                labelNames.push(placeholder.name.replace('labels.', ''));
            }
        }
        return [...new Set(labelNames)];
    }
    hasValuePlaceholder() {
        const placeholders = this.extractPlaceholders();
        return placeholders.some(p => p.name === 'value');
    }
}
exports.AnnotationParser = AnnotationParser;
