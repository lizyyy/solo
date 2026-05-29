"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpreter = exports.DiffInterpreter = void 0;
const typeExplanations = {
    value_mismatch: {
        summary: '配置值不匹配',
        impactTemplate: '环境间配置值不一致，可能导致{env}环境行为异常',
    },
    missing_key: {
        summary: '缺少配置项',
        impactTemplate: '{env}环境缺少必要配置项，可能导致功能不可用或使用默认值',
    },
    extra_key: {
        summary: '额外配置项',
        impactTemplate: '{env}环境存在基线中未定义的配置项，可能是未同步的变更',
    },
    type_mismatch: {
        summary: '配置类型不匹配',
        impactTemplate: '{env}环境配置项类型与基线不一致，可能导致类型转换错误',
    },
    array_order_mismatch: {
        summary: '数组顺序不匹配',
        impactTemplate: '{env}环境数组元素顺序与基线不同，但元素完全相同，通常不影响功能',
    },
    plaintext_secret: {
        summary: '明文密钥检测',
        impactTemplate: '{env}环境存在明文密钥，存在严重安全隐患',
    },
    default_value_changed: {
        summary: '默认值变更',
        impactTemplate: '{env}环境配置值与默认值不一致',
    },
    placeholder_mismatch: {
        summary: '占位符不匹配',
        impactTemplate: '{env}环境密钥占位符格式不正确',
    },
};
const severityPriority = {
    critical: 'immediate',
    warning: 'soon',
    info: 'scheduled',
    false_positive: 'none',
};
class DiffInterpreter {
    interpret(diff) {
        const baseInfo = typeExplanations[diff.type] || typeExplanations.value_mismatch;
        const env = diff.environment || '目标';
        let rootCause = this.generateRootCause(diff);
        let suggestedActions = this.generateSuggestedActions(diff);
        if (diff.falsePositiveReason) {
            return {
                summary: '误报: ' + baseInfo.summary,
                impact: '此差异已被识别为误报，不会影响系统功能。',
                rootCause: diff.falsePositiveReason,
                suggestedActions: ['无需处理，可忽略此差异'],
                priority: 'none',
            };
        }
        return {
            summary: baseInfo.summary,
            impact: baseInfo.impactTemplate.replace('{env}', env),
            rootCause,
            suggestedActions,
            priority: severityPriority[diff.severity],
        };
    }
    generateRootCause(diff) {
        switch (diff.type) {
            case 'plaintext_secret':
                return this.analyzeSecretRootCause(diff);
            case 'default_value_changed':
                return this.analyzeDefaultValueRootCause(diff);
            case 'array_order_mismatch':
                return '数组在不同环境中序列化顺序不同，但元素完全一致。这通常是由于JSON序列化顺序不确定或集合类型转换导致的。';
            case 'missing_key':
                return this.analyzeMissingKeyRootCause(diff);
            case 'extra_key':
                return this.analyzeExtraKeyRootCause(diff);
            case 'type_mismatch':
                return this.analyzeTypeMismatchRootCause(diff);
            default:
                return this.analyzeValueMismatchRootCause(diff);
        }
    }
    analyzeSecretRootCause(diff) {
        const key = diff.key.toLowerCase();
        if (key.includes('password')) {
            return '密码字段直接写入配置文件，未使用环境变量或密钥管理服务。';
        }
        if (key.includes('token') || key.includes('api_key')) {
            return 'API Token 或密钥直接暴露在配置文件中，可能被提交到版本控制。';
        }
        if (key.includes('private') || key.includes('key')) {
            return '私钥或敏感密钥直接存储在配置文件中，违反安全最佳实践。';
        }
        return '敏感数据以明文形式存储在配置文件中，存在泄露风险。';
    }
    analyzeDefaultValueRootCause(diff) {
        const baselineStr = JSON.stringify(diff.baselineValue);
        const targetStr = JSON.stringify(diff.targetValue);
        return `默认值从 ${baselineStr} 变更为 ${targetStr}。` +
            (diff.requiresManualReview ? '此变更需要人工确认是否符合预期。' : '此变更是允许的，但建议记录变更原因。');
    }
    analyzeMissingKeyRootCause(diff) {
        const key = diff.key;
        if (key.includes('feature') || key.includes('flag')) {
            return '功能开关配置在目标环境中缺失，可能导致该功能使用默认值或被禁用。';
        }
        if (key.includes('timeout') || key.includes('retry')) {
            return '性能调优参数缺失，目标环境可能使用不合理的默认值。';
        }
        return `配置项 "${diff.key}" 在目标环境中未定义，可能是部署流程遗漏或配置文件不完整。`;
    }
    analyzeExtraKeyRootCause(diff) {
        const key = diff.key;
        if (key.includes('debug') || key.includes('verbose')) {
            return '调试配置在目标环境中存在但基线中没有，可能是调试完成后未清理。';
        }
        if (key.includes('deprecated') || key.includes('legacy')) {
            return '已废弃的配置项仍在目标环境中使用，建议清理。';
        }
        return `配置项 "${diff.key}" 在目标环境中存在但基线中未定义，可能是未同步的新功能配置。`;
    }
    analyzeTypeMismatchRootCause(diff) {
        const baselineType = typeof diff.baselineValue;
        const targetType = typeof diff.targetValue;
        return `配置项类型从 ${baselineType} 变为 ${targetType}。` +
            '这可能是由于配置文件解析错误、手动编辑错误或不同部署工具的类型处理差异导致的。';
    }
    analyzeValueMismatchRootCause(diff) {
        const key = diff.key.toLowerCase();
        const baselineStr = JSON.stringify(diff.baselineValue);
        const targetStr = JSON.stringify(diff.targetValue);
        if (key.includes('url') || key.includes('host') || key.includes('endpoint')) {
            return `服务端点地址不同: 基线(${baselineStr}) vs 目标(${targetStr})。这在多环境部署中是预期的，但需要确认目标地址是否正确。`;
        }
        if (key.includes('size') || key.includes('limit') || key.includes('max')) {
            return `资源限制值不同: 基线(${baselineStr}) vs 目标(${targetStr})。需要评估目标环境是否能承受此配置。`;
        }
        if (key.includes('enabled') || key.includes('active') || typeof diff.baselineValue === 'boolean') {
            return `功能开关状态不同: 基线(${baselineStr}) vs 目标(${targetStr})。需要确认目标环境的功能开关状态是否符合预期。`;
        }
        return `配置值差异: 基线(${baselineStr}) vs 目标(${targetStr})。需要确认此变更是有意的还是部署错误。`;
    }
    generateSuggestedActions(diff) {
        const actions = [];
        if (diff.suggestedAction) {
            actions.push(diff.suggestedAction);
        }
        switch (diff.type) {
            case 'plaintext_secret':
                actions.push('立即将密钥迁移到环境变量或密钥管理服务');
                actions.push('检查版本控制历史，确认密钥是否已泄露');
                actions.push('如果密钥已泄露，立即吊销并重新生成');
                actions.push('在CI/CD流程中添加密钥扫描检查');
                break;
            case 'default_value_changed':
                if (diff.requiresManualReview) {
                    actions.push('确认此默认值变更是业务需求');
                    actions.push('如果是预期变更，更新基线配置或添加到已知变更记录');
                    actions.push('如果是非预期变更，恢复为默认值');
                }
                break;
            case 'missing_key':
                actions.push('检查目标环境配置文件是否完整');
                actions.push('确认此配置项是否在目标环境中需要');
                actions.push('如果需要，从基线环境同步此配置项');
                break;
            case 'extra_key':
                actions.push('确认此配置项是否应添加到基线配置');
                actions.push('如果是过时配置，从目标环境中移除');
                actions.push('如果是新功能配置，确保所有环境都已同步');
                break;
            case 'type_mismatch':
                actions.push('检查配置文件格式是否正确');
                actions.push('确认部署工具或配置解析器是否处理类型转换');
                actions.push('统一所有环境的配置类型');
                break;
            case 'value_mismatch':
                actions.push('确认此值的差异是否是各环境的预期差异');
                actions.push('如果是非预期差异，从基线环境同步配置');
                actions.push('如果是预期差异，记录变更原因并添加到已知变更');
                break;
            case 'array_order_mismatch':
                actions.push('此差异通常无需处理');
                actions.push('如果顺序敏感，确认目标环境顺序是否正确');
                break;
        }
        if (diff.requiresManualReview) {
            actions.push('此差异需要人工审核确认');
        }
        return actions.length > 0 ? actions : ['请人工审核此差异'];
    }
    formatForDisplay(diff) {
        const interpretation = this.interpret(diff);
        const severityEmoji = this.getSeverityEmoji(diff.severity);
        const priorityLabel = this.getPriorityLabel(interpretation.priority);
        let output = `\n${severityEmoji} ${diff.key}\n`;
        output += `  类型: ${diff.type} | 严重度: ${diff.severity} | 优先级: ${priorityLabel}\n`;
        output += `  环境: ${diff.environment || '未指定'}\n`;
        output += `  说明: ${diff.explanation}\n`;
        output += `  影响: ${interpretation.impact}\n`;
        output += `  根因: ${interpretation.rootCause}\n`;
        if (diff.baselineValue !== undefined) {
            output += `  基线值: ${JSON.stringify(diff.baselineValue)}\n`;
        }
        if (diff.targetValue !== undefined) {
            output += `  目标值: ${JSON.stringify(diff.targetValue)}\n`;
        }
        if (interpretation.suggestedActions.length > 0) {
            output += `  建议操作:\n`;
            interpretation.suggestedActions.forEach((action, i) => {
                output += `    ${i + 1}. ${action}\n`;
            });
        }
        if (diff.requiresManualReview) {
            output += `  ⚠️  需要人工处理\n`;
        }
        if (diff.falsePositiveReason) {
            output += `  ℹ️  误报原因: ${diff.falsePositiveReason}\n`;
        }
        if (diff.relatedChangeId) {
            output += `  📝  关联变更记录: ${diff.relatedChangeId}\n`;
        }
        return output;
    }
    getSeverityEmoji(severity) {
        switch (severity) {
            case 'critical': return '🔴';
            case 'warning': return '🟡';
            case 'info': return '🔵';
            case 'false_positive': return '⚪';
        }
    }
    getPriorityLabel(priority) {
        switch (priority) {
            case 'immediate': return '立即处理';
            case 'soon': return '尽快处理';
            case 'scheduled': return '计划处理';
            case 'none': return '无需处理';
            default: return priority;
        }
    }
}
exports.DiffInterpreter = DiffInterpreter;
exports.interpreter = new DiffInterpreter();
//# sourceMappingURL=diffInterpreter.js.map