const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const WORKSPACE_DIR = '.doc-guard';
const SNAPSHOTS_DIR = 'snapshots';
const REVISIONS_FILE = 'revisions.json';
const META_FILE = 'meta.json';
const LEASES_FILE = 'leases.json';
const AUDIT_LOG_FILE = 'audit.log';

class Workspace {
    constructor(rootPath) {
        this.rootPath = rootPath;
        this.guardPath = path.join(rootPath, WORKSPACE_DIR);
        this.snapshotsPath = path.join(this.guardPath, SNAPSHOTS_DIR);
        this.revisionsPath = path.join(this.guardPath, REVISIONS_FILE);
        this.metaPath = path.join(this.guardPath, META_FILE);
        this.leasesPath = path.join(this.guardPath, LEASES_FILE);
        this.auditLogPath = path.join(this.guardPath, AUDIT_LOG_FILE);
    }

    exists() {
        return fs.existsSync(this.guardPath);
    }

    init(options = {}) {
        if (this.exists()) {
            throw new Error('Workspace already initialized. Use --force to reinitialize.');
        }

        fs.mkdirSync(this.guardPath, { recursive: true });
        fs.mkdirSync(this.snapshotsPath, { recursive: true });

        const meta = {
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            version: '1.0.0',
            options: {
                defaultLeaseDuration: options.defaultLeaseDuration || 300,
                maxLeaseDuration: options.maxLeaseDuration || 3600,
                autoMergeEnabled: options.autoMergeEnabled !== false,
                conflictStrategy: options.conflictStrategy || 'manual'
            }
        };

        fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2));
        fs.writeFileSync(this.revisionsPath, JSON.stringify([], null, 2));
        fs.writeFileSync(this.leasesPath, JSON.stringify([], null, 2));
        fs.writeFileSync(this.auditLogPath, '');

        this._logAudit({
            action: 'workspace_init',
            timestamp: new Date().toISOString(),
            details: { meta }
        });

        return meta;
    }

    getMeta() {
        if (!this.exists()) {
            throw new Error('Workspace not initialized. Run `doc-guard init` first.');
        }
        return JSON.parse(fs.readFileSync(this.metaPath, 'utf8'));
    }

    _getRevisions() {
        if (!fs.existsSync(this.revisionsPath)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(this.revisionsPath, 'utf8'));
    }

    _saveRevisions(revisions) {
        fs.writeFileSync(this.revisionsPath, JSON.stringify(revisions, null, 2));
    }

    _computeHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    _snapshotExists(hash) {
        const snapshotPath = path.join(this.snapshotsPath, hash);
        return fs.existsSync(snapshotPath);
    }

    _saveSnapshot(hash, content) {
        const snapshotPath = path.join(this.snapshotsPath, hash);
        if (!fs.existsSync(snapshotPath)) {
            fs.writeFileSync(snapshotPath, content);
        }
    }

    _loadSnapshot(hash) {
        const snapshotPath = path.join(this.snapshotsPath, hash);
        if (!fs.existsSync(snapshotPath)) {
            throw new Error(`Snapshot not found: ${hash}`);
        }
        return fs.readFileSync(snapshotPath, 'utf8');
    }

    getFileRevision(relativePath) {
        const revisions = this._getRevisions();
        const fileRevisions = revisions.filter(r => r.relativePath === relativePath);
        return fileRevisions.length > 0 ? fileRevisions[fileRevisions.length - 1] : null;
    }

    getAllRevisions() {
        return this._getRevisions();
    }

    getRevision(revisionId) {
        const revisions = this._getRevisions();
        return revisions.find(r => r.id === revisionId);
    }

    createRevision(relativePath, content, author, message = '', parentRevisionId = null) {
        const hash = this._computeHash(content);
        const now = new Date().toISOString();

        const existingRevision = this.getFileRevision(relativePath);
        if (existingRevision && existingRevision.hash === hash) {
            return {
                isNew: false,
                revision: existingRevision,
                message: 'Content unchanged, no new revision created'
            };
        }

        const revision = {
            id: uuidv4(),
            relativePath,
            hash,
            author,
            timestamp: now,
            message,
            parentRevisionId: parentRevisionId || (existingRevision ? existingRevision.id : null),
            size: Buffer.byteLength(content, 'utf8')
        };

        this._saveSnapshot(hash, content);

        const revisions = this._getRevisions();
        revisions.push(revision);
        this._saveRevisions(revisions);

        this._logAudit({
            action: 'revision_create',
            timestamp: now,
            details: {
                revision,
                file: relativePath
            }
        });

        return {
            isNew: true,
            revision,
            message: 'New revision created successfully'
        };
    }

    getFileContent(relativePath, revisionId = null) {
        if (revisionId) {
            const revision = this.getRevision(revisionId);
            if (!revision) {
                throw new Error(`Revision not found: ${revisionId}`);
            }
            if (revision.relativePath !== relativePath) {
                throw new Error(`Revision ${revisionId} does not belong to file ${relativePath}`);
            }
            return this._loadSnapshot(revision.hash);
        } else {
            const fullPath = path.join(this.rootPath, relativePath);
            if (!fs.existsSync(fullPath)) {
                return null;
            }
            return fs.readFileSync(fullPath, 'utf8');
        }
    }

    writeWorkingFile(relativePath, content) {
        const fullPath = path.join(this.rootPath, relativePath);
        const dirPath = path.dirname(fullPath);

        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(fullPath, content);

        this._logAudit({
            action: 'file_write',
            timestamp: new Date().toISOString(),
            details: {
                file: relativePath,
                size: Buffer.byteLength(content, 'utf8')
            }
        });
    }

    _logAudit(entry) {
        const logEntry = JSON.stringify(entry) + '\n';
        fs.appendFileSync(this.auditLogPath, logEntry);
    }

    getAuditLog(startTime = null, endTime = null, actionFilter = null) {
        if (!fs.existsSync(this.auditLogPath)) {
            return [];
        }

        const lines = fs.readFileSync(this.auditLogPath, 'utf8').split('\n').filter(line => line.trim());
        const logs = lines.map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return null;
            }
        }).filter(entry => entry !== null);

        return logs.filter(entry => {
            if (startTime && entry.timestamp < startTime) return false;
            if (endTime && entry.timestamp > endTime) return false;
            if (actionFilter && entry.action !== actionFilter) return false;
            return true;
        });
    }

    listTrackedFiles() {
        const revisions = this._getRevisions();
        const files = new Set();
        revisions.forEach(r => files.add(r.relativePath));
        return Array.from(files);
    }

    getFileHistory(relativePath) {
        const revisions = this._getRevisions();
        return revisions
            .filter(r => r.relativePath === relativePath)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
}

module.exports = Workspace;
