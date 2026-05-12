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
exports.ComplianceManager = void 0;
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
class ComplianceManager {
    constructor(services, exemptions = [], confirmations = []) {
        this.services = services;
        this.exemptions = exemptions;
        this.confirmations = confirmations;
    }
    addExemption(serviceName, path, method, field, reason, expiresInDays, createdBy) {
        const exemption = {
            id: (0, uuid_1.v4)(),
            serviceName,
            path,
            method: method.toLowerCase(),
            field,
            reason,
            expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
            createdBy,
            createdAt: new Date().toISOString()
        };
        this.exemptions.push(exemption);
        return exemption;
    }
    removeExemption(id) {
        const index = this.exemptions.findIndex(e => e.id === id);
        if (index !== -1) {
            this.exemptions.splice(index, 1);
            return true;
        }
        return false;
    }
    getExemptions() {
        return [...this.exemptions];
    }
    addConfirmation(diff, confirmedBy, notes) {
        const confirmation = {
            id: (0, uuid_1.v4)(),
            diffId: diff.id,
            serviceName: diff.serviceName,
            path: diff.path,
            method: diff.method,
            changeType: diff.changeType,
            field: diff.field,
            confirmedBy,
            confirmedAt: new Date().toISOString(),
            notes,
            changeHash: this.computeDiffHash(diff)
        };
        const existingIndex = this.confirmations.findIndex(c => c.serviceName === diff.serviceName &&
            c.path === diff.path &&
            c.method === diff.method &&
            c.changeType === diff.changeType &&
            c.field === diff.field);
        if (existingIndex !== -1) {
            const existing = this.confirmations[existingIndex];
            const newHash = this.computeDiffHash(diff);
            if (existing.changeHash !== newHash) {
                console.warn(`变更已更新，原确认可能失效: ${diff.serviceName} ${diff.method.toUpperCase()} ${diff.path}`);
            }
            this.confirmations[existingIndex] = confirmation;
        }
        else {
            this.confirmations.push(confirmation);
        }
        return confirmation;
    }
    removeConfirmation(diffId) {
        const index = this.confirmations.findIndex(c => c.diffId === diffId);
        if (index !== -1) {
            this.confirmations.splice(index, 1);
            return true;
        }
        return false;
    }
    getConfirmations() {
        return [...this.confirmations];
    }
    getConfirmationForDiff(diff) {
        return this.confirmations.find(c => c.serviceName === diff.serviceName &&
            c.path === diff.path &&
            c.method === diff.method &&
            c.changeType === diff.changeType &&
            c.field === diff.field);
    }
    isExempted(diff) {
        const now = new Date();
        return this.exemptions.some(ex => {
            if (new Date(ex.expiresAt) < now)
                return false;
            if (ex.serviceName !== diff.serviceName)
                return false;
            if (ex.path !== diff.path)
                return false;
            if (ex.method !== diff.method)
                return false;
            if (ex.changeType && ex.changeType !== diff.changeType)
                return false;
            if (ex.field && ex.field !== diff.field)
                return false;
            return true;
        });
    }
    isConfirmed(diff) {
        const confirmation = this.getConfirmationForDiff(diff);
        if (!confirmation)
            return false;
        const currentHash = this.computeDiffHash(diff);
        return confirmation.changeHash === currentHash;
    }
    applyFilters(diffs, options) {
        return diffs.filter(diff => {
            if (options.services && options.services.length > 0) {
                if (!options.services.includes(diff.serviceName))
                    return false;
            }
            if (options.paths && options.paths.length > 0) {
                if (!options.paths.some(p => diff.path.includes(p)))
                    return false;
            }
            if (options.methods && options.methods.length > 0) {
                if (!options.methods.includes(diff.method))
                    return false;
            }
            if (options.owners && options.owners.length > 0) {
                const service = this.services.find(s => s.serviceName === diff.serviceName);
                if (!service || !service.owners.some(o => options.owners.includes(o)))
                    return false;
            }
            if (options.severities && options.severities.length > 0) {
                if (!options.severities.includes(diff.severity))
                    return false;
            }
            if (options.impacts && options.impacts.length > 0) {
                if (!options.impacts.includes(diff.impact))
                    return false;
            }
            return true;
        });
    }
    filterByExemptionStatus(diffs, showExempted = false) {
        return diffs.filter(diff => {
            const exempted = this.isExempted(diff);
            return showExempted ? exempted : !exempted;
        });
    }
    filterByConfirmationStatus(diffs, showConfirmed = false) {
        return diffs.filter(diff => {
            const confirmed = this.isConfirmed(diff);
            return showConfirmed ? confirmed : !confirmed;
        });
    }
    getOwnersForService(serviceName) {
        const service = this.services.find(s => s.serviceName === serviceName);
        return service?.owners || [];
    }
    computeDiffHash(diff) {
        const data = {
            serviceName: diff.serviceName,
            path: diff.path,
            method: diff.method,
            changeType: diff.changeType,
            field: diff.field,
            oldValue: diff.oldValue,
            newValue: diff.newValue,
            affectedEnumValues: diff.affectedEnumValues,
            affectedResponseCodes: diff.affectedResponseCodes
        };
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }
}
exports.ComplianceManager = ComplianceManager;
//# sourceMappingURL=compliance-manager.js.map