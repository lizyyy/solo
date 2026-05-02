export class StateManager {
    constructor() {
        this.state = this.getInitialState();
        this.listeners = {};
    }

    getInitialState() {
        return {
            dieData: null,
            graphics: [],
            rules: null,
            issues: [],
            ui: {
                zoom: 100,
                showGrid: true,
                showIssueHighlight: true,
                selectedElement: null,
                loadedSample: false
            },
            files: {
                dieCut: { name: null, loaded: false },
                graphics: { name: null, loaded: false },
                rules: { name: null, loaded: false }
            },
            validation: {
                lastRun: null,
                summary: null
            }
        };
    }

    subscribe(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);

        return () => {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        };
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    setDieData(data) {
        this.state.dieData = data;
        this.emit('dieDataChanged', data);
    }

    setGraphics(graphics) {
        this.state.graphics = graphics;
        this.emit('graphicsChanged', graphics);
    }

    setRules(rules) {
        this.state.rules = rules;
        this.emit('rulesChanged', rules);
    }

    setIssues(issues) {
        this.state.issues = issues;
        this.emit('issuesChanged', issues);
    }

    setZoom(zoom) {
        this.state.ui.zoom = zoom;
        this.emit('zoomChanged', zoom);
    }

    toggleGrid() {
        this.state.ui.showGrid = !this.state.ui.showGrid;
        this.emit('gridToggled', this.state.ui.showGrid);
    }

    toggleIssueHighlight() {
        this.state.ui.showIssueHighlight = !this.state.ui.showIssueHighlight;
        this.emit('issueHighlightToggled', this.state.ui.showIssueHighlight);
    }

    setSelectedElement(element) {
        this.state.ui.selectedElement = element;
        this.emit('selectionChanged', element);
    }

    setFileLoaded(fileType, fileName, loaded = true) {
        if (this.state.files[fileType]) {
            this.state.files[fileType].name = fileName;
            this.state.files[fileType].loaded = loaded;
            this.emit('fileLoaded', { type: fileType, name: fileName, loaded });
        }
    }

    loadSampleData() {
        this.state.ui.loadedSample = true;
        this.state.files.dieCut = { name: 'sample_diecut.json', loaded: true };
        this.state.files.graphics = { name: 'sample_graphics.csv', loaded: true };
        this.state.files.rules = { name: 'sample_rules.yaml', loaded: true };
        this.emit('sampleLoaded', true);
    }

    getState() {
        return { ...this.state };
    }

    getDieData() {
        return this.state.dieData;
    }

    getGraphics() {
        return this.state.graphics;
    }

    getRules() {
        return this.state.rules;
    }

    getIssues() {
        return this.state.issues;
    }

    getUI() {
        return { ...this.state.ui };
    }

    getFiles() {
        return { ...this.state.files };
    }

    isAllFilesLoaded() {
        return this.state.files.dieCut.loaded &&
               this.state.files.graphics.loaded &&
               this.state.files.rules.loaded;
    }

    reset() {
        this.state = this.getInitialState();
        this.emit('reset', true);
    }

    getPreviewData() {
        return {
            version: '1.0',
            exportTime: new Date().toISOString(),
            page: this.state.dieData ? {
                width: this.state.dieData.pageWidth,
                height: this.state.dieData.pageHeight,
                bleed: this.state.dieData.bleed,
                unit: 'mm'
            } : null,
            dies: this.state.dieData?.dies || [],
            graphics: this.state.graphics,
            rules: this.state.rules,
            issues: this.state.issues,
            summary: {
                totalIssues: this.state.issues.length,
                issueTypes: this.countIssuesByType(),
                validated: this.state.validation.lastRun !== null
            }
        };
    }

    countIssuesByType() {
        const counts = {
            bleed: 0,
            'text-on-line': 0,
            'missing-color': 0,
            overlap: 0
        };

        for (const issue of this.state.issues) {
            if (counts[issue.type] !== undefined) {
                counts[issue.type]++;
            }
        }

        return counts;
    }
}
