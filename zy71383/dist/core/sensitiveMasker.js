"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.masker = exports.SensitiveMasker = void 0;
const store_1 = require("./store");
class SensitiveMasker {
    constructor(customPatterns) {
        this.patterns = customPatterns || store_1.store.getSecretPatterns();
    }
    mask(obj) {
        const detectedSecrets = [];
        const maskedContent = this.maskRecursive(obj, '', detectedSecrets);
        return { maskedContent, detectedSecrets };
    }
    maskRecursive(value, currentPath, detectedSecrets) {
        if (value === null || value === undefined) {
            return value;
        }
        if (typeof value === 'string') {
            return this.maskString(value, currentPath, detectedSecrets);
        }
        if (Array.isArray(value)) {
            return value.map((item, index) => this.maskRecursive(item, `${currentPath}[${index}]`, detectedSecrets));
        }
        if (typeof value === 'object') {
            const result = {};
            for (const [key, val] of Object.entries(value)) {
                const newPath = currentPath ? `${currentPath}.${key}` : key;
                if (this.isSensitiveKey(key)) {
                    if (typeof val === 'string') {
                        const masked = this.maskString(val, newPath, detectedSecrets, true);
                        result[key] = masked;
                    }
                    else {
                        result[key] = this.maskRecursive(val, newPath, detectedSecrets);
                    }
                }
                else {
                    result[key] = this.maskRecursive(val, newPath, detectedSecrets);
                }
            }
            return result;
        }
        return value;
    }
    isPlaceholder(value) {
        return /^\$\{[^}]+\}$/.test(value) || /^\{\{[^}]+\}\}$/.test(value);
    }
    maskString(value, keyPath, detectedSecrets, isSensitiveKey = false) {
        if (this.isPlaceholder(value)) {
            return value;
        }
        if (isSensitiveKey && value.length > 0) {
            detectedSecrets.push({
                key: keyPath,
                value: value,
                pattern: 'Sensitive Field Name Pattern',
            });
            return '***REDACTED***';
        }
        for (const sp of this.patterns) {
            if (sp.pattern.test(value)) {
                detectedSecrets.push({
                    key: keyPath,
                    value: value,
                    pattern: sp.description,
                });
                return sp.placeholder;
            }
        }
        return value;
    }
    isSensitiveKey(key) {
        const sensitivePattern = /password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key/i;
        return sensitivePattern.test(key);
    }
    isSecretValue(value) {
        for (const sp of this.patterns) {
            if (sp.pattern.test(value)) {
                return true;
            }
        }
        return false;
    }
    addPattern(pattern) {
        this.patterns.push(pattern);
    }
    getPatterns() {
        return [...this.patterns];
    }
}
exports.SensitiveMasker = SensitiveMasker;
exports.masker = new SensitiveMasker();
//# sourceMappingURL=sensitiveMasker.js.map