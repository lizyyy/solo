const fs = require('fs');
const path = require('path');
const os = require('os');

const Workspace = require('../src/modules/workspace');
const LeaseManager = require('../src/modules/lease-manager');

describe('LeaseManager', () => {
    let tempDir;
    let testWorkspacePath;
    let ws;
    let leaseManager;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-guard-test-'));
        testWorkspacePath = path.join(tempDir, 'test-workspace');
        fs.mkdirSync(testWorkspacePath, { recursive: true });

        ws = new Workspace(testWorkspacePath);
        ws.init();
        leaseManager = new LeaseManager(ws);
    });

    afterEach(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Acquire Lease', () => {
        it('should acquire a lease for a file', () => {
            const result = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            expect(result.success).toBe(true);
            expect(result.lease).toBeDefined();
            expect(result.lease.id).toBeDefined();
            expect(result.lease.relativePath).toBe('docs/test.md');
            expect(result.lease.author).toBe('user1');
            expect(result.lease.status).toBe('active');
        });

        it('should reject lease when file is already locked', () => {
            leaseManager.acquireLease('docs/test.md', 'user1', 300);

            const result = leaseManager.acquireLease('docs/test.md', 'user2', 300);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('file_locked');
            expect(result.lease).toBeDefined();
            expect(result.lease.author).toBe('user1');
        });

        it('should reject when same user tries to acquire twice', () => {
            leaseManager.acquireLease('docs/test.md', 'user1', 300);

            const result = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            expect(result.success).toBe(false);
            expect(result.reason).toBe('you_already_hold_lease');
        });

        it('should verify expected revision when provided', () => {
            ws.createRevision('docs/test.md', 'content v1', 'author');
            const revision = ws.getFileRevision('docs/test.md');

            const result = leaseManager.acquireLease(
                'docs/test.md',
                'user1',
                300,
                revision.id
            );

            expect(result.success).toBe(true);
            expect(result.lease.expectedRevisionId).toBe(revision.id);
        });

        it('should reject when expected revision does not match', () => {
            ws.createRevision('docs/test.md', 'content v1', 'author');
            const oldRevision = ws.getFileRevision('docs/test.md');

            ws.createRevision('docs/test.md', 'content v2', 'author');

            const result = leaseManager.acquireLease(
                'docs/test.md',
                'user1',
                300,
                oldRevision.id
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('version_mismatch');
        });

        it('should use default duration from workspace config', () => {
            const result = leaseManager.acquireLease('docs/test.md', 'user1');

            expect(result.success).toBe(true);
            expect(result.lease.durationSeconds).toBe(300);
        });

        it('should reject when duration exceeds max', () => {
            expect(() => {
                leaseManager.acquireLease('docs/test.md', 'user1', 7200);
            }).toThrow('exceeds maximum');
        });

        it('should include current revision in result', () => {
            ws.createRevision('docs/test.md', 'content', 'author');

            const result = leaseManager.acquireLease('docs/test.md', 'user1');

            expect(result.currentRevision).toBeDefined();
            expect(result.currentRevision.relativePath).toBe('docs/test.md');
        });
    });

    describe('Verify Lease', () => {
        it('should verify active lease', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            const verifyResult = leaseManager.verifyLease(acquireResult.lease.id);

            expect(verifyResult.valid).toBe(true);
            expect(verifyResult.lease).toBeDefined();
        });

        it('should reject non-existent lease', () => {
            const result = leaseManager.verifyLease('non-existent-id');

            expect(result.valid).toBe(false);
            expect(result.reason).toBe('lease_not_found');
        });

        it('should verify lease belongs to correct file', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            const validForSameFile = leaseManager.verifyLease(
                acquireResult.lease.id,
                'docs/test.md'
            );
            const validForDifferentFile = leaseManager.verifyLease(
                acquireResult.lease.id,
                'docs/other.md'
            );

            expect(validForSameFile.valid).toBe(true);
            expect(validForDifferentFile.valid).toBe(false);
            expect(validForDifferentFile.reason).toBe('wrong_file');
        });

        it('should detect released lease', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);
            leaseManager.releaseLease(acquireResult.lease.id, 'user1');

            const verifyResult = leaseManager.verifyLease(acquireResult.lease.id);

            expect(verifyResult.valid).toBe(false);
            expect(verifyResult.reason).toBe('lease_released');
        });
    });

    describe('Release Lease', () => {
        it('should release an active lease', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            const releaseResult = leaseManager.releaseLease(acquireResult.lease.id, 'user1');

            expect(releaseResult.success).toBe(true);
            expect(releaseResult.lease.status).toBe('released');
            expect(releaseResult.lease.releasedAt).toBeDefined();
        });

        it('should validate author when releasing', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            expect(() => {
                leaseManager.releaseLease(acquireResult.lease.id, 'user2');
            }).toThrow('Only the lease holder');
        });

        it('should allow release without author validation when not provided', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            const releaseResult = leaseManager.releaseLease(acquireResult.lease.id);

            expect(releaseResult.success).toBe(true);
        });

        it('should throw for non-existent lease', () => {
            expect(() => {
                leaseManager.releaseLease('non-existent-id');
            }).toThrow('not found');
        });

        it('should allow acquiring after release', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);
            leaseManager.releaseLease(acquireResult.lease.id, 'user1');

            const newAcquireResult = leaseManager.acquireLease('docs/test.md', 'user2', 300);

            expect(newAcquireResult.success).toBe(true);
            expect(newAcquireResult.lease.author).toBe('user2');
        });
    });

    describe('Renew Lease', () => {
        it('should renew an active lease', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            const renewResult = leaseManager.renewLease(acquireResult.lease.id, 600);

            expect(renewResult.success).toBe(true);
            expect(renewResult.lease.expiresAt).not.toBe(acquireResult.lease.expiresAt);
            expect(renewResult.lease.durationSeconds).toBe(600);
        });

        it('should track renewal history', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            leaseManager.renewLease(acquireResult.lease.id, 300);
            leaseManager.renewLease(acquireResult.lease.id, 300);

            const lease = leaseManager.getLease(acquireResult.lease.id);
            expect(lease.renewedAt).toBeDefined();
            expect(lease.renewedAt.length).toBe(2);
        });

        it('should reject renew for released lease', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);
            leaseManager.releaseLease(acquireResult.lease.id, 'user1');

            expect(() => {
                leaseManager.renewLease(acquireResult.lease.id);
            }).toThrow('Cannot renew lease');
        });

        it('should use default duration on renew', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 100);

            const renewResult = leaseManager.renewLease(acquireResult.lease.id);

            expect(renewResult.lease.durationSeconds).toBe(300);
        });

        it('should reject when renew duration exceeds max', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            expect(() => {
                leaseManager.renewLease(acquireResult.lease.id, 7200);
            }).toThrow('exceeds maximum');
        });
    });

    describe('List Leases', () => {
        it('should list active leases', () => {
            leaseManager.acquireLease('docs/a.md', 'user1', 300);
            leaseManager.acquireLease('docs/b.md', 'user2', 300);

            const activeLeases = leaseManager.getActiveLeases();

            expect(activeLeases.length).toBe(2);
        });

        it('should filter active leases by file', () => {
            leaseManager.acquireLease('docs/a.md', 'user1', 300);
            leaseManager.acquireLease('docs/b.md', 'user2', 300);

            const leasesForA = leaseManager.getActiveLeases('docs/a.md');
            const leasesForB = leaseManager.getActiveLeases('docs/b.md');

            expect(leasesForA.length).toBe(1);
            expect(leasesForA[0].relativePath).toBe('docs/a.md');
            expect(leasesForB.length).toBe(1);
            expect(leasesForB[0].relativePath).toBe('docs/b.md');
        });

        it('should get all leases including expired/released', () => {
            const result1 = leaseManager.acquireLease('docs/a.md', 'user1', 300);
            const result2 = leaseManager.acquireLease('docs/b.md', 'user2', 300);
            leaseManager.releaseLease(result2.lease.id);

            const allLeases = leaseManager.getAllLeases();

            expect(allLeases.length).toBe(2);
        });

        it('should return empty array for no leases', () => {
            const activeLeases = leaseManager.getActiveLeases();

            expect(activeLeases).toEqual([]);
        });
    });

    describe('Get Lease', () => {
        it('should get lease by id', () => {
            const acquireResult = leaseManager.acquireLease('docs/test.md', 'user1', 300);

            const lease = leaseManager.getLease(acquireResult.lease.id);

            expect(lease).toBeDefined();
            expect(lease.id).toBe(acquireResult.lease.id);
        });

        it('should return null for non-existent lease', () => {
            const lease = leaseManager.getLease('non-existent-id');

            expect(lease).toBeNull();
        });
    });

    describe('Expired Leases', () => {
        it('should mark expired leases during cleanup', async () => {
            const result = leaseManager.acquireLease('docs/test.md', 'user1', 1);

            await new Promise(resolve => setTimeout(resolve, 1100));

            const verifyResult = leaseManager.verifyLease(result.lease.id);

            expect(verifyResult.valid).toBe(false);
            expect(verifyResult.reason).toBe('lease_expired');
        });

        it('should allow new lease after previous expires', async () => {
            leaseManager.acquireLease('docs/test.md', 'user1', 1);

            await new Promise(resolve => setTimeout(resolve, 1100));

            const newResult = leaseManager.acquireLease('docs/test.md', 'user2', 300);

            expect(newResult.success).toBe(true);
            expect(newResult.lease.author).toBe('user2');
        });
    });

    describe('Audit Logging', () => {
        it('should log lease acquisition', () => {
            leaseManager.acquireLease('docs/test.md', 'user1', 300);

            const logs = ws.getAuditLog(null, null, 'lease_acquired');

            expect(logs.length).toBe(1);
            expect(logs[0].details.lease.relativePath).toBe('docs/test.md');
        });

        it('should log lease release', () => {
            const result = leaseManager.acquireLease('docs/test.md', 'user1', 300);
            leaseManager.releaseLease(result.lease.id);

            const logs = ws.getAuditLog(null, null, 'lease_released');

            expect(logs.length).toBe(1);
        });

        it('should log lease renewal', () => {
            const result = leaseManager.acquireLease('docs/test.md', 'user1', 300);
            leaseManager.renewLease(result.lease.id);

            const logs = ws.getAuditLog(null, null, 'lease_renewed');

            expect(logs.length).toBe(1);
        });

        it('should log lease expiration', async () => {
            leaseManager.acquireLease('docs/test.md', 'user1', 1);

            await new Promise(resolve => setTimeout(resolve, 1100));

            leaseManager.getActiveLeases();

            const logs = ws.getAuditLog(null, null, 'lease_expired');

            expect(logs.length).toBe(1);
        });
    });
});
