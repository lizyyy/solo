import { computeColorCardDiff } from './store.js';

export function buildColorCardChangeAlert(diff, oldVersion, newVersion) {
    const parts = [];

    if (diff.modified.length > 0) {
        parts.push(`以下颜色色值发生了变化（版本 ${oldVersion} → 版本 ${newVersion}）：`);
        for (const item of diff.modified) {
            parts.push(`  · "${item.name}"：${item.oldHex} → ${item.newHex}`);
        }
    }

    if (diff.added.length > 0) {
        parts.push(`新增颜色：`);
        for (const item of diff.added) {
            parts.push(`  + "${item.name}" ${item.newHex}`);
        }
    }

    if (diff.removed.length > 0) {
        parts.push(`移除颜色：`);
        for (const item of diff.removed) {
            parts.push(`  - "${item.name}" ${item.oldHex}`);
        }
    }

    return parts.join('\n');
}

export function checkColorCardConsistency(project) {
    const cards = project.colorCards || [];

    if (cards.length === 0) {
        return {
            status: 'fail',
            label: '无色卡',
            reason: '项目还没有导入色卡。没有色卡就无法确认海报颜色是否符合品牌标准，上次就是因为色卡那版没人留底，结果颜色对不上。',
            nextStep: '导入品牌色卡后重新复核。如果品牌方提供了新色卡，一并导入，系统会自动对比变化。'
        };
    }

    if (cards.length === 1) {
        return {
            status: 'pass',
            label: '有色卡（单版本）',
            reason: `当前色卡版本 ${cards[0].version}，包含 ${cards[0].colors.length} 个颜色。只有一版色卡，没有历史对比。`,
            nextStep: '色卡已就绪。如果品牌方后续补传旧版本色卡，系统会自动提醒变更内容。'
        };
    }

    const latest = cards[cards.length - 1];
    const previous = cards[cards.length - 2];
    const diff = computeColorCardDiff(previous, latest);

    if (diff.modified.length === 0 && diff.added.length === 0 && diff.removed.length === 0) {
        return {
            status: 'pass',
            label: '色卡一致',
            reason: `色卡版本 ${latest.version} 与版本 ${previous.version} 完全一致，没有色值变化。`,
            nextStep: '色卡无变化，可以继续。'
        };
    }

    const changes = [];
    if (diff.modified.length > 0) changes.push(`${diff.modified.length} 个颜色色值变化`);
    if (diff.added.length > 0) changes.push(`${diff.added.length} 个新增颜色`);
    if (diff.removed.length > 0) changes.push(`${diff.removed.length} 个移除颜色`);

    return {
        status: 'warn',
        label: '色卡有变更',
        reason: `色卡从版本 ${previous.version} 更新到版本 ${latest.version}，存在变更：${changes.join('，')}。这些变化可能影响已复核的海报颜色。`,
        nextStep: '请在"修正"环节确认变更是否需要同步到当前海报。变更详情已记录在历史中，不会静默覆盖。'
    };
}

export function checkPosterSpec(project) {
    const assets = project.posterAssets || [];

    if (assets.length === 0) {
        return {
            status: 'fail',
            label: '无海报素材',
            reason: '项目还没有导入任何海报素材。',
            nextStep: '请先在"导入"环节上传海报图片。'
        };
    }

    const issues = [];
    for (const asset of assets) {
        if (asset.width && asset.height) {
            if (asset.width < 800 || asset.height < 600) {
                issues.push(`"${asset.name}" 分辨率 ${asset.width}×${asset.height} 偏低，建议不低于 800×600`);
            }
        }
    }

    if (issues.length > 0) {
        return {
            status: 'warn',
            label: '规格需关注',
            reason: issues.join('；'),
            nextStep: '确认素材分辨率是否满足导出尺寸要求。如果源文件质量不够，联系设计师提供高清版本。'
        };
    }

    return {
        status: 'pass',
        label: '规格正常',
        reason: `已导入 ${assets.length} 个海报素材，分辨率满足基本导出要求。`,
        nextStep: '素材规格正常，可以继续导出。'
    };
}
