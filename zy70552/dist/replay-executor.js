"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplayExecutor = void 0;
const uuid_1 = require("uuid");
const factory_1 = require("./engines/factory");
const config_1 = require("./utils/config");
class ReplayExecutor {
    constructor(options) {
        this.executionResults = [];
        this.badRows = [];
        this.options = { failFast: false, verifyRollback: true, preserveFailedState: false, ...options };
    }
    async execute() {
        const startTime = new Date();
        this.runId = this.options.runId || "replay_" + Date.now() + "_" + (0, uuid_1.v4)().substring(0, 8);
        this.outputDir = (0, config_1.ensureOutputDir)(this.options.outputDir, this.runId);
        console.log("Starting migration replay - Run ID: " + this.runId);
        console.log("Output directory: " + this.outputDir);
        this.engine = (0, factory_1.createDatabaseEngine)(this.options.databaseConfig);
        await this.engine.connect();
        console.log("Database connected");
        const endTime = new Date();
        const report = { runId: this.runId, summary: { totalScripts: 0, successfulScripts: 0, failedScripts: 0, badRowsCount: 0 } };
        await this.engine.disconnect();
        return report;
    }
}
exports.ReplayExecutor = ReplayExecutor;
