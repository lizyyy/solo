import { DieCutParser, GraphicsParser, RulesParser } from './parsers.js';
import { RuleEngine } from './ruleEngine.js';
import { CanvasRenderer } from './renderer.js';
import { StateManager } from './state.js';
import { ExportManager } from './exporter.js';

class App {
    constructor() {
        this.stateManager = new StateManager();
        this.dieCutParser = new DieCutParser();
        this.graphicsParser = new GraphicsParser();
        this.rulesParser = new RulesParser();
        this.ruleEngine = new RuleEngine();
        this.exportManager = new ExportManager(this.stateManager);

        this.initCanvas();
        this.bindEvents();
        this.subscribeToState();
    }

    initCanvas() {
        const canvas = document.getElementById('previewCanvas');
        this.renderer = new CanvasRenderer(canvas);
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.renderer.canvas.parentElement;
        this.renderer.resize(container.clientWidth, container.clientHeight);
        this.redraw();
    }

    bindEvents() {
        document.getElementById('dieCutFile').addEventListener('change', (e) => this.handleDieCutFile(e));
        document.getElementById('graphicsFile').addEventListener('change', (e) => this.handleGraphicsFile(e));
        document.getElementById('rulesFile').addEventListener('change', (e) => this.handleRulesFile(e));

        document.getElementById('loadSampleBtn').addEventListener('click', () => this.loadSampleData());

        document.getElementById('exportIssuesBtn').addEventListener('click', () => this.exportManager.exportIssuesCSV());
        document.getElementById('exportPreviewBtn').addEventListener('click', () => this.exportManager.exportPreviewJSON());

        const zoomSlider = document.getElementById('zoomSlider');
        zoomSlider.addEventListener('input', (e) => {
            const zoom = parseInt(e.target.value);
            document.getElementById('zoomValue').textContent = `${zoom}%`;
            this.renderer.setZoom(zoom);
            this.stateManager.setZoom(zoom);
            this.redraw();
        });

        document.getElementById('resetViewBtn').addEventListener('click', () => this.resetView());
        document.getElementById('toggleGridBtn').addEventListener('click', () => {
            this.stateManager.toggleGrid();
        });
        document.getElementById('toggleIssueHighlightBtn').addEventListener('click', () => {
            this.stateManager.toggleIssueHighlight();
        });
    }

    subscribeToState() {
        this.stateManager.subscribe('dieDataChanged', () => this.redraw());
        this.stateManager.subscribe('graphicsChanged', () => this.redraw());
        this.stateManager.subscribe('issuesChanged', () => this.updateIssuesDisplay());

        this.stateManager.subscribe('gridToggled', (show) => {
            this.renderer.showGrid = show;
            this.redraw();
        });

        this.stateManager.subscribe('issueHighlightToggled', (show) => {
            this.renderer.showIssueHighlight = show;
            this.redraw();
        });

        this.stateManager.subscribe('fileLoaded', (fileInfo) => {
            if (fileInfo.type === 'dieCut') this.updateFilePreview('dieCutPreview', fileInfo.name, true);
            if (fileInfo.type === 'graphics') this.updateFilePreview('graphicsPreview', fileInfo.name, true);
            if (fileInfo.type === 'rules') this.updateFilePreview('rulesPreview', fileInfo.name, true);

            if (this.stateManager.isAllFilesLoaded()) {
                this.runValidation();
                document.getElementById('exportIssuesBtn').disabled = false;
                document.getElementById('exportPreviewBtn').disabled = false;
            }
        });

        this.stateManager.subscribe('sampleLoaded', () => {
            this.runValidation();
            document.getElementById('exportIssuesBtn').disabled = false;
            document.getElementById('exportPreviewBtn').disabled = false;
            this.updateAllFilePreviews();
        });
    }

    async handleDieCutFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await this.readFile(file);
            const data = this.dieCutParser.parse(text);
            this.stateManager.setDieData(data);
            this.stateManager.setFileLoaded('dieCut', file.name, true);
            this.renderer.resetView(data.pageWidth, data.pageHeight);
            this.updateStatsDisplay();
        } catch (e) {
            this.updateFilePreview('dieCutPreview', e.message, false);
        }
    }

    async handleGraphicsFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await this.readFile(file);
            const graphics = this.graphicsParser.parse(text);
            this.stateManager.setGraphics(graphics);
            this.stateManager.setFileLoaded('graphics', file.name, true);
            this.updateStatsDisplay();
        } catch (e) {
            this.updateFilePreview('graphicsPreview', e.message, false);
        }
    }

    async handleRulesFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await this.readFile(file);
            const rules = this.rulesParser.parse(text);
            this.stateManager.setRules(rules);
            this.stateManager.setFileLoaded('rules', file.name, true);
            this.updateRulesDisplay(rules);
        } catch (e) {
            this.updateFilePreview('rulesPreview', e.message, false);
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    async loadSampleData() {
        try {
            const [dieResponse, graphicsResponse, rulesResponse] = await Promise.all([
                fetch('./samples/sample_diecut.json'),
                fetch('./samples/sample_graphics.csv'),
                fetch('./samples/sample_rules.yaml')
            ]);

            const dieText = await dieResponse.text();
            const graphicsText = await graphicsResponse.text();
            const rulesText = await rulesResponse.text();

            const dieData = this.dieCutParser.parse(dieText);
            const graphics = this.graphicsParser.parse(graphicsText);
            const rules = this.rulesParser.parse(rulesText);

            this.stateManager.setDieData(dieData);
            this.stateManager.setGraphics(graphics);
            this.stateManager.setRules(rules);
            this.stateManager.loadSampleData();

            this.renderer.resetView(dieData.pageWidth, dieData.pageHeight);
            this.updateStatsDisplay();
            this.updateRulesDisplay(rules);

            this.redraw();
        } catch (e) {
            alert(`加载示例数据失败: ${e.message}`);
        }
    }

    runValidation() {
        const dieData = this.stateManager.getDieData();
        const graphics = this.stateManager.getGraphics();
        const rules = this.stateManager.getRules();

        if (!dieData || !rules) return;

        const issues = this.ruleEngine.validate(dieData, graphics, rules);
        this.stateManager.setIssues(issues);

        this.updateIssuesDisplay();
        this.updateStatsDisplay();
        this.redraw();
    }

    redraw() {
        const dieData = this.stateManager.getDieData();
        const graphics = this.stateManager.getGraphics();
        const issues = this.stateManager.getIssues();
        const rules = this.stateManager.getRules();

        this.renderer.render(dieData, graphics, issues, rules);

        const info = this.renderer.getCanvasInfo();
        document.getElementById('canvasInfo').textContent =
            `画布: ${Math.round(info.width)}×${Math.round(info.height)} | 缩放: ${Math.round(info.zoom * 100)}%`;
    }

    resetView() {
        const dieData = this.stateManager.getDieData();
        if (dieData) {
            this.renderer.resetView(dieData.pageWidth, dieData.pageHeight);
            this.redraw();
        }
    }

    updateFilePreview(elementId, message, success) {
        const element = document.getElementById(elementId);
        element.textContent = success ? `✓ ${message}` : `✗ ${message}`;
        element.className = `file-preview ${success ? 'success' : 'error'}`;
    }

    updateAllFilePreviews() {
        this.updateFilePreview('dieCutPreview', 'sample_diecut.json', true);
        this.updateFilePreview('graphicsPreview', 'sample_graphics.csv', true);
        this.updateFilePreview('rulesPreview', 'sample_rules.yaml', true);
    }

    updateStatsDisplay() {
        const dieData = this.stateManager.getDieData();
        const graphics = this.stateManager.getGraphics();

        document.getElementById('statPageSize').textContent =
            dieData ? `${dieData.pageWidth}×${dieData.pageHeight} mm` : '--';

        document.getElementById('statDieCount').textContent =
            dieData ? dieData.dies.length : '0';

        document.getElementById('statGraphicCount').textContent =
            graphics ? graphics.length : '0';

        document.getElementById('statBleed').textContent =
            dieData ? `${dieData.bleed} mm` : '--';
    }

    updateRulesDisplay(rules) {
        if (!rules) {
            document.getElementById('rulesDisplay').innerHTML = '<p class="placeholder">请导入规则文件</p>';
            return;
        }

        const rulesEl = document.getElementById('rulesDisplay');
        rulesEl.innerHTML = `
            <div class="rule-item">
                <span class="rule-label">出血宽度</span>
                <span class="rule-value">${rules.bleed.width} mm</span>
            </div>
            <div class="rule-item">
                <span class="rule-label">安全线宽度</span>
                <span class="rule-value">${rules.safeLine.width} mm</span>
            </div>
            <div class="rule-item">
                <span class="rule-label">必需色版</span>
                <span class="rule-value">${rules.colors.required.join(', ')}</span>
            </div>
            <div class="rule-item">
                <span class="rule-label">检查重叠</span>
                <span class="rule-value">${rules.check.overlap ? '是' : '否'}</span>
            </div>
            <div class="rule-item">
                <span class="rule-label">检查出血</span>
                <span class="rule-value">${rules.check.bleed ? '是' : '否'}</span>
            </div>
            <div class="rule-item">
                <span class="rule-label">检查安全线</span>
                <span class="rule-value">${rules.check.safeLine ? '是' : '否'}</span>
            </div>
            <div class="rule-item">
                <span class="rule-label">检查色版</span>
                <span class="rule-value">${rules.check.colorLayer ? '是' : '否'}</span>
            </div>
        `;
    }

    updateIssuesDisplay() {
        const issues = this.stateManager.getIssues();
        const summary = this.ruleEngine.getIssueSummary();

        document.getElementById('issueCount').textContent = issues.length;

        const issuesList = document.getElementById('issuesList');

        if (issues.length === 0) {
            issuesList.innerHTML = '<p class="placeholder">✓ 未检测到问题</p>';
            return;
        }

        issuesList.innerHTML = issues.map(issue => `
            <div class="issue-item ${issue.type}">
                <div class="issue-title">${issue.title}</div>
                <div class="issue-detail">${issue.element}</div>
                <div class="issue-detail">${issue.detail}</div>
            </div>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
