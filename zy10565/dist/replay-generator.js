"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplayGenerator = void 0;
class ReplayGenerator {
    generateCurlCommand(record, options = {}) {
        if (record.isBadLine) {
            return `# 坏行 (第 ${record.lineNumber} 行: ${record.badLineReason}\n# 原始内容: ${record.original}`;
        }
        const parts = ['curl'];
        if (record.method && record.method !== 'GET') {
            parts.push(`-X ${record.method}`);
        }
        let url = record.url || '';
        url = this.applyVariableReplacements(url, record.variables, options.variables);
        if (options.baseUrl && record.host && record.path) {
            url = url.replace(record.host, options.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''));
        }
        parts.push(`'${url}'`);
        for (const [key, value] of Object.entries(record.headers)) {
            let headerValue = this.applyVariableReplacements(value, record.variables, options.variables);
            if (options.headers && options.headers[key]) {
                headerValue = options.headers[key];
            }
            parts.push(`-H '${key}: ${headerValue}'`);
        }
        if (record.body) {
            let body = this.applyVariableReplacements(record.body, record.variables, options.variables);
            parts.push(`-d '${body}'`);
        }
        return parts.join(' ');
    }
    applyVariableReplacements(content, variables, customVars) {
        let result = content;
        for (const [name, info] of Object.entries(variables)) {
            const replacement = customVars?.[name] || `\${${name}}`;
            result = result.split(info.value).join(replacement);
        }
        return result;
    }
    generateVariableExport(variables) {
        const lines = ['# 提取的变量'];
        for (const [name, info] of Object.entries(variables)) {
            lines.push(`export ${name}="${info.value}"`);
        }
        return lines.join('\n');
    }
}
exports.ReplayGenerator = ReplayGenerator;
