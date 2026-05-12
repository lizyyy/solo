"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = void 0;
class InMemoryStorage {
    constructor() {
        this.members = new Map();
        this.benefits = new Map();
        this.ledgers = new Map();
        this.idempotentRecords = new Map();
    }
    saveMember(member) {
        this.members.set(member.memberId, member);
    }
    getMember(memberId) {
        return this.members.get(memberId);
    }
    getMemberByPhone(phone) {
        for (const member of this.members.values()) {
            if (member.phone === phone) {
                return member;
            }
        }
        return undefined;
    }
    saveBenefit(benefit) {
        this.benefits.set(benefit.benefitId, benefit);
    }
    getBenefit(benefitId) {
        return this.benefits.get(benefitId);
    }
    getBenefitsByMember(memberId) {
        const result = [];
        for (const benefit of this.benefits.values()) {
            if (benefit.memberId === memberId) {
                result.push(benefit);
            }
        }
        return result;
    }
    saveLedger(entry) {
        this.ledgers.set(entry.ledgerId, entry);
    }
    getLedger(ledgerId) {
        return this.ledgers.get(ledgerId);
    }
    getLedgersByBenefit(benefitId) {
        const result = [];
        for (const ledger of this.ledgers.values()) {
            if (ledger.benefitId === benefitId) {
                result.push(ledger);
            }
        }
        return result.sort((a, b) => a.createdAt - b.createdAt);
    }
    getLedgersByMember(memberId) {
        const result = [];
        for (const ledger of this.ledgers.values()) {
            if (ledger.memberId === memberId) {
                result.push(ledger);
            }
        }
        return result.sort((a, b) => a.createdAt - b.createdAt);
    }
    saveIdempotentRecord(record) {
        this.idempotentRecords.set(record.requestId, record);
    }
    getIdempotentRecord(requestId) {
        return this.idempotentRecords.get(requestId);
    }
    clearAll() {
        this.members.clear();
        this.benefits.clear();
        this.ledgers.clear();
        this.idempotentRecords.clear();
    }
    getAllMembers() {
        return Array.from(this.members.values());
    }
    getAllBenefits() {
        return Array.from(this.benefits.values());
    }
    getAllLedgers() {
        return Array.from(this.ledgers.values());
    }
}
exports.storage = new InMemoryStorage();
//# sourceMappingURL=index.js.map