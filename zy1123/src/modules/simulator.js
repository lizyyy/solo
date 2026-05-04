const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Workspace = require('./workspace');
const LeaseManager = require('./lease-manager');
const WriteCoordinator = require('./write-coordinator');
const MergeEngine = require('./merge-engine');

const SIMULATION_SCENARIOS = {
    OVERWRITE: 'overwrite',
    CLEAN_MERGE: 'clean_merge',
    CONFLICT: 'conflict',
    MIXED: 'mixed'
};

class Simulator {
    constructor(workspace) {
        this.workspace = workspace;
        this.leaseManager = new LeaseManager(workspace);
        this.coordinator = new WriteCoordinator(workspace);
        this.mergeEngine = new MergeEngine();
    }

    async runSimulation(options = {}) {
        const {
            scenario = SIMULATION_SCENARIOS.MIXED,
            workerCount = 3,
            fileTypes = ['md', 'json'],
            iterations = 5,
            delayMs = 100,
            verbose = false
        } = options;

        const results = {
            scenario,
            workerCount,
            iterations,
            startedAt: new Date().toISOString(),
            workers: [],
            operations: [],
            statistics: {
                totalWrites: 0,
                successfulWrites: 0,
                mergedWrites: 0,
                conflicts: 0,
                rejections: 0,
                leaseIssues: 0
            },
            filesCreated: []
        };

        const testFiles = this._createTestFiles(fileTypes);
        results.filesCreated = testFiles;

        const workers = [];
        for (let i = 0; i < workerCount; i++) {
            const workerName = `worker-${i + 1}`;
            workers.push({
                name: workerName,
                id: uuidv4()
            });
            results.workers.push({
                name: workerName,
                operations: []
            });
        }

        for (let iteration = 0; iteration < iterations; iteration++) {
            if (verbose) {
                console.log(`\n=== Iteration ${iteration + 1}/${iterations} ===`);
            }

            for (const testFile of testFiles) {
                const operations = [];

                for (let w = 0; w < workers.length; w++) {
                    const worker = workers[w];
                    const workerResult = results.workers.find(wr => wr.name === worker.name);

                    let operation;
                    switch (scenario) {
                        case SIMULATION_SCENARIOS.OVERWRITE:
                            operation = await this._simulateOverwrite(worker, testFile, iteration, w, workers.length);
                            break;
                        case SIMULATION_SCENARIOS.CLEAN_MERGE:
                            operation = await this._simulateCleanMerge(worker, testFile, iteration, w, workers.length);
                            break;
                        case SIMULATION_SCENARIOS.CONFLICT:
                            operation = await this._simulateConflict(worker, testFile, iteration, w, workers.length);
                            break;
                        case SIMULATION_SCENARIOS.MIXED:
                        default:
                            if (testFile.type === 'md') {
                                operation = await this._simulateCleanMerge(worker, testFile, iteration, w, workers.length);
                            } else {
                                operation = await this._simulateConflict(worker, testFile, iteration, w, workers.length);
                            }
                            break;
                    }

                    operation.worker = worker.name;
                    operation.iteration = iteration + 1;
                    operation.file = testFile.path;

                    results.operations.push(operation);
                    workerResult.operations.push(operation);

                    this._updateStatistics(results.statistics, operation);

                    if (delayMs > 0) {
                        await this._delay(delayMs + Math.random() * 50);
                    }
                }
            }
        }

        results.endedAt = new Date().toISOString();
        results.durationMs = new Date(results.endedAt) - new Date(results.startedAt);

        return results;
    }

    _createTestFiles(fileTypes) {
        const files = [];

        if (fileTypes.includes('md') || fileTypes.includes('markdown')) {
            const mdContent = `# Project Documentation

## Overview

This is the base version of the documentation.

## Getting Started

1. Install dependencies
2. Configure environment
3. Run the application

## Configuration

Default settings are:
- Port: 3000
- Host: localhost
`;
            const mdPath = 'docs/README.md';
            this.workspace.writeWorkingFile(mdPath, mdContent);
            this.workspace.createRevision(mdPath, mdContent, 'system', 'Initial documentation');
            files.push({
                path: mdPath,
                type: 'md',
                baseContent: mdContent
            });
        }

        if (fileTypes.includes('json')) {
            const jsonContent = JSON.stringify({
                app: {
                    name: "doc-sync-demo",
                    version: "1.0.0",
                    port: 3000
                },
                database: {
                    host: "localhost",
                    port: 5432,
                    name: "app_db"
                },
                features: {
                    enableAuth: true,
                    enableLogging: false,
                    maxConnections: 10
                }
            }, null, 2);

            const jsonPath = 'config/app.json';
            this.workspace.writeWorkingFile(jsonPath, jsonContent);
            this.workspace.createRevision(jsonPath, jsonContent, 'system', 'Initial configuration');
            files.push({
                path: jsonPath,
                type: 'json',
                baseContent: jsonContent
            });
        }

        return files;
    }

    async _simulateOverwrite(worker, testFile, iteration, workerIndex, totalWorkers) {
        const startTime = Date.now();
        const operation = {
            type: 'overwrite_attempt',
            startedAt: new Date().toISOString()
        };

        try {
            const leaseResult = this.leaseManager.acquireLease(
                testFile.path,
                worker.name,
                60
            );

            if (!leaseResult.success) {
                operation.result = 'rejected';
                operation.reason = leaseResult.reason;
                operation.message = leaseResult.message;
                operation.durationMs = Date.now() - startTime;
                return operation;
            }

            const lease = leaseResult.lease;

            let newContent;
            if (testFile.type === 'md') {
                newContent = this._createOverwriteMarkdown(testFile.baseContent, worker.name, iteration);
            } else {
                newContent = this._createOverwriteJson(testFile.baseContent, worker.name, iteration);
            }

            const writeResult = await this.coordinator.attemptWrite(
                testFile.path,
                newContent,
                worker.name,
                {
                    leaseId: lease.id,
                    expectedRevisionId: lease.expectedRevisionId,
                    autoMerge: false
                }
            );

            this.leaseManager.releaseLease(lease.id, worker.name);

            operation.writeResult = writeResult;
            operation.result = this._mapWriteResult(writeResult.result);
            operation.message = writeResult.message;
            operation.durationMs = Date.now() - startTime;

        } catch (error) {
            operation.result = 'error';
            operation.error = error.message;
            operation.durationMs = Date.now() - startTime;
        }

        return operation;
    }

    async _simulateCleanMerge(worker, testFile, iteration, workerIndex, totalWorkers) {
        const startTime = Date.now();
        const operation = {
            type: 'clean_merge_attempt',
            startedAt: new Date().toISOString()
        };

        try {
            const currentRevision = this.workspace.getFileRevision(testFile.path);
            const baseContent = currentRevision
                ? this.workspace._loadSnapshot(currentRevision.hash)
                : testFile.baseContent;

            let newContent;
            if (testFile.type === 'md') {
                newContent = this._createSectionModifiedMarkdown(
                    baseContent,
                    worker.name,
                    iteration,
                    workerIndex
                );
            } else {
                newContent = this._createPathModifiedJson(
                    baseContent,
                    worker.name,
                    iteration,
                    workerIndex
                );
            }

            const writeResult = await this.coordinator.attemptWrite(
                testFile.path,
                newContent,
                worker.name,
                {
                    skipLeaseCheck: true,
                    autoMerge: true
                }
            );

            operation.writeResult = writeResult;
            operation.result = this._mapWriteResult(writeResult.result);
            operation.message = writeResult.message;
            operation.durationMs = Date.now() - startTime;

        } catch (error) {
            operation.result = 'error';
            operation.error = error.message;
            operation.durationMs = Date.now() - startTime;
        }

        return operation;
    }

    async _simulateConflict(worker, testFile, iteration, workerIndex, totalWorkers) {
        const startTime = Date.now();
        const operation = {
            type: 'conflict_attempt',
            startedAt: new Date().toISOString()
        };

        try {
            const currentRevision = this.workspace.getFileRevision(testFile.path);
            const baseContent = currentRevision
                ? this.workspace._loadSnapshot(currentRevision.hash)
                : testFile.baseContent;

            let newContent;
            if (testFile.type === 'md') {
                newContent = this._createConflictingMarkdown(
                    baseContent,
                    worker.name,
                    iteration,
                    workerIndex
                );
            } else {
                newContent = this._createConflictingJson(
                    baseContent,
                    worker.name,
                    iteration,
                    workerIndex
                );
            }

            const writeResult = await this.coordinator.attemptWrite(
                testFile.path,
                newContent,
                worker.name,
                {
                    skipLeaseCheck: true,
                    autoMerge: true
                }
            );

            operation.writeResult = writeResult;
            operation.result = this._mapWriteResult(writeResult.result);
            operation.message = writeResult.message;
            operation.durationMs = Date.now() - startTime;

        } catch (error) {
            operation.result = 'error';
            operation.error = error.message;
            operation.durationMs = Date.now() - startTime;
        }

        return operation;
    }

    _createOverwriteMarkdown(baseContent, workerName, iteration) {
        return `# Project Documentation (Overwritten by ${workerName})

## Overview

This version was completely overwritten by ${workerName} in iteration ${iteration + 1}.

## New Section Added

This is a new section that replaces everything else.
`;
    }

    _createOverwriteJson(baseContent, workerName, iteration) {
        return JSON.stringify({
            overwrittenBy: workerName,
            iteration: iteration + 1,
            timestamp: new Date().toISOString(),
            app: {
                name: `overwritten-${workerName}`,
                version: `0.0.${iteration}`
            }
        }, null, 2);
    }

    _createSectionModifiedMarkdown(baseContent, workerName, iteration, workerIndex) {
        const sections = [
            {
                marker: '## Getting Started',
                content: `## Getting Started

Steps updated by ${workerName}:
1. Install dependencies (\`npm install\`)
2. Configure environment (copy .env.example to .env)
3. Run the application (\`npm start\`)
4. Verify at http://localhost:3000
`
            },
            {
                marker: '## Configuration',
                content: `## Configuration (${workerName}'s update)

Settings for iteration ${iteration + 1}:
- Port: ${3000 + workerIndex}
- Host: localhost
- Environment: development
`
            },
            {
                marker: '## Overview',
                content: `## Overview

Modified by ${workerName} in iteration ${iteration + 1}.
This documentation covers the project setup and configuration.
`
            }
        ];

        const section = sections[workerIndex % sections.length];
        return baseContent.replace(
            new RegExp(`${section.marker}[\\s\\S]*?(?=##|$)`, 'g'),
            section.content
        );
    }

    _createPathModifiedJson(baseContent, workerName, iteration, workerIndex) {
        const obj = JSON.parse(baseContent);
        const paths = [
            ['app', 'port'],
            ['features', 'maxConnections'],
            ['database', 'name']
        ];

        const pathToModify = paths[workerIndex % paths.length];
        let current = obj;
        for (let i = 0; i < pathToModify.length - 1; i++) {
            if (!current[pathToModify[i]]) {
                current[pathToModify[i]] = {};
            }
            current = current[pathToModify[i]];
        }

        const key = pathToModify[pathToModify.length - 1];
        const originalValue = current[key];

        if (typeof originalValue === 'number') {
            current[key] = originalValue + iteration + 1;
        } else if (typeof originalValue === 'string') {
            current[key] = `${originalValue}-${workerName}-v${iteration}`;
        } else {
            current[key] = {
                original: originalValue,
                modifiedBy: workerName,
                iteration: iteration + 1
            };
        }

        return JSON.stringify(obj, null, 2);
    }

    _createConflictingMarkdown(baseContent, workerName, iteration, workerIndex) {
        const conflictSection = `## Overview

**Conflict Version by ${workerName}**

This is a conflicting change to the Overview section.
All workers are modifying this same section at the same time.
Worker specific value: ${workerIndex * 100 + iteration}
`;

        return baseContent.replace(
            /## Overview[\s\S]*?(?=##|$)/g,
            conflictSection
        );
    }

    _createConflictingJson(baseContent, workerName, iteration, workerIndex) {
        const obj = JSON.parse(baseContent);

        obj.app = {
            ...obj.app,
            name: `app-by-${workerName}`,
            version: `1.${iteration}.${workerIndex}`,
            port: 8000 + workerIndex * 100 + iteration
        };

        return JSON.stringify(obj, null, 2);
    }

    _mapWriteResult(writeResult) {
        const WriteCoordinator = require('./write-coordinator');
        switch (writeResult) {
            case WriteCoordinator.WRITE_RESULT.SUCCESS:
                return 'success';
            case WriteCoordinator.WRITE_RESULT.MERGED:
                return 'merged';
            case WriteCoordinator.WRITE_RESULT.CONFLICT:
                return 'conflict';
            case WriteCoordinator.WRITE_RESULT.LEASE_EXPIRED:
                return 'lease_expired';
            case WriteCoordinator.WRITE_RESULT.VERSION_MISMATCH:
                return 'version_mismatch';
            case WriteCoordinator.WRITE_RESULT.REJECTED:
                return 'rejected';
            default:
                return 'unknown';
        }
    }

    _updateStatistics(stats, operation) {
        stats.totalWrites++;

        switch (operation.result) {
            case 'success':
                stats.successfulWrites++;
                break;
            case 'merged':
                stats.mergedWrites++;
                break;
            case 'conflict':
                stats.conflicts++;
                break;
            case 'lease_expired':
            case 'version_mismatch':
                stats.leaseIssues++;
                break;
            case 'rejected':
                stats.rejections++;
                break;
        }
    }

    generateSimulationReport(simulationResults, format = 'md') {
        const {
            scenario,
            workerCount,
            iterations,
            startedAt,
            endedAt,
            durationMs,
            workers,
            operations,
            statistics,
            filesCreated
        } = simulationResults;

        if (format === 'json') {
            return JSON.stringify(simulationResults, null, 2);
        }

        let md = `# Simulation Report: ${scenario}\n\n`;
        md += `Generated: ${new Date().toISOString()}\n\n`;

        md += `## Summary\n\n`;
        md += `- **Scenario**: ${scenario}\n`;
        md += `- **Workers**: ${workerCount}\n`;
        md += `- **Iterations**: ${iterations}\n`;
        md += `- **Duration**: ${durationMs}ms\n`;
        md += `- **Started**: ${startedAt}\n`;
        md += `- **Ended**: ${endedAt}\n\n`;

        md += `## Statistics\n\n`;
        md += `| Metric | Value |\n`;
        md += `|--------|-------|\n`;
        md += `| Total Write Attempts | ${statistics.totalWrites} |\n`;
        md += `| Successful Writes | ${statistics.successfulWrites} |\n`;
        md += `| Auto-Merged Writes | ${statistics.mergedWrites} |\n`;
        md += `| Conflicts Detected | ${statistics.conflicts} |\n`;
        md += `| Rejections | ${statistics.rejections} |\n`;
        md += `| Lease/Version Issues | ${statistics.leaseIssues} |\n\n`;

        md += `## Test Files Created\n\n`;
        filesCreated.forEach(file => {
            md += `- **${file.path}** (${file.type})\n`;
        });
        md += `\n`;

        md += `## Worker Details\n\n`;
        workers.forEach(worker => {
            const workerStats = {
                total: worker.operations.length,
                success: worker.operations.filter(o => o.result === 'success').length,
                merged: worker.operations.filter(o => o.result === 'merged').length,
                conflict: worker.operations.filter(o => o.result === 'conflict').length,
                rejected: worker.operations.filter(o => o.result === 'rejected' || o.result === 'lease_expired' || o.result === 'version_mismatch').length
            };

            md += `### ${worker.name}\n\n`;
            md += `| Result | Count |\n`;
            md += `|--------|-------|\n`;
            md += `| Success | ${workerStats.success} |\n`;
            md += `| Merged | ${workerStats.merged} |\n`;
            md += `| Conflict | ${workerStats.conflict} |\n`;
            md += `| Rejected/Issues | ${workerStats.rejected} |\n`;
            md += `\n`;
        });

        md += `## Recent Operations\n\n`;
        const recentOps = operations.slice(-15);
        recentOps.forEach((op, idx) => {
            md += `${idx + 1}. **${op.worker}** - ${op.type} on ${op.file} (iteration ${op.iteration})\n`;
            md += `   - Result: \`${op.result}\`\n`;
            md += `   - Message: ${op.message}\n`;
            md += `   - Duration: ${op.durationMs}ms\n\n`;
        });

        return md;
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

Simulator.SCENARIOS = SIMULATION_SCENARIOS;

module.exports = Simulator;
