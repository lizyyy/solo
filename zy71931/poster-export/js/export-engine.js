const EXPORT_PRESETS = {
    '1080x1920': { label: '竖版海报', width: 1080, height: 1920 },
    '1920x1080': { label: '横版海报', width: 1920, height: 1080 },
    '800x800': { label: '方形', width: 800, height: 800 },
    '1200x628': { label: '社交封面', width: 1200, height: 628 },
    '750x1334': { label: '手机壁纸', width: 750, height: 1334 }
};

export function getExportPresets() {
    return EXPORT_PRESETS;
}

export function resolveExportSizes(selectedSizes, customWidth, customHeight) {
    const sizes = [];
    for (const key of selectedSizes) {
        if (EXPORT_PRESETS[key]) {
            sizes.push({ key, ...EXPORT_PRESETS[key] });
        }
    }
    if (selectedSizes.includes('custom') && customWidth && customHeight) {
        sizes.push({
            key: 'custom',
            label: `自定义 ${customWidth}×${customHeight}`,
            width: parseInt(customWidth),
            height: parseInt(customHeight)
        });
    }
    return sizes;
}

export function renderExportSize(posterCanvas, targetWidth, targetHeight) {
    const offscreen = document.createElement('canvas');
    offscreen.width = targetWidth;
    offscreen.height = targetHeight;
    const ctx = offscreen.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    if (posterCanvas) {
        const srcW = posterCanvas.width;
        const srcH = posterCanvas.height;
        const scale = Math.min(targetWidth / srcW, targetHeight / srcH);
        const drawW = srcW * scale;
        const drawH = srcH * scale;
        const offsetX = (targetWidth - drawW) / 2;
        const offsetY = (targetHeight - drawH) / 2;
        ctx.drawImage(posterCanvas, offsetX, offsetY, drawW, drawH);
    }

    return offscreen;
}

export function canvasToBlob(canvas) {
    return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/png');
    });
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function generateDeliveryNote(project, exportSizes, authResult, colorCardResult, posterResult) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const lines = [];
    lines.push(`========================================`);
    lines.push(`海报多尺寸导出 - 交付说明`);
    lines.push(`========================================`);
    lines.push(``);
    lines.push(`项目：${project.name}`);
    lines.push(`导出时间：${timestamp}`);
    lines.push(``);

    lines.push(`--- 导出尺寸 ---`);
    for (const size of exportSizes) {
        lines.push(`  ${size.label}：${size.width}×${size.height}`);
    }
    lines.push(``);

    lines.push(`--- 授权状态 ---`);
    lines.push(`  判定：${authResult.label}`);
    lines.push(`  理由：${authResult.reason}`);
    lines.push(`  ${authResult.nextStep}`);
    if (project.authorization && project.authorization.endDate) {
        lines.push(`  授权截止：${project.authorization.endDate}`);
    }
    lines.push(``);

    lines.push(`--- 色卡状态 ---`);
    lines.push(`  判定：${colorCardResult.label}`);
    lines.push(`  理由：${colorCardResult.reason}`);
    if (project.colorCards.length > 0) {
        const latest = project.colorCards[project.colorCards.length - 1];
        lines.push(`  当前色卡版本：${latest.version}（${latest.colors.length} 个颜色）`);
    }
    lines.push(``);

    lines.push(`--- 海报规格 ---`);
    lines.push(`  判定：${posterResult.label}`);
    lines.push(`  理由：${posterResult.reason}`);
    lines.push(``);

    if (project.corrections.length > 0) {
        lines.push(`--- 修正记录 ---`);
        for (const c of project.corrections) {
            const d = new Date(c.timestamp);
            lines.push(`  [${d.toLocaleDateString()} ${d.toLocaleTimeString()}] ${c.field}：${c.reason}`);
        }
        lines.push(``);
    }

    lines.push(`--- 历史变更概要 ---`);
    const recentHistory = project.history.slice(-5);
    for (const h of recentHistory) {
        const d = new Date(h.timestamp);
        lines.push(`  [${d.toLocaleDateString()} ${d.toLocaleTimeString()}] ${h.action}${h.judgmentReason ? ' - ' + h.judgmentReason : ''}`);
    }
    lines.push(``);

    lines.push(`--- 接手注意事项 ---`);
    const warnings = [];
    if (authResult.status === 'warn' || authResult.status === 'fail') {
        warnings.push(`授权状态需关注：${authResult.nextStep}`);
    }
    if (colorCardResult.status === 'warn') {
        warnings.push(`色卡有变更：${colorCardResult.nextStep}`);
    }
    if (warnings.length > 0) {
        for (const w of warnings) {
            lines.push(`  ⚠ ${w}`);
        }
    } else {
        lines.push(`  无特别注意事项。`);
    }
    lines.push(``);
    lines.push(`========================================`);
    lines.push(`此说明由"海报多尺寸导出"自动生成`);
    lines.push(`如需查历史详情，打开应用查看"历史"面板`);
    lines.push(`========================================`);

    return lines.join('\n');
}
