"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagePathValidator = void 0;
class PagePathValidator {
    constructor(config) {
        this.config = config;
    }
    validate(expectedPath, entries) {
        const actualPaths = [...new Set(entries.map(e => e.pagePath).filter(Boolean))];
        if (actualPaths.length === 0) {
            return {
                result: {
                    matches: false,
                    expected: expectedPath,
                    actual: '',
                    normalizedExpected: expectedPath,
                    normalizedActual: ''
                },
                issues: [this.createMissingPathIssue(expectedPath, entries)]
            };
        }
        const issues = [];
        let allMatch = true;
        for (const actualPath of actualPaths) {
            const match = this.checkPathMatch(expectedPath, actualPath);
            if (!match) {
                allMatch = false;
                const mismatchCount = entries.filter(e => e.pagePath === actualPath).length;
                issues.push(this.createMismatchIssue(expectedPath, actualPath, mismatchCount, entries));
            }
        }
        return {
            result: {
                matches: allMatch,
                expected: expectedPath,
                actual: actualPaths[0],
                normalizedExpected: this.normalizePath(expectedPath),
                normalizedActual: this.normalizePath(actualPaths[0])
            },
            issues
        };
    }
    checkPathMatch(expected, actual) {
        const normalizedExpected = this.normalizePath(expected);
        const normalizedActual = this.normalizePath(actual);
        switch (this.config.pagePathMatching) {
            case 'exact':
                return normalizedExpected === normalizedActual;
            case 'prefix':
                return normalizedActual.startsWith(normalizedExpected);
            case 'regex':
                try {
                    const regex = new RegExp(expected);
                    return regex.test(actual);
                }
                catch {
                    return normalizedExpected === normalizedActual;
                }
            default:
                return normalizedActual.startsWith(normalizedExpected);
        }
    }
    normalizePath(path) {
        return path
            .trim()
            .replace(/\/+/g, '/')
            .replace(/^\/+|\/+$/g, '')
            .toLowerCase();
    }
    createMissingPathIssue(expectedPath, entries) {
        const eventIds = [...new Set(entries.map(e => e.eventId))];
        const eventNames = [...new Set(entries.map(e => e.eventName))];
        return {
            id: `page-path-missing-${Date.now()}`,
            type: 'page_path_changed',
            severity: 'medium',
            eventId: eventIds[0],
            eventName: eventNames[0],
            message: `事件日志中缺少页面路径信息`,
            reason: `采集的事件日志中 pagePath 字段为空，但清单中定义为 "${expectedPath}"。可能是前端代码未设置 pagePath 参数。`,
            impactScope: [
                `期望路径: ${expectedPath}`,
                `实际路径: (空)`,
                `影响事件数: ${entries.length}`,
                `事件ID: ${eventIds.join(', ')}`
            ],
            nextActions: [
                `1. 检查前端埋点代码中是否设置了 pagePath`,
                `2. 确认事件触发时页面上下文是否正确`,
                `3. 验证自动采集页面路径的配置`
            ],
            expected: expectedPath,
            actual: ''
        };
    }
    createMismatchIssue(expectedPath, actualPath, mismatchCount, entries) {
        const eventIds = [...new Set(entries.filter(e => e.pagePath === actualPath).map(e => e.eventId))];
        const eventNames = [...new Set(entries.filter(e => e.pagePath === actualPath).map(e => e.eventName))];
        return {
            id: `page-path-mismatch-${Date.now()}`,
            type: 'page_path_changed',
            severity: 'low',
            eventId: eventIds[0],
            eventName: eventNames[0],
            message: `页面路径不匹配: 期望 "${expectedPath}"，实际 "${actualPath}"`,
            reason: `事件在不同的页面路径下被触发。可能是URL结构变更、路由配置调整，或事件被复用到其他页面。`,
            impactScope: [
                `期望路径: ${expectedPath}`,
                `实际路径: ${actualPath}`,
                `匹配模式: ${this.config.pagePathMatching}`,
                `不匹配记录数: ${mismatchCount}`
            ],
            nextActions: [
                `1. 确认页面路由是否已变更`,
                `2. 检查事件是否应在新路径下触发`,
                `3. 如是预期行为，更新清单中的 pagePath 定义`,
                `4. 考虑使用路径前缀匹配模式`
            ],
            expected: expectedPath,
            actual: actualPath
        };
    }
}
exports.PagePathValidator = PagePathValidator;
//# sourceMappingURL=page-path-validator.js.map