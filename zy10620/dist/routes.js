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
const express_1 = require("express");
const service = __importStar(require("./service"));
const store_1 = require("./store");
const errors_1 = require("./errors");
const router = (0, express_1.Router)();
router.post('/leases', (req, res) => {
    try {
        const { createdBy, ...leaseData } = req.body;
        const lease = service.createLeaseService({
            ...leaseData,
            createdBy
        });
        res.status(201).json(lease);
    }
    catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/leases', (req, res) => {
    const leases = store_1.store.listLeases();
    res.json(leases);
});
router.get('/leases/:id', (req, res) => {
    const lease = store_1.store.getLease(req.params.id);
    if (!lease) {
        const error = service.errors.leaseNotFound(req.params.id);
        return res.status((0, errors_1.getHttpStatus)(error.category)).json(error);
    }
    res.json(lease);
});
router.get('/leases/:id/history', (req, res) => {
    const lease = store_1.store.getLease(req.params.id);
    if (!lease) {
        const error = service.errors.leaseNotFound(req.params.id);
        return res.status((0, errors_1.getHttpStatus)(error.category)).json(error);
    }
    const history = store_1.store.getHistory(req.params.id);
    res.json(history);
});
router.patch('/leases/:id/status', (req, res) => {
    const { status, actor } = req.body;
    const result = service.transitionStatusService(req.params.id, status, actor || 'api');
    if (!result.success) {
        if (result.error) {
            return res.status((0, errors_1.getHttpStatus)(result.error.category)).json(result.error);
        }
        return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.lease);
});
router.post('/leases/:id/auto-renewal', (req, res) => {
    const { actor } = req.body;
    const result = service.submitAutoRenewalService(req.params.id, actor || 'api');
    if (!result.success) {
        if (result.error) {
            return res.status((0, errors_1.getHttpStatus)(result.error.category)).json(result.error);
        }
        return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.lease);
});
router.post('/leases/:id/manual-renewal', (req, res) => {
    const { renewalData, actor } = req.body;
    const result = service.submitManualRenewalService(req.params.id, renewalData, actor || 'api');
    if (!result.success) {
        if (result.error) {
            return res.status((0, errors_1.getHttpStatus)(result.error.category)).json(result.error);
        }
        return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.lease);
});
router.post('/leases/:id/remarks', (req, res) => {
    const { content, conflictId, actor } = req.body;
    if (!content) {
        const error = service.errors.missingRequiredField('content');
        return res.status((0, errors_1.getHttpStatus)(error.category)).json(error);
    }
    const result = service.addRemarkService(req.params.id, content, actor || 'api', conflictId);
    if (!result.success) {
        if (result.error) {
            return res.status((0, errors_1.getHttpStatus)(result.error.category)).json(result.error);
        }
        return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.lease);
});
router.patch('/leases/:id/conflicts/:conflictId/resolve', (req, res) => {
    const { resolution, actor } = req.body;
    if (!resolution) {
        const error = service.errors.missingRequiredField('resolution');
        return res.status((0, errors_1.getHttpStatus)(error.category)).json(error);
    }
    const result = service.resolveConflictService(req.params.id, req.params.conflictId, resolution, actor || 'api');
    if (!result.success) {
        if (result.error) {
            return res.status((0, errors_1.getHttpStatus)(result.error.category)).json(result.error);
        }
        return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.lease);
});
router.post('/leases/import', (req, res) => {
    const { rows, actor } = req.body;
    if (!Array.isArray(rows)) {
        const error = service.errors.missingRequiredField('rows');
        return res.status((0, errors_1.getHttpStatus)(error.category)).json(error);
    }
    const result = service.importLeasesService(rows, actor || 'api');
    res.json({
        leases: result.leases,
        badRows: result.badRows
    });
});
router.post('/leases/:id/confirm-renewal', (req, res) => {
    const { actor } = req.body;
    const result = service.confirmRenewalService(req.params.id, actor || 'api');
    if (!result.success) {
        if (result.error) {
            return res.status((0, errors_1.getHttpStatus)(result.error.category)).json(result.error);
        }
        return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.lease);
});
router.get('/leases/:id/export', (req, res) => {
    const lease = store_1.store.getLease(req.params.id);
    if (!lease) {
        const error = service.errors.leaseNotFound(req.params.id);
        return res.status((0, errors_1.getHttpStatus)(error.category)).json(error);
    }
    const history = store_1.store.getHistory(req.params.id);
    store_1.store.addHistory(req.params.id, {
        actionType: 'exported',
        actor: 'api',
        description: '导出租赁记录',
        details: { format: 'json' }
    });
    const exportData = {
        lease: {
            id: lease.id,
            leaseNo: lease.leaseNo,
            status: lease.status,
            createdAt: lease.createdAt,
            updatedAt: lease.updatedAt
        },
        customer: lease.customer,
        asset: lease.asset,
        renewalRule: lease.renewalRule,
        summary: {
            totalConflicts: lease.conflicts.length,
            unresolvedConflicts: lease.conflicts.filter(c => c.status !== 'resolved').length,
            totalRemarks: lease.remarks.length,
            totalRenewalRecords: lease.renewalRecords.length
        },
        conflicts: lease.conflicts,
        renewalRecords: lease.renewalRecords,
        remarks: lease.remarks,
        history: history,
        importBadRows: lease.importBadRows || []
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="lease-${lease.id}.json"`);
    res.json(exportData);
});
exports.default = router;
