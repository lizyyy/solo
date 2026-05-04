const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Workspace = require('./workspace');
const LeaseManager = require('./lease-manager');
const MergeEngine = require('./merge-engine');

const WRITE_RESULT = {
    SUCCESS: 'success',
    LEASE_EXPIRED: 'lease_expired',
    VERSION_MISMATCH: 'version_mismatch',
    CONFLICT: 'conflict',
    MERGED: 'merged',
    REJECTED: 'rejected'
};

const CONFLICTS_DIR = 'conflicts';

class WriteCoordinator {
    constructor(workspace) {
        this.workspace = workspace;
        this.leaseManager = new LeaseManager(workspace);
        this.mergeEngine = new MergeEngine();
        this.conflictsPath = path.join(workspace.guardPath, CONFLICTS_DIR);
    }

    _ensureConflictsDir() {
        if (!fs.existsSync(this.conflictsPath)) {
            fs.mkdirSync(this.conflictsPath, { recursive: true });
        }
    }

    async attemptWrite(relativePath, newContent, author, options = {}) {
        const {
            leaseId = null,
            expectedRevisionId = null,
            skipLeaseCheck = false,
            autoMerge = true
        } = options;

        const now = new Date().toISOString();
        const currentRevision = this.workspace.getFileRevision(relativePath);
        const currentContent = currentRevision
            ? this.workspace._loadSnapshot(currentRevision.hash)
            : '';

        if (!skipLeaseCheck && leaseId) {
            const leaseVerification = this.leaseManager.verifyLease(leaseId, relativePath);
            if (!leaseVerification.valid) {
                this._logAudit('write_rejected', {
                    reason: 'lease_invalid',
                    leaseId,
                    relativePath,
                    author,
                    verification: leaseVerification
                });

                return {
                    result: WRITE_RESULT.LEASE_EXPIRED,
                    message: leaseVerification.message,
                    details: {
                        leaseCheck: leaseVerification,
                        currentRevision
                    }
                };
            }
        }

        if (expectedRevisionId && currentRevision) {
            if (expectedRevisionId !== currentRevision.id) {
                this._logAudit('write_rejected', {
                    reason: 'version_mismatch',
                    relativePath,
                    author,
                    expectedRevisionId,
                    actualRevisionId: currentRevision.id
                });

                return {
                    result: WRITE_RESULT.VERSION_MISMATCH,
                    message: 'Version mismatch: file has been modified since you acquired the lease',
                    details: {
                        expectedRevisionId,
                        actualRevisionId: currentRevision.id,
                        currentContent,
                        newContent
                    }
                };
            }
        }

        const newHash = this.workspace._computeHash(newContent);
        if (currentRevision && currentRevision.hash === newHash) {
            return {
                result: WRITE_RESULT.SUCCESS,
                message: 'Content unchanged, no write needed',
                revision: currentRevision,
                isNew: false
            };
        }

        if (!currentRevision) {
            const result = this.workspace.createRevision(
                relativePath,
                newContent,
                author,
                'Initial version'
            );

            this._logAudit('write_success', {
                relativePath,
                author,
                revisionId: result.revision.id,
                isNewFile: true
            });

            return {
                result: WRITE_RESULT.SUCCESS,
                message: 'Successfully written (new file)',
                revision: result.revision,
                isNew: true
            };
        }

        if (autoMerge && currentRevision) {
            const baseContent = currentContent;
            const theirsContent = newContent;
            const workingContent = this.workspace.getFileContent(relativePath);

            const mergeResult = this.mergeEngine.threeWayMerge(
                baseContent,
                theirsContent,
                workingContent,
                relativePath
            );

            if (mergeResult.status === MergeEngine.MERGE_STATUS.CLEAN ||
                mergeResult.status === MergeEngine.MERGE_STATUS.AUTO_MERGED) {
                const finalContent = mergeResult.result;
                const finalHash = this.workspace._computeHash(finalContent);

                if (finalHash === currentRevision.hash) {
                    return {
                        result: WRITE_RESULT.SUCCESS,
                        message: 'Merge resulted in no changes',
                        revision: currentRevision,
                        isNew: false
                    };
                }

                const result = this.workspace.createRevision(
                    relativePath,
                    finalContent,
                    author,
                    `Auto-merged: ${mergeResult.message}`
                );

                this._logAudit('write_merged', {
                    relativePath,
                    author,
                    revisionId: result.revision.id,
                    mergeType: mergeResult.status,
                    mergeDetails: mergeResult
                });

                return {
                    result: WRITE_RESULT.MERGED,
                    message: mergeResult.message,
                    revision: result.revision,
                    mergeResult: {
                        status: mergeResult.status,
                        details: mergeResult
                    },
                    finalContent
                };
            }

            if (mergeResult.status === MergeEngine.MERGE_STATUS.CONFLICT) {
                const conflict = this._createConflictFile(
                    relativePath,
                    baseContent,
                    theirsContent,
                    workingContent,
                    author,
                    mergeResult
                );

                this._logAudit('write_conflict', {
                    relativePath,
                    author,
                    conflictId: conflict.id,
                    conflicts: mergeResult.conflicts
                });

                return {
                    result: WRITE_RESULT.CONFLICT,
                    message: `Cannot auto-merge. Conflict created: ${conflict.filePath}`,
                    conflict,
                    mergeResult: {
                        status: mergeResult.status,
                        conflicts: mergeResult.conflicts,
                        requiresManualResolution: true
                    }
                };
            }
        }

        const result = this.workspace.createRevision(
            relativePath,
            newContent,
            author,
            'Direct write'
        );

        this._logAudit('write_success', {
            relativePath,
            author,
            revisionId: result.revision.id
        });

        return {
            result: WRITE_RESULT.SUCCESS,
            message: 'Successfully written',
            revision: result.revision,
            isNew: result.isNew
        };
    }

    _createConflictFile(relativePath, baseContent, theirsContent, oursContent, author, mergeResult) {
        this._ensureConflictsDir();

        const conflictId = uuidv4();
        const timestamp = new Date().toISOString();
        const safePath = relativePath.replace(/[\/\\]/g, '_');
        const conflictFileName = `${Date.now()}-${safePath}.json`;
        const conflictFilePath = path.join(this.conflictsPath, conflictFileName);

        const conflict = {
            id: conflictId,
            createdAt: timestamp,
            relativePath,
            author,
            status: 'pending',
            files: {
                base: {
                    hash: this.workspace._computeHash(baseContent),
                    content: baseContent
                },
                theirs: {
                    hash: this.workspace._computeHash(theirsContent),
                    content: theirsContent
                },
                ours: {
                    hash: this.workspace._computeHash(oursContent),
                    content: oursContent
                }
            },
            conflicts: mergeResult.conflicts,
            mergeResult: {
                status: mergeResult.status,
                message: mergeResult.message,
                result: mergeResult.result
            },
            humanReadable: this._generateConflictSummary(relativePath, mergeResult, baseContent, theirsContent, oursContent)
        };

        fs.writeFileSync(conflictFilePath, JSON.stringify(conflict, null, 2));

        return {
            id: conflictId,
            filePath: conflictFilePath,
            relativePath,
            status: 'pending',
            createdAt: timestamp
        };
    }

    _generateConflictSummary(relativePath, mergeResult, base, theirs, ours) {
        const fileType = this.mergeEngine.detectFileType(relativePath);
        let summary = `# Conflict Resolution: ${relativePath}\n\n`;
        summary += `Created: ${new Date().toISOString()}\n\n`;
        summary += `## Summary\n\n`;
        summary += `${mergeResult.message}\n\n`;

        if (mergeResult.conflicts && mergeResult.conflicts.length > 0) {
            summary += `### Conflicting Sections (${mergeResult.conflicts.length})\n\n`;

            mergeResult.conflicts.forEach((conflict, index) => {
                summary += `#### Conflict #${index + 1}: ${conflict.type}\n\n`;

                if (conflict.blockTitle) {
                    summary += `Section: ${conflict.blockTitle}\n\n`;
                }
                if (conflict.path) {
                    summary += `Path: ${conflict.path}\n\n`;
                }

                summary += `**BASE (Original):**\n`;
                if (conflict.baseContent) {
                    summary += `\`\`\`\n${conflict.baseContent}\n\`\`\`\n\n`;
                } else if (conflict.base !== undefined) {
                    summary += `\`${JSON.stringify(conflict.base)}\`\n\n`;
                }

                summary += `**THEIRS (Other changes):**\n`;
                if (conflict.theirsContent) {
                    summary += `\`\`\`\n${conflict.theirsContent}\n\`\`\`\n\n`;
                } else if (conflict.theirs !== undefined) {
                    summary += `\`${JSON.stringify(conflict.theirs)}\`\n\n`;
                }

                summary += `**OURS (Your changes):**\n`;
                if (conflict.oursContent) {
                    summary += `\`\`\`\n${conflict.oursContent}\n\`\`\`\n\n`;
                } else if (conflict.ours !== undefined) {
                    summary += `\`${JSON.stringify(conflict.ours)}\`\n\n`;
                }
            });
        }

        summary += `## How to Resolve\n\n`;
        summary += `1. Review the conflicting sections above\n`;
        summary += `2. Choose which version to keep, or create a merged version manually\n`;
        summary += `3. Use \`doc-guard conflict resolve <conflict-id> --choice theirs/ours/manual --content "<final content>"\`\n\n`;
        summary += `Or simply edit the working file and use \`doc-guard write\` with the resolved content.\n`;

        return summary;
    }

    getPendingConflicts(relativePath = null) {
        this._ensureConflictsDir();

        const conflictFiles = fs.readdirSync(this.conflictsPath)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();

        const conflicts = [];
        for (const file of conflictFiles) {
            try {
                const content = fs.readFileSync(path.join(this.conflictsPath, file), 'utf8');
                const conflict = JSON.parse(content);
                if (conflict.status === 'pending') {
                    if (relativePath && conflict.relativePath !== relativePath) {
                        continue;
                    }
                    conflicts.push({
                        id: conflict.id,
                        file: file,
                        relativePath: conflict.relativePath,
                        author: conflict.author,
                        createdAt: conflict.createdAt,
                        conflictCount: conflict.conflicts ? conflict.conflicts.length : 0
                    });
                }
            } catch (e) {
                // Skip invalid files
            }
        }

        return conflicts;
    }

    getConflict(conflictId) {
        this._ensureConflictsDir();

        const conflictFiles = fs.readdirSync(this.conflictsPath)
            .filter(f => f.endsWith('.json'));

        for (const file of conflictFiles) {
            try {
                const content = fs.readFileSync(path.join(this.conflictsPath, file), 'utf8');
                const conflict = JSON.parse(content);
                if (conflict.id === conflictId) {
                    return conflict;
                }
            } catch (e) {
                continue;
            }
        }

        return null;
    }

    resolveConflict(conflictId, resolution, author, resolvedContent = null) {
        const conflict = this.getConflict(conflictId);
        if (!conflict) {
            throw new Error(`Conflict not found: ${conflictId}`);
        }

        if (conflict.status !== 'pending') {
            throw new Error(`Conflict already resolved: ${conflict.status}`);
        }

        let finalContent;
        let resolutionMessage;

        switch (resolution) {
            case 'theirs':
                finalContent = conflict.files.theirs.content;
                resolutionMessage = 'Resolved: accepted theirs version';
                break;
            case 'ours':
                finalContent = conflict.files.ours.content;
                resolutionMessage = 'Resolved: accepted ours version';
                break;
            case 'manual':
                if (!resolvedContent) {
                    throw new Error('Must provide resolvedContent for manual resolution');
                }
                finalContent = resolvedContent;
                resolutionMessage = 'Resolved: manually merged';
                break;
            default:
                throw new Error(`Unknown resolution: ${resolution}. Use 'theirs', 'ours', or 'manual'`);
        }

        conflict.status = 'resolved';
        conflict.resolvedAt = new Date().toISOString();
        conflict.resolvedBy = author;
        conflict.resolution = resolution;
        conflict.resolvedContent = finalContent;

        const conflictFiles = fs.readdirSync(this.conflictsPath)
            .filter(f => f.endsWith('.json'));

        for (const file of conflictFiles) {
            const filePath = path.join(this.conflictsPath, file);
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const c = JSON.parse(content);
                if (c.id === conflictId) {
                    fs.writeFileSync(filePath, JSON.stringify(conflict, null, 2));
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        const writeResult = this.workspace.createRevision(
            conflict.relativePath,
            finalContent,
            author,
            resolutionMessage
        );

        this._logAudit('conflict_resolved', {
            conflictId,
            resolution,
            author,
            revisionId: writeResult.revision.id,
            relativePath: conflict.relativePath
        });

        return {
            success: true,
            conflict,
            revision: writeResult.revision,
            message: resolutionMessage,
            finalContent
        };
    }

    _logAudit(action, details) {
        this.workspace._logAudit({
            action,
            timestamp: new Date().toISOString(),
            details
        });
    }
}

WriteCoordinator.WRITE_RESULT = WRITE_RESULT;

module.exports = WriteCoordinator;
