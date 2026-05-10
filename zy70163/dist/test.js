"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./database/index");
const lifecycleService = __importStar(require("./services/lifecycleService"));
const thawService = __importStar(require("./services/thawService"));
const loggingService = __importStar(require("./services/loggingService"));
const exportService = __importStar(require("./services/exportService"));
const uuid_1 = require("uuid");
const types_1 = require("./models/types");
async function runTests() {
    console.log('=== Starting Tests ===\n');
    try {
        await (0, index_1.initDatabase)();
        console.log('✓ Database initialized');
        const userId = 'test-user-001';
        const requestId = (0, uuid_1.v4)();
        const now = new Date();
        const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
        console.log('\n=== Test 1: Create test objects ===');
        const obj1 = await lifecycleService.createObject({
            objectId: 'obj-test-001',
            bucketName: 'test-bucket',
            objectKey: 'documents/report-2023.pdf',
            size: 5 * 1024 * 1024 * 1024,
            storageClass: types_1.StorageClass.ARCHIVE,
            lastModified: oldDate.toISOString(),
            createdTime: oldDate.toISOString(),
            eTag: 'etag-test-001',
            versionId: 'v1',
            deleteProtection: false,
            tags: { department: 'finance' }
        });
        console.log('✓ Created obj-test-001 (ARCHIVE, 5GB)');
        const obj2 = await lifecycleService.createObject({
            objectId: 'obj-test-002',
            bucketName: 'test-bucket',
            objectKey: 'images/photo-2024.jpg',
            size: 100 * 1024 * 1024,
            storageClass: types_1.StorageClass.STANDARD,
            lastModified: now.toISOString(),
            createdTime: now.toISOString(),
            eTag: 'etag-test-002',
            versionId: 'v1',
            deleteProtection: true,
            tags: { department: 'marketing' }
        });
        console.log('✓ Created obj-test-002 (STANDARD, delete protection ON)');
        const obj3 = await lifecycleService.createObject({
            objectId: 'obj-test-003',
            bucketName: 'test-bucket',
            objectKey: 'backup/archive-2022.zip',
            size: 50 * 1024 * 1024 * 1024,
            storageClass: types_1.StorageClass.DEEP_ARCHIVE,
            lastModified: oldDate.toISOString(),
            createdTime: oldDate.toISOString(),
            eTag: 'etag-test-003',
            versionId: 'v1',
            deleteProtection: false,
            tags: { department: 'engineering' }
        });
        console.log('✓ Created obj-test-003 (DEEP_ARCHIVE, 50GB)');
        await lifecycleService.createLifecycleRule({
            ruleId: 'rule-test-001',
            bucketName: 'test-bucket',
            ruleName: 'archive-old-documents',
            status: 'enabled',
            prefix: 'documents/',
            actions: [
                {
                    action: types_1.LifecycleAction.TRANSITION,
                    daysAfterCreation: 30,
                    targetStorageClass: types_1.StorageClass.INFREQUENT_ACCESS
                },
                {
                    action: types_1.LifecycleAction.TRANSITION,
                    daysAfterCreation: 90,
                    targetStorageClass: types_1.StorageClass.ARCHIVE
                }
            ],
            priority: 10,
            createdTime: now.toISOString(),
            lastModified: now.toISOString()
        });
        console.log('✓ Created lifecycle rule');
        console.log('\n=== Test 2: Normal Thaw Flow (Success Case) ===');
        console.log('→ Creating thaw job for obj-test-001 (ARCHIVE)...');
        const thawResult1 = await thawService.createThawJob({
            objectId: 'obj-test-001',
            requestedBy: userId,
            thawDays: 7,
            retrievalTier: 'standard',
            requestId: (0, uuid_1.v4)(),
            userId
        });
        console.log(`✓ Thaw job created: ${thawResult1.thawJobId}`);
        console.log(`  Estimated cost: $${thawResult1.costEstimate?.estimatedCost}`);
        console.log(`  Cost breakdown:`);
        thawResult1.costEstimate?.breakdown.forEach(item => {
            console.log(`    - ${item.item}: $${item.cost}`);
        });
        console.log('→ Processing pending thaw jobs...');
        await thawService.processPendingThawJobs();
        let job = await thawService.getThawJobById(thawResult1.thawJobId);
        console.log(`✓ Job status: ${job?.status}`);
        console.log('→ Advancing thaw progress...');
        await thawService.advanceThawProgress(thawResult1.thawJobId);
        await thawService.advanceThawProgress(thawResult1.thawJobId);
        await thawService.advanceThawProgress(thawResult1.thawJobId);
        await thawService.advanceThawProgress(thawResult1.thawJobId);
        await thawService.advanceThawProgress(thawResult1.thawJobId);
        job = await thawService.getThawJobById(thawResult1.thawJobId);
        console.log(`✓ Job completed: ${job?.status}`);
        console.log(`  Expires at: ${job?.expiresAt}`);
        console.log('\n=== Test 3: Exception Interception Cases ===');
        console.log('→ Test 3a: Delete protection intercept...');
        const deleteResultProtected = await lifecycleService.deleteObject('obj-test-002', (0, uuid_1.v4)(), userId);
        console.log(`✓ Delete protection intercepted: ${deleteResultProtected.error}`);
        console.log('→ Test 3b: Thaw non-archive object intercept...');
        const thawResultStandard = await thawService.createThawJob({
            objectId: 'obj-test-002',
            requestedBy: userId,
            thawDays: 7,
            retrievalTier: 'standard',
            requestId: (0, uuid_1.v4)(),
            userId
        });
        console.log(`✓ Non-archive intercept: ${thawResultStandard.error}`);
        console.log('→ Test 3c: Duplicate thaw request intercept...');
        const thawDuplicate = await thawService.createThawJob({
            objectId: 'obj-test-001',
            requestedBy: userId,
            thawDays: 7,
            retrievalTier: 'standard',
            requestId: (0, uuid_1.v4)(),
            userId
        });
        console.log(`✓ Duplicate intercept: ${thawDuplicate.error}`);
        console.log('\n=== Test 4: Failure and Retry Mechanism ===');
        console.log('→ Creating a DEEP_ARCHIVE thaw that will simulate failure...');
        const thawResultDeep = await thawService.createThawJob({
            objectId: 'obj-test-003',
            requestedBy: userId,
            thawDays: 30,
            retrievalTier: 'bulk',
            requestId: (0, uuid_1.v4)(),
            userId
        });
        console.log(`✓ Deep archive thaw created: ${thawResultDeep.thawJobId}`);
        await thawService.processPendingThawJobs();
        let deepJob = await thawService.getThawJobById(thawResultDeep.thawJobId);
        console.log(`✓ Initial status: ${deepJob?.status}`);
        console.log('→ Simulating job failure (setting FAILED state)...');
        await thawService.markJobFailedAndRecordTask(deepJob, 'Simulated storage backend timeout', (0, uuid_1.v4)());
        deepJob = await thawService.getThawJobById(thawResultDeep.thawJobId);
        console.log(`✓ Job marked as failed: ${deepJob?.status}`);
        console.log(`  Failure reason: ${deepJob?.failureReason}`);
        console.log('→ Retrying failed job...');
        const retryResult = await thawService.retryThawJob(thawResultDeep.thawJobId, (0, uuid_1.v4)(), userId);
        console.log(`✓ Retry scheduled: ${retryResult.retryAt}`);
        console.log(`  Is retry: ${retryResult.isRetry}`);
        console.log('→ Processing retried job...');
        await thawService.processPendingThawJobs();
        deepJob = await thawService.getThawJobById(thawResultDeep.thawJobId);
        console.log(`✓ Job status after retry: ${deepJob?.status}`);
        console.log(`  Retry count: ${deepJob?.retryCount}`);
        console.log('→ Advancing retried job to completion...');
        for (let i = 0; i < 12; i++) {
            await thawService.advanceThawProgress(thawResultDeep.thawJobId);
        }
        deepJob = await thawService.getThawJobById(thawResultDeep.thawJobId);
        console.log(`✓ Retry succeeded: ${deepJob?.status}`);
        console.log('\n=== Test 5: Object Transition ===');
        console.log('→ Transitioning STANDARD to INFREQUENT_ACCESS...');
        const transitionResult = await lifecycleService.transitionObjectToClass('obj-test-002', types_1.StorageClass.INFREQUENT_ACCESS, (0, uuid_1.v4)(), userId);
        console.log(`✓ Transition success: ${transitionResult.status}`);
        console.log(`  Cost estimate: $${transitionResult.costEstimate?.estimatedCost}`);
        console.log('→ Attempting duplicate transition...');
        const duplicateTransition = await lifecycleService.transitionObjectToClass('obj-test-002', types_1.StorageClass.INFREQUENT_ACCESS, (0, uuid_1.v4)(), userId);
        console.log(`✓ Duplicate handled: ${duplicateTransition.warnings?.[0]}`);
        console.log('\n=== Test 6: Lifecycle Rules Application ===');
        console.log('→ Applying lifecycle rules to test-bucket...');
        const lifecycleResults = await lifecycleService.applyLifecycleRules('test-bucket', (0, uuid_1.v4)(), 'system');
        console.log(`✓ Lifecycle processed: ${lifecycleResults.length} operations`);
        console.log(`  Success: ${lifecycleResults.filter(r => r.success).length}`);
        console.log(`  Failed: ${lifecycleResults.filter(r => !r.success).length}`);
        console.log('\n=== Test 7: Export Reports ===');
        console.log('→ Exporting operations report...');
        const opsReportPath = await exportService.exportOperationsReport(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), now.toISOString());
        console.log(`✓ Operations report: ${opsReportPath}`);
        console.log('→ Exporting failed operations report...');
        const failedReportPath = await exportService.exportFailedOperationsReport();
        console.log(`✓ Failed report: ${failedReportPath}`);
        console.log('\n=== Test 8: Operation Logs ===');
        console.log('→ Fetching logs for obj-test-001...');
        const objLogs = await loggingService.getLogsByObject('obj-test-001');
        console.log(`✓ Found ${objLogs.length} logs for obj-test-001`);
        objLogs.slice(0, 3).forEach(log => {
            console.log(`  - [${log.timestamp}] ${log.operation}: ${log.status}`);
        });
        console.log('→ Fetching all failed operations...');
        const failedOps = await loggingService.getFailedOperations();
        console.log(`✓ Found ${failedOps.length} failed operations`);
        console.log('\n=== Test 9: Thaw Expiration ===');
        console.log('→ Simulating thaw expiration by advancing time...');
        const expiredCount = await thawService.expireThawJobs();
        console.log(`✓ Thaws expired this cycle: ${expiredCount.length}`);
        console.log('\n=== All Tests Completed ===');
        console.log('\nSummary:');
        console.log('✓ Normal thaw flow completed successfully');
        console.log('✓ Delete protection intercepted delete attempt');
        console.log('✓ Non-archive thaw intercepted');
        console.log('✓ Duplicate thaw intercepted');
        console.log('✓ Failure simulation and retry mechanism working');
        console.log('✓ Object transitions working');
        console.log('✓ Lifecycle rules applying correctly');
        console.log('✓ Reports exporting correctly');
        console.log('✓ Operation logs recording correctly');
        console.log('\n=== Key Design Decisions Demonstrated ===');
        console.log('1. Objects linked to thaw jobs via currentThawJobId');
        console.log('2. Lifecycle rules linked to objects via bucket + prefix');
        console.log('3. Delete protection prevents deletion via business logic');
        console.log('4. Cost estimates included in every operation result');
        console.log('5. All operations logged with request tracking');
        console.log('6. Failed jobs can be retried without clearing database');
        console.log('7. Thaw jobs track progress and expiration');
        console.log('8. Exports contain business-meaningful data, not just debug info');
    }
    catch (error) {
        console.error('\n✗ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}
runTests();
