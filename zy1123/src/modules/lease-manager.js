const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Workspace = require('./workspace');

class LeaseManager {
    constructor(workspace) {
        this.workspace = workspace;
        this.leasesPath = workspace.leasesPath;
    }

    _getLeases() {
        if (!fs.existsSync(this.leasesPath)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(this.leasesPath, 'utf8'));
    }

    _saveLeases(leases) {
        fs.writeFileSync(this.leasesPath, JSON.stringify(leases, null, 2));
    }

    _cleanupExpired() {
        const leases = this._getLeases();
        const now = Date.now();
        const activeLeases = leases.filter(lease => {
            const expiresAt = new Date(lease.expiresAt).getTime();
            if (expiresAt < now && lease.status === 'active') {
                lease.status = 'expired';
                this.workspace._logAudit({
                    action: 'lease_expired',
                    timestamp: new Date().toISOString(),
                    details: { lease }
                });
            }
            return true;
        });
        this._saveLeases(activeLeases);
        return activeLeases;
    }

    acquireLease(relativePath, author, durationSeconds = null, expectedRevisionId = null) {
        this._cleanupExpired();

        const meta = this.workspace.getMeta();
        const duration = durationSeconds || meta.options.defaultLeaseDuration;
        const maxDuration = meta.options.maxLeaseDuration;

        if (duration > maxDuration) {
            throw new Error(`Lease duration ${duration}s exceeds maximum ${maxDuration}s`);
        }

        const leases = this._getLeases();
        const now = Date.now();
        const expiresAt = new Date(now + duration * 1000).toISOString();

        const existingActiveLease = leases.find(lease =>
            lease.relativePath === relativePath &&
            lease.status === 'active'
        );

        if (existingActiveLease) {
            if (existingActiveLease.author === author) {
                return {
                    success: false,
                    lease: existingActiveLease,
                    reason: 'you_already_hold_lease',
                    message: `You already hold an active lease for this file. Use --force to renew.`
                };
            }

            return {
                success: false,
                lease: existingActiveLease,
                reason: 'file_locked',
                message: `File is locked by ${existingActiveLease.author} until ${existingActiveLease.expiresAt}`
            };
        }

        const currentRevision = this.workspace.getFileRevision(relativePath);

        if (expectedRevisionId && currentRevision && currentRevision.id !== expectedRevisionId) {
            return {
                success: false,
                reason: 'version_mismatch',
                message: `Expected revision mismatch. Current: ${currentRevision.id}, Expected: ${expectedRevisionId}`,
                currentRevision: currentRevision,
                expectedRevisionId: expectedRevisionId
            };
        }

        const lease = {
            id: uuidv4(),
            relativePath,
            author,
            createdAt: new Date(now).toISOString(),
            expiresAt,
            durationSeconds: duration,
            status: 'active',
            expectedRevisionId: expectedRevisionId || (currentRevision ? currentRevision.id : null)
        };

        leases.push(lease);
        this._saveLeases(leases);

        this.workspace._logAudit({
            action: 'lease_acquired',
            timestamp: new Date(now).toISOString(),
            details: { lease }
        });

        return {
            success: true,
            lease,
            currentRevision,
            message: `Lease acquired successfully. Expires at ${expiresAt}`
        };
    }

    verifyLease(leaseId, relativePath = null) {
        this._cleanupExpired();

        const leases = this._getLeases();
        const lease = leases.find(l => l.id === leaseId);

        if (!lease) {
            return {
                valid: false,
                reason: 'lease_not_found',
                message: `Lease ${leaseId} not found`
            };
        }

        if (relativePath && lease.relativePath !== relativePath) {
            return {
                valid: false,
                reason: 'wrong_file',
                message: `Lease ${leaseId} is for file ${lease.relativePath}, not ${relativePath}`
            };
        }

        const now = Date.now();
        const expiresAt = new Date(lease.expiresAt).getTime();

        if (lease.status === 'expired' || expiresAt < now) {
            return {
                valid: false,
                reason: 'lease_expired',
                message: `Lease ${leaseId} expired at ${lease.expiresAt}`,
                lease
            };
        }

        if (lease.status === 'released') {
            return {
                valid: false,
                reason: 'lease_released',
                message: `Lease ${leaseId} has been released`,
                lease
            };
        }

        return {
            valid: true,
            lease,
            message: 'Lease is valid'
        };
    }

    releaseLease(leaseId, author = null) {
        this._cleanupExpired();

        const leases = this._getLeases();
        const leaseIndex = leases.findIndex(l => l.id === leaseId);

        if (leaseIndex === -1) {
            throw new Error(`Lease ${leaseId} not found`);
        }

        const lease = leases[leaseIndex];

        if (author && lease.author !== author) {
            throw new Error(`Only the lease holder (${lease.author}) can release this lease`);
        }

        if (lease.status === 'active') {
            lease.status = 'released';
            lease.releasedAt = new Date().toISOString();
            this._saveLeases(leases);

            this.workspace._logAudit({
                action: 'lease_released',
                timestamp: new Date().toISOString(),
                details: { lease }
            });
        }

        return {
            success: true,
            lease,
            message: 'Lease released successfully'
        };
    }

    renewLease(leaseId, durationSeconds = null) {
        this._cleanupExpired();

        const leases = this._getLeases();
        const leaseIndex = leases.findIndex(l => l.id === leaseId);

        if (leaseIndex === -1) {
            throw new Error(`Lease ${leaseId} not found`);
        }

        const lease = leases[leaseIndex];

        if (lease.status !== 'active') {
            throw new Error(`Cannot renew lease. Current status: ${lease.status}`);
        }

        const meta = this.workspace.getMeta();
        const duration = durationSeconds || meta.options.defaultLeaseDuration;
        const maxDuration = meta.options.maxLeaseDuration;

        if (duration > maxDuration) {
            throw new Error(`Lease duration ${duration}s exceeds maximum ${maxDuration}s`);
        }

        const now = Date.now();
        const newExpiresAt = new Date(now + duration * 1000).toISOString();

        lease.expiresAt = newExpiresAt;
        lease.durationSeconds = duration;
        lease.renewedAt = lease.renewedAt || [];
        lease.renewedAt.push(new Date(now).toISOString());

        this._saveLeases(leases);

        this.workspace._logAudit({
            action: 'lease_renewed',
            timestamp: new Date(now).toISOString(),
            details: {
                leaseId,
                newExpiresAt
            }
        });

        return {
            success: true,
            lease,
            message: `Lease renewed. New expiration: ${newExpiresAt}`
        };
    }

    getActiveLeases(relativePath = null) {
        this._cleanupExpired();

        const leases = this._getLeases();
        let active = leases.filter(l => l.status === 'active');

        if (relativePath) {
            active = active.filter(l => l.relativePath === relativePath);
        }

        return active;
    }

    getLease(leaseId) {
        this._cleanupExpired();

        const leases = this._getLeases();
        const lease = leases.find(l => l.id === leaseId);
        return lease === undefined ? null : lease;
    }

    getAllLeases() {
        this._cleanupExpired();
        return this._getLeases();
    }
}

module.exports = LeaseManager;
