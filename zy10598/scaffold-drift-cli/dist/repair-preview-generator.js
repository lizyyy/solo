"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepairPreviewGenerator = void 0;
class RepairPreviewGenerator {
    generate(drifts) {
        const previews = [];
        for (const drift of drifts) {
            const preview = this.generatePreview(drift);
            if (preview) {
                previews.push(preview);
            }
        }
        return previews;
    }
    generatePreview(drift) {
        switch (drift.type) {
            case 'file_missing':
                return {
                    driftId: drift.id,
                    path: drift.path,
                    action: 'create',
                    description: `创建缺失文件: ${drift.path}`,
                    preview: this.generateCreatePreview(drift),
                    autoFixable: true
                };
            case 'content_diff':
                return {
                    driftId: drift.id,
                    path: drift.path,
                    action: 'modify',
                    description: `修复文件内容: ${drift.path}`,
                    preview: this.generateModifyPreview(drift),
                    autoFixable: true
                };
            case 'config_missing_key':
                return {
                    driftId: drift.id,
                    path: drift.path,
                    action: 'modify',
                    description: `添加缺失配置项: ${drift.path}`,
                    preview: this.generateConfigAddPreview(drift),
                    autoFixable: true
                };
            case 'config_value_diff':
                return {
                    driftId: drift.id,
                    path: drift.path,
                    action: 'modify',
                    description: `修正配置值: ${drift.path}`,
                    preview: this.generateConfigFixPreview(drift),
                    autoFixable: true
                };
            case 'parse_error':
            case 'permission_denied':
                return {
                    driftId: drift.id,
                    path: drift.path,
                    action: 'modify',
                    description: `手动处理: ${drift.path}`,
                    preview: `原因: ${drift.reason}\n需要手动检查并修复`,
                    autoFixable: false
                };
            default:
                return null;
        }
    }
    generateCreatePreview(drift) {
        return `## 创建文件: ${drift.path}

将从模板复制以下文件:
- 源: ${drift.path} (模板)
- 目标: ${drift.path} (仓库)

操作影响:
- 这将添加一个新文件到仓库
- 文件内容将与模板完全一致

推荐操作:
- 检查模板文件内容是否适用于当前项目
- 确认没有同名的重要文件被覆盖`;
    }
    generateModifyPreview(drift) {
        let preview = `## 修改文件: ${drift.path}\n\n`;
        if (drift.diff) {
            preview += '### 内容差异:\n\n';
            for (const chunk of drift.diff) {
                const prefix = chunk.type === 'added' ? '+ ' : chunk.type === 'removed' ? '- ' : '  ';
                preview += prefix + chunk.content.replace(/\n/g, `\n${prefix}`);
            }
            preview += '\n';
        }
        preview += `
操作影响:
- 文件内容将更新以匹配模板
- 现有内容将被覆盖

注意事项:
- 请仔细审查上述差异
- 确保修改不会覆盖重要的自定义配置`;
        return preview;
    }
    generateConfigAddPreview(drift) {
        return `## 添加配置项: ${drift.path}

缺失配置:
- 文件: ${drift.path}
- 预期值: ${drift.expected || '(未知)'}

操作影响:
- 将在配置文件中添加缺失的配置项
- 不会影响其他已存在的配置

推荐操作:
- 确认默认值是否适用于当前项目
- 检查是否需要自定义配置值`;
    }
    generateConfigFixPreview(drift) {
        let preview = `## 修正配置值: ${drift.path}\n\n`;
        if (drift.expected !== undefined) {
            preview += `预期值: ${drift.expected}\n`;
        }
        if (drift.actual !== undefined) {
            preview += `当前值: ${drift.actual}\n`;
        }
        preview += `
操作影响:
- 配置值将更新为模板中的值
- 这可能影响应用程序行为

注意事项:
- 请确认修改不会破坏现有功能
- 备份当前配置以防需要回滚`;
        return preview;
    }
}
exports.RepairPreviewGenerator = RepairPreviewGenerator;
