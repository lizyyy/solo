const express = require('express');
const cors = require('cors');
const path = require('path');

const Workspace = require('./modules/workspace');
const LeaseManager = require('./modules/lease-manager');
const WriteCoordinator = require('./modules/write-coordinator');
const MergeEngine = require('./modules/merge-engine');
const AuditExporter = require('./modules/audit-exporter');
const Simulator = require('./modules/simulator');

const app = express();
const PORT = process.env.DOC_GUARD_PORT || 8765;
const WORKSPACE_PATH = process.cwd();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

function getWorkspace() {
    const ws = new Workspace(WORKSPACE_PATH);
    if (!ws.exists()) {
        return null;
    }
    return ws;
}

function sendError(res, message, status = 500, details = null) {
    res.status(status).json({
        success: false,
        error: message,
        details,
        timestamp: new Date().toISOString()
    });
}

function sendSuccess(res, data, message = 'Success') {
    res.json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
}

app.use((req, res, next) => {
    const ws = getWorkspace();
    if (!ws && req.path !== '/api/health' && req.path !== '/api/init') {
        return sendError(res, 'Workspace not initialized. Use POST /api/init to initialize.', 400);
    }
    req.workspace = ws;
    next();
});

app.get('/api/health', (req, res) => {
    const ws = getWorkspace();
    sendSuccess(res, {
        server: 'running',
        port: PORT,
        workspace: ws ? 'initialized' : 'not_initialized',
        workspacePath: WORKSPACE_PATH
    });
});

app.post('/api/init', (req, res) => {
    try {
        const {
            force = false,
            defaultLeaseDuration = 300,
            maxLeaseDuration = 3600,
            autoMergeEnabled = true
        } = req.body;

        const ws = new Workspace(WORKSPACE_PATH);

        if (ws.exists() && !force) {
            return sendError(res, 'Workspace already exists. Use force=true to reinitialize.', 400);
        }

        const meta = ws.init({
            defaultLeaseDuration,
            maxLeaseDuration,
            autoMergeEnabled
        });

        sendSuccess(res, { meta }, 'Workspace initialized successfully');
    } catch (error) {
        sendError(res, error.message, 500, { stack: error.stack });
    }
});

app.get('/api/status', (req, res) => {
    try {
        const ws = req.workspace;
        const meta = ws.getMeta();

        const leaseManager = new LeaseManager(ws);
        const activeLeases = leaseManager.getActiveLeases();

        const coordinator = new WriteCoordinator(ws);
        const pendingConflicts = coordinator.getPendingConflicts();

        const revisions = ws.getAllRevisions();
        const trackedFiles = ws.listTrackedFiles();

        sendSuccess(res, {
            workspace: {
                id: meta.id,
                createdAt: meta.createdAt,
                version: meta.version,
                options: meta.options
            },
            statistics: {
                trackedFiles: trackedFiles.length,
                totalRevisions: revisions.length,
                activeLeases: activeLeases.length,
                pendingConflicts: pendingConflicts.length
            },
            activeLeases,
            pendingConflicts: pendingConflicts.slice(0, 10)
        });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.get('/api/files', (req, res) => {
    try {
        const ws = req.workspace;
        const trackedFiles = ws.listTrackedFiles();
        const revisions = ws.getAllRevisions();

        const filesWithInfo = trackedFiles.map(file => {
            const fileRevisions = revisions.filter(r => r.relativePath === file);
            const lastRev = fileRevisions[fileRevisions.length - 1];
            return {
                path: file,
                revisionCount: fileRevisions.length,
                lastModified: lastRev?.timestamp,
                lastAuthor: lastRev?.author,
                lastRevisionId: lastRev?.id
            };
        });

        sendSuccess(res, { files: filesWithInfo });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.get('/api/files/:filePath(*)', (req, res) => {
    try {
        const ws = req.workspace;
        const { revisionId } = req.query;
        const content = ws.getFileContent(req.params.filePath, revisionId);

        if (content === null) {
            return sendError(res, 'File not found', 404);
        }

        const revision = ws.getFileRevision(req.params.filePath);

        sendSuccess(res, {
            path: req.params.filePath,
            content,
            revision: revision ? {
                id: revision.id,
                author: revision.author,
                timestamp: revision.timestamp,
                hash: revision.hash
            } : null
        });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.post('/api/files/:filePath(*)', async (req, res) => {
    try {
        const ws = req.workspace;
        const {
            content,
            author = 'api_user',
            message = '',
            leaseId,
            expectedRevisionId,
            autoMerge = true
        } = req.body;

        if (content === undefined) {
            return sendError(res, 'Content is required', 400);
        }

        const coordinator = new WriteCoordinator(ws);

        const result = await coordinator.attemptWrite(
            req.params.filePath,
            content,
            author,
            {
                leaseId,
                expectedRevisionId,
                autoMerge
            }
        );

        if (result.result === WriteCoordinator.WRITE_RESULT.CONFLICT) {
            return res.status(409).json({
                success: false,
                result: 'conflict',
                message: result.message,
                conflict: result.conflict,
                conflicts: result.mergeResult?.conflicts,
                timestamp: new Date().toISOString()
            });
        }

        if (result.result === WriteCoordinator.WRITE_RESULT.LEASE_EXPIRED ||
            result.result === WriteCoordinator.WRITE_RESULT.VERSION_MISMATCH) {
            return res.status(412).json({
                success: false,
                result: result.result,
                message: result.message,
                details: result.details,
                timestamp: new Date().toISOString()
            });
        }

        sendSuccess(res, {
            result: result.result,
            revision: result.revision,
            message: result.message,
            finalContent: result.finalContent,
            mergeResult: result.mergeResult
        });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.get('/api/files/:filePath(*)/history', (req, res) => {
    try {
        const ws = req.workspace;
        const { limit = 20 } = req.query;

        const history = ws.getFileHistory(req.params.filePath);

        sendSuccess(res, {
            path: req.params.filePath,
            totalRevisions: history.length,
            revisions: history.slice(0, parseInt(limit))
        });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.get('/api/leases', (req, res) => {
    try {
        const ws = req.workspace;
        const { active = 'true', file } = req.query;

        const leaseManager = new LeaseManager(ws);

        let leases;
        if (active === 'true') {
            leases = leaseManager.getActiveLeases(file);
        } else {
            leases = leaseManager.getAllLeases();
            if (file) {
                leases = leases.filter(l => l.relativePath === file);
            }
        }

        sendSuccess(res, { leases, count: leases.length });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.post('/api/leases', (req, res) => {
    try {
        const ws = req.workspace;
        const {
            file,
            author = 'api_user',
            duration,
            expectedRevisionId
        } = req.body;

        if (!file) {
            return sendError(res, 'File path is required', 400);
        }

        const leaseManager = new LeaseManager(ws);

        const result = leaseManager.acquireLease(
            file,
            author,
            duration ? parseInt(duration) : null,
            expectedRevisionId
        );

        if (!result.success) {
            return res.status(409).json({
                success: false,
                message: result.message,
                reason: result.reason,
                existingLease: result.lease,
                timestamp: new Date().toISOString()
            });
        }

        sendSuccess(res, {
            lease: result.lease,
            currentRevision: result.currentRevision
        }, 'Lease acquired successfully');
    } catch (error) {
        sendError(res, error.message);
    }
});

app.get('/api/leases/:leaseId', (req, res) => {
    try {
        const ws = req.workspace;
        const leaseManager = new LeaseManager(ws);

        const lease = leaseManager.getLease(req.params.leaseId);

        if (!lease) {
            return sendError(res, 'Lease not found', 404);
        }

        const verification = leaseManager.verifyLease(req.params.leaseId);

        sendSuccess(res, {
            lease,
            valid: verification.valid,
            verification: verification
        });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.post('/api/leases/:leaseId/release', (req, res) => {
    try {
        const ws = req.workspace;
        const { author } = req.body;
        const leaseManager = new LeaseManager(ws);

        const result = leaseManager.releaseLease(req.params.leaseId, author);

        sendSuccess(res, {
            lease: result.lease
        }, 'Lease released successfully');
    } catch (error) {
        sendError(res, error.message);
    }
});

app.post('/api/leases/:leaseId/renew', (req, res) => {
    try {
        const ws = req.workspace;
        const { duration } = req.body;
        const leaseManager = new LeaseManager(ws);

        const result = leaseManager.renewLease(
            req.params.leaseId,
            duration ? parseInt(duration) : null
        );

        sendSuccess(res, {
            lease: result.lease
        }, 'Lease renewed successfully');
    } catch (error) {
        sendError(res, error.message);
    }
});

app.get('/api/conflicts', (req, res) => {
    try {
        const ws = req.workspace;
        const { file } = req.query;

        const coordinator = new WriteCoordinator(ws);
        const conflicts = coordinator.getPendingConflicts(file);

        sendSuccess(res, { conflicts, count: conflicts.length });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.get('/api/conflicts/:conflictId', (req, res) => {
    try {
        const ws = req.workspace;
        const coordinator = new WriteCoordinator(ws);

        const conflict = coordinator.getConflict(req.params.conflictId);

        if (!conflict) {
            return sendError(res, 'Conflict not found', 404);
        }

        sendSuccess(res, { conflict });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.post('/api/conflicts/:conflictId/resolve', (req, res) => {
    try {
        const ws = req.workspace;
        const {
            choice,
            author = 'api_user',
            content,
            fromFile
        } = req.body;

        if (!['theirs', 'ours', 'manual'].includes(choice)) {
            return sendError(res, 'Choice must be one of: theirs, ours, manual', 400);
        }

        const coordinator = new WriteCoordinator(ws);

        let resolvedContent = null;
        if (choice === 'manual') {
            if (content) {
                resolvedContent = content;
            } else if (fromFile) {
                const fs = require('fs');
                const fullPath = path.resolve(WORKSPACE_PATH, fromFile);
                if (!fs.existsSync(fullPath)) {
                    return sendError(res, 'Source file not found', 404);
                }
                resolvedContent = fs.readFileSync(fullPath, 'utf8');
            } else {
                return sendError(res, 'Content or fromFile is required for manual resolution', 400);
            }
        }

        const result = coordinator.resolveConflict(
            req.params.conflictId,
            choice,
            author,
            resolvedContent
        );

        sendSuccess(res, {
            conflict: result.conflict,
            revision: result.revision,
            message: result.message
        }, 'Conflict resolved successfully');
    } catch (error) {
        sendError(res, error.message);
    }
});

app.post('/api/merge/test', (req, res) => {
    try {
        const {
            base,
            theirs,
            ours,
            filePath = 'test.md'
        } = req.body;

        if (base === undefined || theirs === undefined || ours === undefined) {
            return sendError(res, 'base, theirs, and ours are required', 400);
        }

        const mergeEngine = new MergeEngine();
        const result = mergeEngine.threeWayMerge(base, theirs, ours, filePath);

        sendSuccess(res, {
            result: result.status,
            mergedContent: result.result,
            message: result.message,
            conflicts: result.conflicts,
            requiresManualResolution: result.requiresManualResolution
        });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.get('/api/audit/log', (req, res) => {
    try {
        const ws = req.workspace;
        const { action, limit = 100, start, end } = req.query;

        const logs = ws.getAuditLog(start, end, action);
        const display = logs.slice(-parseInt(limit));

        sendSuccess(res, {
            logs: display,
            total: logs.length,
            returned: display.length
        });
    } catch (error) {
        sendError(res, error.message);
    }
});

app.get('/api/audit/export', (req, res) => {
    try {
        const ws = req.workspace;
        const {
            format = 'json',
            start,
            end,
            revisions = 'true',
            conflicts = 'true',
            leases = 'true'
        } = req.query;

        const exporter = new AuditExporter(ws);

        const result = exporter.export({
            format,
            startTime: start,
            endTime: end,
            includeRevisions: revisions === 'true',
            includeConflicts: conflicts === 'true',
            includeLeases: leases === 'true'
        });

        if (format === 'html') {
            res.set('Content-Type', 'text/html');
            res.send(result.content);
        } else if (format === 'md' || format === 'markdown') {
            res.set('Content-Type', 'text/markdown');
            res.send(result.content);
        } else {
            sendSuccess(res, JSON.parse(result.content));
        }
    } catch (error) {
        sendError(res, error.message);
    }
});

app.post('/api/simulate', async (req, res) => {
    try {
        const ws = req.workspace;
        const {
            scenario = 'mixed',
            workers = 3,
            iterations = 5,
            fileTypes = 'md,json',
            delay = 100,
            format = 'json'
        } = req.body;

        const validScenarios = Object.values(Simulator.SCENARIOS);
        if (!validScenarios.includes(scenario)) {
            return sendError(res, `Invalid scenario. Valid: ${validScenarios.join(', ')}`, 400);
        }

        const simulator = new Simulator(ws);

        const results = await simulator.runSimulation({
            scenario,
            workerCount: parseInt(workers),
            iterations: parseInt(iterations),
            fileTypes: fileTypes.split(',').map(t => t.trim()),
            delayMs: parseInt(delay)
        });

        if (format === 'md') {
            const report = simulator.generateSimulationReport(results, 'md');
            res.set('Content-Type', 'text/markdown');
            res.send(report);
        } else {
            sendSuccess(res, results, 'Simulation completed');
        }
    } catch (error) {
        sendError(res, error.message);
    }
});

app.use((err, req, res, next) => {
    console.error('API Error:', err);
    sendError(res, err.message || 'Internal Server Error', 500);
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     📋 Document Sync Guard - HTTP API Server                  ║
║                                                               ║
║     Listening on port ${PORT}                                      ║
║     Workspace: ${WORKSPACE_PATH.substring(0, 50)}${WORKSPACE_PATH.length > 50 ? '...' : ''}
║                                                               ║
║     API Endpoints:                                            ║
║       GET  /api/health           - Health check              ║
║       POST /api/init             - Initialize workspace       ║
║       GET  /api/status           - Get workspace status       ║
║       GET  /api/files            - List tracked files         ║
║       GET  /api/files/:path      - Get file content          ║
║       POST /api/files/:path      - Write file content        ║
║       GET  /api/leases           - List leases               ║
║       POST /api/leases           - Acquire lease             ║
║       GET  /api/conflicts        - List conflicts            ║
║       POST /api/conflicts/:id/resolve - Resolve conflict    ║
║       GET  /api/audit/log        - Get audit log             ║
║       GET  /api/audit/export     - Export audit report       ║
║       POST /api/simulate         - Run simulation            ║
║       POST /api/merge/test       - Test merge engine         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
    });
}

module.exports = app;
