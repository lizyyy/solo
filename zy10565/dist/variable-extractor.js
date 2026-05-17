"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariableExtractor = void 0;
class VariableExtractor {
    variableRules;
    sensitiveRules;
    variableMappings;
    constructor(variableRules = [], sensitiveRules = [], variableMappings = {}) {
        this.variableRules = [...this.getDefaultVariableRules(), ...variableRules];
        this.sensitiveRules = [...this.getDefaultSensitiveRules(), ...sensitiveRules];
        this.variableMappings = variableMappings;
    }
    extractVariables(record) {
        if (record.isBadLine) {
            return record;
        }
        const variables = {};
        if (record.host) {
            this.addVariable(variables, 'TARGET_HOST', record.host, 'host', 'url');
        }
        this.extractFromHeaders(record, variables);
        this.extractFromQueryParams(record, variables);
        this.extractFromUrl(record, variables);
        this.extractFromBody(record, variables);
        this.extractTimestamps(record, variables);
        this.applySensitiveMasking(record, variables);
        this.applyVariableMappings(variables);
        return { ...record, variables };
    }
    extractFromHeaders(record, variables) {
        for (const [key, value] of Object.entries(record.headers)) {
            const lowerKey = key.toLowerCase();
            if (this.isTokenHeader(lowerKey)) {
                const varName = this.getVariableNameForHeader(lowerKey);
                this.addVariable(variables, varName, value, 'token', 'header');
            }
            for (const rule of this.variableRules) {
                if (rule.location === 'header' && rule.headerName?.toLowerCase() === lowerKey) {
                    this.addVariable(variables, rule.name, value, rule.type, 'header');
                }
            }
        }
    }
    extractFromQueryParams(record, variables) {
        for (const [key, value] of Object.entries(record.queryParams)) {
            if (this.isTokenParam(key)) {
                const varName = `QUERY_${key.toUpperCase()}`;
                this.addVariable(variables, varName, value, 'token', 'query');
            }
            for (const rule of this.variableRules) {
                if (rule.location === 'query' && rule.queryName === key) {
                    this.addVariable(variables, rule.name, value, rule.type, 'query');
                }
            }
        }
    }
    extractFromUrl(record, variables) {
        if (!record.url)
            return;
        for (const rule of this.variableRules) {
            if (rule.location === 'url') {
                const matches = record.url.match(rule.pattern);
                if (matches) {
                    const value = matches[1] || matches[0];
                    this.addVariable(variables, rule.name, value, rule.type, 'url');
                }
            }
        }
    }
    extractFromBody(record, variables) {
        if (!record.body)
            return;
        for (const rule of this.variableRules) {
            if (rule.location === 'body') {
                const matches = record.body.match(rule.pattern);
                if (matches) {
                    const value = matches[1] || matches[0];
                    this.addVariable(variables, rule.name, value, rule.type, 'body');
                }
            }
        }
    }
    extractTimestamps(record, variables) {
        const timestampPatterns = [
            { name: 'TIMESTAMP_SEC', pattern: /\b(1[6-9]\d{8}|20\d{8})\b/g, type: 'timestamp' },
            { name: 'TIMESTAMP_MS', pattern: /\b(1[6-9]\d{11}|20\d{11})\b/g, type: 'timestamp' },
        ];
        const content = `${record.url} ${JSON.stringify(record.headers)} ${record.body || ''}`;
        for (const tsPattern of timestampPatterns) {
            const matches = content.match(tsPattern.pattern);
            if (matches) {
                const uniqueValues = [...new Set(matches)];
                uniqueValues.forEach((value, index) => {
                    const varName = uniqueValues.length > 1 ? `${tsPattern.name}_${index + 1}` : tsPattern.name;
                    this.addVariable(variables, varName, value, tsPattern.type, 'url');
                });
            }
        }
    }
    applySensitiveMasking(record, variables) {
        for (const rule of this.sensitiveRules) {
            const content = `${record.url} ${JSON.stringify(record.headers)} ${record.body || ''}`;
            const matches = content.match(rule.pattern);
            if (matches) {
                const uniqueValues = [...new Set(matches)];
                uniqueValues.forEach((value, index) => {
                    const varName = `SENSITIVE_${rule.name}_${index + 1}`;
                    this.addVariable(variables, varName, rule.replacement || '***MASKED***', 'sensitive', 'url');
                });
            }
        }
    }
    applyVariableMappings(variables) {
        for (const [oldName, newName] of Object.entries(this.variableMappings)) {
            if (variables[oldName]) {
                variables[newName] = { ...variables[oldName], name: newName };
                delete variables[oldName];
            }
        }
    }
    addVariable(variables, name, value, type, location) {
        if (variables[name]) {
            variables[name].occurrences++;
        }
        else {
            variables[name] = {
                name,
                value,
                type,
                location,
                occurrences: 1,
            };
        }
    }
    isTokenHeader(key) {
        return [
            'authorization',
            'x-auth-token',
            'x-access-token',
            'token',
            'api-key',
            'x-api-key',
            'bearer',
        ].includes(key) || key.includes('token') || key.includes('auth');
    }
    isTokenParam(key) {
        return ['token', 'access_token', 'api_key', 'auth', 'key'].includes(key.toLowerCase());
    }
    getVariableNameForHeader(key) {
        if (key === 'authorization')
            return 'AUTH_TOKEN';
        if (key === 'x-auth-token')
            return 'X_AUTH_TOKEN';
        if (key === 'x-api-key')
            return 'API_KEY';
        return `HEADER_${key.toUpperCase().replace(/-/g, '_')}`;
    }
    getDefaultVariableRules() {
        return [
            {
                name: 'BEARER_TOKEN',
                type: 'token',
                pattern: /Bearer\s+([A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)/i,
                location: 'header',
                headerName: 'authorization',
            },
        ];
    }
    getDefaultSensitiveRules() {
        return [
            { name: 'PASSWORD', pattern: /"password"\s*:\s*"([^"]+)"/gi },
            { name: 'SECRET', pattern: /"secret"\s*:\s*"([^"]+)"/gi },
            { name: 'CREDIT_CARD', pattern: /\b(?:\d[ -]*?){13,16}\b/g },
        ];
    }
}
exports.VariableExtractor = VariableExtractor;
