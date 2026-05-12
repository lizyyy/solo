"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATABASE_VERSION = exports.ENTITY_MAP = void 0;
exports.createEmptyDatabase = createEmptyDatabase;
exports.ENTITY_MAP = {
    contract: "contracts",
    milestone: "milestones",
    deliveryProof: "deliveryProofs",
    acceptanceForm: "acceptanceForms",
    invoice: "invoices",
    paymentRecord: "paymentRecords",
};
exports.DATABASE_VERSION = "1.0.0";
function createEmptyDatabase() {
    const now = new Date().toISOString();
    return {
        contracts: [],
        milestones: [],
        deliveryProofs: [],
        acceptanceForms: [],
        invoices: [],
        paymentRecords: [],
        operations: [],
        issues: [],
        initializedAt: now,
        lastUpdatedAt: now,
        version: exports.DATABASE_VERSION,
    };
}
//# sourceMappingURL=schemas.js.map