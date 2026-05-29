"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventAligner = void 0;
class EventAligner {
    constructor(manifest, logEntries) {
        this.manifest = manifest;
        this.logEntries = logEntries;
    }
    align() {
        const matchedEvents = new Map();
        const missingEvents = [];
        const deprecatedEvents = [];
        const renamedEvents = new Map();
        const issues = [];
        const activeEvents = this.manifest.filter(e => e.status === 'active');
        const deprecatedEventList = this.manifest.filter(e => e.status === 'deprecated');
        const renamedEventList = this.manifest.filter(e => e.status === 'renamed' && e.renamedFrom);
        const logEventMap = this.buildLogEventMap();
        for (const eventDef of activeEvents) {
            const logEntries = logEventMap.get(eventDef.id) || logEventMap.get(eventDef.name) || [];
            if (logEntries.length === 0) {
                const renamedMatch = this.findRenamedMatch(eventDef, logEventMap);
                if (renamedMatch) {
                    renamedEvents.set(renamedMatch.from, eventDef);
                    matchedEvents.set(eventDef.id, renamedMatch.entries);
                    issues.push(this.createRenamedIssue(eventDef, renamedMatch.from));
                }
                else {
                    missingEvents.push(eventDef);
                    issues.push(this.createMissingIssue(eventDef));
                }
            }
            else {
                matchedEvents.set(eventDef.id, logEntries);
            }
        }
        for (const eventDef of deprecatedEventList) {
            const logEntries = logEventMap.get(eventDef.id) || logEventMap.get(eventDef.name) || [];
            if (logEntries.length > 0) {
                deprecatedEvents.push(eventDef);
                issues.push(this.createDeprecatedIssue(eventDef));
            }
        }
        for (const eventDef of renamedEventList) {
            const oldEntries = logEventMap.get(eventDef.renamedFrom) || [];
            const newEntries = logEventMap.get(eventDef.id) || logEventMap.get(eventDef.name) || [];
            if (oldEntries.length > 0 && newEntries.length === 0) {
                issues.push(this.createRenameNotAppliedIssue(eventDef, oldEntries.length));
            }
        }
        return {
            matchedEvents,
            missingEvents,
            deprecatedEvents,
            renamedEvents,
            issues
        };
    }
    buildLogEventMap() {
        const map = new Map();
        for (const entry of this.logEntries) {
            const keys = [entry.eventId, entry.eventName].filter(Boolean);
            for (const key of keys) {
                if (!map.has(key)) {
                    map.set(key, []);
                }
                map.get(key).push(entry);
            }
        }
        return map;
    }
    findRenamedMatch(eventDef, logEventMap) {
        const oldNames = [
            eventDef.name.replace(/[_\-]/g, ' ').replace(/\s+/g, '_').toLowerCase(),
            eventDef.name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(),
        ];
        for (const [oldName, entries] of logEventMap) {
            if (oldNames.some(name => oldName.toLowerCase().includes(name) ||
                name.includes(oldName.toLowerCase()))) {
                const similarity = this.calculateSimilarity(eventDef.name, oldName);
                if (similarity > 0.7) {
                    return { from: oldName, entries };
                }
            }
        }
        return null;
    }
    calculateSimilarity(a, b) {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        let matches = 0;
        for (const char of aLower) {
            if (bLower.includes(char))
                matches++;
        }
        return matches / Math.max(aLower.length, bLower.length);
    }
    createMissingIssue(eventDef) {
        return {
            id: `missing-${eventDef.id}`,
            type: 'event_missing',
            severity: this.getMissingSeverity(eventDef),
            eventId: eventDef.id,
            eventName: eventDef.name,
            message: `事件 "${eventDef.name}" (${eventDef.id}) 在日志中缺失`,
            reason: `在采集的事件日志中未找到匹配的事件记录。可能原因：埋点代码未触发、事件ID/名称不匹配、采样过滤或前端埋点丢失。`,
            impactScope: this.getImpactScope(eventDef),
            nextActions: [
                `1. 验证前端埋点代码中事件ID是否为 "${eventDef.id}"`,
                `2. 检查页面路径 ${eventDef.pagePath} 是否可正常访问`,
                `3. 确认事件触发条件（如按钮点击、页面加载等）`,
                `4. 检查采样率配置是否过滤了该事件`,
                `5. 查看浏览器控制台是否有埋点相关错误`
            ],
            pagePath: eventDef.pagePath,
            notes: eventDef.notes,
            attachments: eventDef.attachments
        };
    }
    getMissingSeverity(eventDef) {
        if (eventDef.tags?.includes('critical') || eventDef.tags?.includes('core')) {
            return 'critical';
        }
        if (eventDef.categories?.includes('conversion') || eventDef.categories?.includes('business')) {
            return 'high';
        }
        return 'medium';
    }
    getImpactScope(eventDef) {
        const scope = [];
        if (eventDef.pagePath)
            scope.push(`页面: ${eventDef.pagePath}`);
        if (eventDef.categories?.length)
            scope.push(`分类: ${eventDef.categories.join(', ')}`);
        if (eventDef.owner)
            scope.push(`负责人: ${eventDef.owner}`);
        return scope;
    }
    createRenamedIssue(eventDef, oldName) {
        return {
            id: `renamed-${eventDef.id}`,
            type: 'event_renamed',
            severity: 'high',
            eventId: eventDef.id,
            eventName: eventDef.name,
            message: `检测到事件改名: "${oldName}" → "${eventDef.name}"`,
            reason: `日志中仍使用旧事件名称 "${oldName}"，但清单中已改为 "${eventDef.name}"。前端可能未同步更新埋点代码。`,
            impactScope: [
                `事件ID: ${eventDef.id}`,
                `旧名称: ${oldName}`,
                `新名称: ${eventDef.name}`,
                `页面: ${eventDef.pagePath}`
            ],
            nextActions: [
                `1. 通知前端开发更新事件名称为 "${eventDef.name}"`,
                `2. 确认改名是否涉及参数变更`,
                `3. 设置过渡期兼容逻辑（同时接受新旧名称）`,
                `4. 更新数据清洗规则以适配新名称`
            ],
            expected: eventDef.name,
            actual: oldName,
            pagePath: eventDef.pagePath
        };
    }
    createDeprecatedIssue(eventDef) {
        return {
            id: `deprecated-${eventDef.id}`,
            type: 'event_deprecated',
            severity: 'low',
            eventId: eventDef.id,
            eventName: eventDef.name,
            message: `已废弃事件 "${eventDef.name}" 仍在被触发`,
            reason: `该事件在 ${eventDef.deprecatedSince || '清单中'} 标记为废弃，但日志中仍有采集记录。`,
            impactScope: [
                `事件ID: ${eventDef.id}`,
                `废弃版本: ${eventDef.deprecatedSince || '未知'}`,
                `页面: ${eventDef.pagePath}`
            ],
            nextActions: [
                `1. 确认该事件是否应该被移除`,
                `2. 检查前端代码是否仍在调用该埋点`,
                `3. 评估历史数据依赖关系`,
                `4. 安排完全移除的时间节点`
            ],
            pagePath: eventDef.pagePath
        };
    }
    createRenameNotAppliedIssue(eventDef, oldCount) {
        return {
            id: `rename-fail-${eventDef.id}`,
            type: 'event_renamed',
            severity: 'high',
            eventId: eventDef.id,
            eventName: eventDef.name,
            message: `事件改名未生效: "${eventDef.renamedFrom}" → "${eventDef.name}"`,
            reason: `日志中仍有 ${oldCount} 条旧名称 "${eventDef.renamedFrom}" 的记录，但新名称 "${eventDef.name}" 完全缺失。改名可能未部署到生产环境。`,
            impactScope: [
                `事件ID: ${eventDef.id}`,
                `旧名称记录数: ${oldCount}`,
                `新名称记录数: 0`,
                `页面: ${eventDef.pagePath}`
            ],
            nextActions: [
                `1. 检查前端代码是否已合并改名变更`,
                `2. 确认发版是否包含改名代码`,
                `3. 检查CDN缓存是否已刷新`,
                `4. 验证多端（H5/小程序/App）是否都已更新`
            ],
            pagePath: eventDef.pagePath
        };
    }
}
exports.EventAligner = EventAligner;
//# sourceMappingURL=event-aligner.js.map