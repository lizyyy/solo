import {
    getStore, getActiveProject, setActiveProject,
    createProject, updateProject, addHistory,
    addPosterAsset, removePosterAsset, addColorCard,
    setAuthorization, addReview, addCorrection, addExport,
    getColorCardDiff, genId, formatTime
} from './store.js';
import { checkAuthorization } from './auth-check.js';
import { checkColorCardConsistency, checkPosterSpec, buildColorCardChangeAlert } from './review.js';
import {
    resolveExportSizes, renderExportSize,
    canvasToBlob, downloadBlob, generateDeliveryNote
} from './export-engine.js';
import {
    renderJudgment, renderStatus, renderTimeline,
    renderColorCardDiff, renderCorrectionIssues
} from './ui-render.js';

let phaserGame = null;
let posterTextures = {};
let currentScene = 'import';
let pendingColorCardData = null;

function init() {
    initPhaser();
    bindNavigation();
    bindImportPanel();
    bindReviewPanel();
    bindCorrectionPanel();
    bindHistoryPanel();
    bindExportPanel();
    bindModals();
    loadActiveProject();
}

function initPhaser() {
    const container = document.getElementById('phaser-container');
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    phaserGame = new Phaser.Game({
        type: Phaser.CANVAS,
        width,
        height,
        parent: 'phaser-container',
        backgroundColor: '#111111',
        scene: {
            create: function () {
                this.add.text(width / 2, height / 2, '海报多尺寸导出', {
                    fontSize: '20px',
                    color: '#666'
                }).setOrigin(0.5);

                this.add.text(width / 2, height / 2 + 30, '在右侧面板导入素材后，海报预览将显示在此处', {
                    fontSize: '13px',
                    color: '#444'
                }).setOrigin(0.5);
            }
        },
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        }
    });
}

function updatePhaserPreview(project) {
    if (!phaserGame || !project) return;

    phaserGame.scene.stop('default');

    const container = document.getElementById('phaser-container');
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const sceneConfig = {
        create: function () {
            const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x111111);

            if (project.posterAssets.length > 0) {
                const asset = project.posterAssets[project.posterAssets.length - 1];
                if (asset.dataUrl) {
                    this.textures.remove('posterPreview');
                    this.textures.addBase64('posterPreview', asset.dataUrl);
                    this.time.delayedCall(200, () => {
                        try {
                            const tex = this.textures.get('posterPreview');
                            if (tex && tex.getSourceImage()) {
                                const imgW = tex.getSourceImage().width;
                                const imgH = tex.getSourceImage().height;
                                const scale = Math.min((width - 40) / imgW, (height - 40) / imgH, 1);
                                const img = this.add.image(width / 2, height / 2, 'posterPreview');
                                img.setScale(scale);
                            }
                        } catch (e) {
                            this.add.text(width / 2, height / 2, '预览加载中…', {
                                fontSize: '14px', color: '#666'
                            }).setOrigin(0.5);
                        }
                    });
                }
            } else {
                this.add.text(width / 2, height / 2, '海报多尺寸导出', {
                    fontSize: '20px', color: '#666'
                }).setOrigin(0.5);
                this.add.text(width / 2, height / 2 + 30, '在右侧面板导入素材后，海报预览将显示在此处', {
                    fontSize: '13px', color: '#444'
                }).setOrigin(0.5);
            }

            if (project.colorCards.length > 0) {
                const latest = project.colorCards[project.colorCards.length - 1];
                const colors = latest.colors || [];
                const startX = 20;
                const startY = height - 50;
                const swatchSize = 24;
                const gap = 4;

                this.add.text(startX, startY - 18, `色卡 v${latest.version}`, {
                    fontSize: '11px', color: '#888'
                });

                colors.slice(0, Math.floor((width - 40) / (swatchSize + gap))).forEach((c, i) => {
                    const colorNum = parseInt(c.hex.replace('#', ''), 16);
                    this.add.rectangle(
                        startX + i * (swatchSize + gap) + swatchSize / 2,
                        startY + swatchSize / 2,
                        swatchSize, swatchSize, colorNum
                    ).setStrokeStyle(1, 0x333333);
                });
            }

            if (project.authorization) {
                const authResult = checkAuthorization(project.authorization);
                const statusColor = authResult.status === 'pass' ? 0x2ecc71 : authResult.status === 'warn' ? 0xf39c12 : 0xe74c3c;
                this.add.rectangle(width - 80, 20, 12, 12, statusColor).setStrokeStyle(1, 0x333333);
                this.add.text(width - 70, 20, `授权：${authResult.label}`, {
                    fontSize: '11px', color: '#888'
                }).setOrigin(0, 0.5);
            }
        }
    };

    phaserGame.scene.add('preview_' + Date.now(), sceneConfig, true);
}

function bindNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const scene = btn.dataset.scene;
            switchPanel(scene);
        });
    });
}

function switchPanel(scene) {
    currentScene = scene;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + scene);
    if (panel) panel.classList.add('active');

    const project = getActiveProject();

    if (scene === 'review' && project) {
        autoRunReview(project);
    }
    if (scene === 'correction' && project) {
        renderCorrectionIssues(project);
    }
    if (scene === 'history' && project) {
        renderTimeline(project.history, document.getElementById('history-type-filter').value);
    }
}

function bindImportPanel() {
    const inputPoster = document.getElementById('input-poster');
    const inputColorcard = document.getElementById('input-colorcard');
    const inputAuth = document.getElementById('input-auth');

    inputPoster.addEventListener('change', (e) => handleFileSelect(e, 'poster'));
    inputColorcard.addEventListener('change', (e) => handleFileSelect(e, 'colorcard'));
    inputAuth.addEventListener('change', (e) => handleFileSelect(e, 'auth'));

    document.getElementById('btn-import-confirm').addEventListener('click', handleImportConfirm);
}

function handleFileSelect(event, type) {
    const files = event.target.files;
    if (!files.length) return;

    const listEl = document.getElementById(type + '-preview-list') || document.getElementById('colorcard-preview-list');

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.dataset.fileName = file.name;
            item.dataset.fileType = type;
            item.dataset.dataUrl = e.target.result;

            const thumb = type === 'poster' || type === 'auth'
                ? `<img class="file-thumb" src="${e.target.result}">`
                : '';

            item.innerHTML = `
                ${thumb}
                <span class="file-name">${file.name}</span>
                <span class="file-remove" title="移除">✕</span>
            `;

            item.querySelector('.file-remove').addEventListener('click', () => item.remove());

            listEl.appendChild(item);
        };
        reader.readAsDataURL(file);
    }
}

async function handleImportConfirm() {
    const project = getActiveProject();
    if (!project) {
        renderStatus('import-status', '请先创建或选择一个项目。', 'danger');
        return;
    }

    const posterItems = document.querySelectorAll('#poster-preview-list .file-item');
    const colorcardItems = document.querySelectorAll('#colorcard-preview-list .file-item');
    const authItems = document.querySelectorAll('#auth-preview-list .file-item');

    let importCount = 0;

    for (const item of posterItems) {
        const dataUrl = item.dataset.dataUrl;
        const name = item.dataset.fileName;
        if (!dataUrl) continue;

        const dims = await getImageDimensions(dataUrl);
        addPosterAsset(project.id, {
            name,
            dataUrl,
            type: 'image',
            width: dims.width,
            height: dims.height
        });
        importCount++;
    }

    for (const item of colorcardItems) {
        const dataUrl = item.dataset.dataUrl;
        const name = item.dataset.fileName;
        if (!dataUrl) continue;

        const colors = await extractColorsFromImage(dataUrl);
        const newCardData = { name, colors, dataUrl };

        const diff = getColorCardDiff(project.id, newCardData);
        if (diff && (diff.modified.length > 0 || diff.added.length > 0 || diff.removed.length > 0)) {
            pendingColorCardData = { newCardData, diff };
            const prevVersion = project.colorCards[project.colorCards.length - 1].version;
            showColorCardChangeAlert(diff, prevVersion, prevVersion + 1);
        } else {
            const newCard = addColorCard(project.id, newCardData);
            addHistory(project.id, {
                actionType: 'import',
                action: '导入色卡',
                detail: `色卡版本 ${newCard.version}，包含 ${colors.length} 个颜色`,
                judgmentReason: diff ? '与上一版本一致，无变更' : '首次导入色卡'
            });
            importCount++;
        }
    }

    const authHolder = document.getElementById('auth-holder').value;
    const authStart = document.getElementById('auth-start').value;
    const authEnd = document.getElementById('auth-end').value;
    const authScope = document.getElementById('auth-scope').value;

    if (authHolder || authStart || authEnd) {
        setAuthorization(project.id, {
            holder: authHolder,
            startDate: authStart,
            endDate: authEnd,
            scope: authScope
        });

        const authResult = checkAuthorization({ holder: authHolder, startDate: authStart, endDate: authEnd, scope: authScope });
        addHistory(project.id, {
            actionType: 'import',
            action: '导入授权信息',
            detail: `授权方：${authHolder || '未填写'}，有效期：${authStart || '?'} 至 ${authEnd || '?'}`,
            judgmentReason: `自动判断：${authResult.label}。${authResult.reason}`
        });
        importCount++;
    }

    for (const item of authItems) {
        importCount++;
    }

    if (importCount > 0) {
        renderStatus('import-status', `导入完成，共处理 ${importCount} 项。`, 'success');
        addHistory(project.id, {
            actionType: 'import',
            action: '执行导入',
            detail: `导入 ${importCount} 项素材/信息`
        });
        updatePhaserPreview(getActiveProject());
    } else {
        renderStatus('import-status', '没有可导入的内容。', 'warning');
    }
}

function getImageDimensions(dataUrl) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = dataUrl;
    });
}

async function extractColorsFromImage(dataUrl) {
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    const sampleSize = 50;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    const colorMap = {};
    const step = 20;

    for (let i = 0; i < imageData.length; i += 4 * step) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        const key = `${qr},${qg},${qb}`;
        colorMap[key] = (colorMap[key] || 0) + 1;
    }

    const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
    const topColors = sorted.slice(0, 8);

    return topColors.map(([key], i) => {
        const [r, g, b] = key.split(',').map(Number);
        const hex = '#' + [r, g, b].map(v => Math.min(255, v).toString(16).padStart(2, '0')).join('');
        return { name: `色${i + 1}`, hex, rgb: { r, g, b } };
    });
}

function showColorCardChangeAlert(diff, oldVersion, newVersion) {
    renderColorCardDiff(diff, oldVersion, newVersion);
    document.getElementById('colorcard-change-alert').style.display = 'flex';
}

function bindReviewPanel() {
    document.getElementById('btn-review-run').addEventListener('click', () => {
        const project = getActiveProject();
        if (!project) {
            renderStatus('review-summary', '请先选择一个项目。', 'danger');
            return;
        }
        autoRunReview(project);
    });
}

function autoRunReview(project) {
    const authResult = checkAuthorization(project.authorization);
    renderJudgment('auth-judgment', authResult);

    const colorCardResult = checkColorCardConsistency(project);
    renderJudgment('colorcard-judgment', colorCardResult);

    const posterResult = checkPosterSpec(project);
    renderJudgment('poster-judgment', posterResult);

    const allPass = authResult.status === 'pass' && colorCardResult.status !== 'fail' && posterResult.status !== 'fail';
    const hasWarn = authResult.status === 'warn' || colorCardResult.status === 'warn' || posterResult.status === 'warn';

    let summaryMsg = '';
    let summaryType = 'success';

    if (allPass && !hasWarn) {
        summaryMsg = '复核通过：授权有效、色卡一致、海报规格正常。可以进入导出环节。';
        summaryType = 'success';
    } else if (allPass && hasWarn) {
        summaryMsg = '复核基本通过，但有注意事项，请查看各项判断理由和下一步建议。建议在修正环节确认后再导出。';
        summaryType = 'warning';
    } else {
        summaryMsg = '复核未通过，存在阻断项。请查看判断理由，处理后再重新复核。';
        summaryType = 'danger';
    }

    addReview(project.id, {
        authResult: { status: authResult.status, label: authResult.label },
        colorCardResult: { status: colorCardResult.status, label: colorCardResult.label },
        posterResult: { status: posterResult.status, label: posterResult.label },
        overallStatus: allPass ? (hasWarn ? 'warn' : 'pass') : 'fail'
    });

    addHistory(project.id, {
        actionType: 'review',
        action: '执行复核',
        detail: summaryMsg,
        judgmentReason: `授权：${authResult.label}；色卡：${colorCardResult.label}；海报：${posterResult.label}`
    });

    renderStatus('review-summary', summaryMsg, summaryType);
}

function bindCorrectionPanel() {
    document.getElementById('btn-correction-apply').addEventListener('click', () => {
        const project = getActiveProject();
        if (!project) return;

        const inputs = document.querySelectorAll('#correction-form input, #correction-issues input');
        let applied = 0;

        for (const input of inputs) {
            if (!input.value.trim()) continue;
            const field = input.dataset.field;
            const issueId = input.dataset.issueId;

            if (field === 'authorization.endDate') {
                setAuthorization(project.id, { ...project.authorization, endDate: input.value });
                addCorrection(project.id, {
                    field,
                    oldValue: project.authorization?.endDate || '',
                    newValue: input.value,
                    reason: `修正授权截止日期为 ${input.value}`
                });
                addHistory(project.id, {
                    actionType: 'correction',
                    action: '修正授权截止日期',
                    detail: `${project.authorization?.endDate || '无'} → ${input.value}`,
                    judgmentReason: '手动修正，授权日期已更新'
                });
                applied++;
            }

            if (field === 'colorCard') {
                addCorrection(project.id, {
                    field: 'colorCard',
                    oldValue: '',
                    newValue: '已确认色卡变更',
                    reason: '确认色卡变更，保留记录'
                });
                addHistory(project.id, {
                    actionType: 'correction',
                    action: '确认色卡变更',
                    detail: '操作者确认色卡变更，保留旧版本记录'
                });
                applied++;
            }
        }

        if (applied > 0) {
            renderStatus('correction-status', `已应用 ${applied} 项修正。`, 'success');
            updatePhaserPreview(getActiveProject());
        } else {
            renderStatus('correction-status', '没有输入修正内容。', 'warning');
        }
    });
}

function bindHistoryPanel() {
    document.getElementById('history-type-filter').addEventListener('change', (e) => {
        const project = getActiveProject();
        if (project) {
            renderTimeline(project.history, e.target.value);
        }
    });
}

function bindExportPanel() {
    const customCheckbox = document.querySelector('#export-size-options input[value="custom"]');
    const customInputs = document.getElementById('custom-size-inputs');
    customCheckbox.addEventListener('change', () => {
        customInputs.style.display = customCheckbox.checked ? 'flex' : 'none';
    });

    document.getElementById('btn-export-run').addEventListener('click', handleExport);
    document.getElementById('btn-copy-note').addEventListener('click', () => {
        const note = document.getElementById('delivery-note-content').textContent;
        navigator.clipboard.writeText(note).then(() => {
            renderStatus('export-progress', '交付说明已复制到剪贴板。', 'success');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = note;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            renderStatus('export-progress', '交付说明已复制。', 'success');
        });
    });
}

async function handleExport() {
    const project = getActiveProject();
    if (!project) {
        renderStatus('export-progress', '请先选择一个项目。', 'danger');
        return;
    }

    const authResult = checkAuthorization(project.authorization);
    const colorCardResult = checkColorCardConsistency(project);
    const posterResult = checkPosterSpec(project);

    if (authResult.status === 'fail') {
        renderStatus('export-progress', `导出阻断：${authResult.reason} ${authResult.nextStep}`, 'danger');
        addHistory(project.id, {
            actionType: 'export',
            action: '导出被阻断',
            detail: `授权状态不通过：${authResult.label}`,
            judgmentReason: authResult.reason
        });
        return;
    }

    if (posterResult.status === 'fail') {
        renderStatus('export-progress', `导出阻断：${posterResult.reason}`, 'danger');
        return;
    }

    const checkboxes = document.querySelectorAll('#export-size-options input[type="checkbox"]:checked');
    const selectedKeys = Array.from(checkboxes).map(cb => cb.value);
    const customW = document.getElementById('custom-width').value;
    const customH = document.getElementById('custom-height').value;
    const sizes = resolveExportSizes(selectedKeys, customW, customH);

    if (sizes.length === 0) {
        renderStatus('export-progress', '请至少选择一个导出尺寸。', 'warning');
        return;
    }

    renderStatus('export-progress', `正在导出 ${sizes.length} 个尺寸…`, 'info');

    const posterCanvas = await getPosterCanvas(project);
    const resultsContainer = document.getElementById('export-results');
    resultsContainer.innerHTML = '';

    const exportedSizes = [];

    for (const size of sizes) {
        const exportCanvas = renderExportSize(posterCanvas, size.width, size.height);
        const blob = await canvasToBlob(exportCanvas);
        const filename = `${project.name}_${size.key}_${size.width}x${size.height}.png`;

        const thumbUrl = exportCanvas.toDataURL('image/png');

        const resultItem = document.createElement('div');
        resultItem.className = 'export-result-item';
        resultItem.innerHTML = `
            <img class="export-thumb" src="${thumbUrl}">
            <div class="export-info">
                <div class="export-size">${size.label} ${size.width}×${size.height}</div>
                <div class="export-link" data-filename="${filename}">下载</div>
            </div>
        `;
        resultItem.querySelector('.export-link').addEventListener('click', () => {
            downloadBlob(blob, filename);
        });
        resultsContainer.appendChild(resultItem);

        exportedSizes.push(size);
    }

    const deliveryNote = generateDeliveryNote(project, exportedSizes, authResult, colorCardResult, posterResult);
    document.getElementById('delivery-note-content').textContent = deliveryNote;
    document.getElementById('delivery-note-section').style.display = 'block';

    addExport(project.id, {
        sizes: exportedSizes.map(s => ({ label: s.label, width: s.width, height: s.height })),
        deliveryNote
    });

    addHistory(project.id, {
        actionType: 'export',
        action: '执行多尺寸导出',
        detail: `导出尺寸：${exportedSizes.map(s => s.label + ' ' + s.width + '×' + s.height).join('、')}`,
        judgmentReason: `授权：${authResult.label}；色卡：${colorCardResult.label}`
    });

    renderStatus('export-progress', `导出完成！共 ${exportedSizes.length} 个尺寸。交付说明已生成，可复制给下一班。`, 'success');
}

async function getPosterCanvas(project) {
    if (project.posterAssets.length === 0) return null;
    const asset = project.posterAssets[project.posterAssets.length - 1];
    if (!asset.dataUrl) return null;

    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = asset.dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return canvas;
}

function bindModals() {
    document.getElementById('btn-new-project').addEventListener('click', () => {
        document.getElementById('new-project-modal').style.display = 'flex';
        document.getElementById('new-project-name').value = '';
        document.getElementById('new-project-name').focus();
    });

    document.getElementById('btn-create-project').addEventListener('click', () => {
        const name = document.getElementById('new-project-name').value.trim();
        if (!name) {
            alert('请输入项目名称');
            return;
        }
        const project = createProject(name);
        document.getElementById('new-project-modal').style.display = 'none';
        loadActiveProject();
        addHistory(project.id, {
            actionType: 'import',
            action: '创建项目',
            detail: `项目名称：${name}`
        });
    });

    document.getElementById('btn-cancel-project').addEventListener('click', () => {
        document.getElementById('new-project-modal').style.display = 'none';
    });

    document.getElementById('btn-accept-change').addEventListener('click', () => {
        if (!pendingColorCardData) return;
        const project = getActiveProject();
        if (!project) return;

        const { newCardData, diff } = pendingColorCardData;
        const prevVersion = project.colorCards[project.colorCards.length - 1].version;

        const alertMsg = buildColorCardChangeAlert(diff, prevVersion, prevVersion + 1);
        const newCard = addColorCard(project.id, {
            ...newCardData,
            changeAlert: alertMsg
        });

        addHistory(project.id, {
            actionType: 'colorcard_change',
            action: '色卡版本变更',
            detail: `版本 ${prevVersion} → 版本 ${newCard.version}。${diff.modified.length} 个色值变化，${diff.added.length} 个新增，${diff.removed.length} 个移除`,
            judgmentReason: `变更详情：${alertMsg}。旧版本已保留，不会静默覆盖。`
        });

        pendingColorCardData = null;
        document.getElementById('colorcard-change-alert').style.display = 'none';
        renderStatus('import-status', `色卡已更新至版本 ${newCard.version}，变更已记录，旧版本保留。`, 'success');
        updatePhaserPreview(getActiveProject());
    });

    document.getElementById('btn-reject-change').addEventListener('click', () => {
        if (!pendingColorCardData) return;
        const project = getActiveProject();
        if (!project) return;

        addHistory(project.id, {
            actionType: 'colorcard_change',
            action: '退回色卡变更',
            detail: `操作者选择退回新版色卡，保留当前版本`,
            judgmentReason: '补传色卡与现有版本不一致，操作者选择不采纳变更'
        });

        pendingColorCardData = null;
        document.getElementById('colorcard-change-alert').style.display = 'none';
        renderStatus('import-status', '已退回新版色卡，保留当前版本不变。', 'warning');
    });
}

function loadActiveProject() {
    const project = getActiveProject();
    if (project) {
        document.getElementById('current-project-name').textContent = project.name;
        updatePhaserPreview(project);
    } else {
        document.getElementById('current-project-name').textContent = '未选择项目';
    }
}

window.addEventListener('DOMContentLoaded', init);

window.addEventListener('resize', () => {
    const project = getActiveProject();
    if (project) {
        updatePhaserPreview(project);
    }
});
