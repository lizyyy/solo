
import RulesEngine from './rulesEngine.js';
import TimerState from './timerState.js';
import StorageManager from './storage.js';
import ImportExportManager from './importExport.js';
import MarkdownExporter from './markdownExporter.js';
import UIComponents from './uiComponents.js';

class App {
    constructor() {
        this.init();
    }

    init() {
        this.rulesEngine = new RulesEngine();
        this.timer = new TimerState();
        this.storage = new StorageManager();
        this.importExport = new ImportExportManager(this.storage);
        this.markdownExporter = new MarkdownExporter(this.rulesEngine);

        this.appState = {
            rulesEngine: this.rulesEngine,
            timer: this.timer,
            storage: this.storage,
            importExport: this.importExport,
            markdownExporter: this.markdownExporter
        };

        this.ui = new UIComponents(this.appState);

        console.log('跳绳比赛计分台已初始化');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
