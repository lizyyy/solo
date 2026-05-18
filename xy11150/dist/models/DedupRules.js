"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dedupEngine = exports.DedupRuleEngine = void 0;
class DedupRuleEngine {
    generateEmployeeIdKey(record) {
        if (!record.employeeId || record.employeeId.trim() === '') {
            return null;
        }
        return {
            type: 'employeeId',
            value: record.employeeId.trim().toUpperCase()
        };
    }
    generatePhoneKey(record) {
        const phone = this.normalizePhone(record.phone);
        if (!phone) {
            return null;
        }
        return {
            type: 'phone',
            value: phone
        };
    }
    generateNameAndPhoneKey(record) {
        const phone = this.normalizePhone(record.phone);
        const name = record.employeeName?.trim();
        if (!phone || !name) {
            return null;
        }
        return {
            type: 'nameAndPhone',
            value: `${name}:${phone}`
        };
    }
    generateAllKeys(record) {
        const keys = [];
        const employeeIdKey = this.generateEmployeeIdKey(record);
        const phoneKey = this.generatePhoneKey(record);
        const nameAndPhoneKey = this.generateNameAndPhoneKey(record);
        if (employeeIdKey)
            keys.push(employeeIdKey);
        if (phoneKey)
            keys.push(phoneKey);
        if (nameAndPhoneKey)
            keys.push(nameAndPhoneKey);
        return keys;
    }
    normalizePhone(phone) {
        if (!phone)
            return '';
        return phone.replace(/[\s\-\(\)\+]/g, '').replace(/^86/, '').replace(/^\+86/, '');
    }
    isSameRoute(r1, r2) {
        const r1Route = r1.routeName?.trim().toLowerCase();
        const r2Route = r2.routeName?.trim().toLowerCase();
        return r1Route === r2Route;
    }
    isSameBoardingPoint(r1, r2) {
        const r1Point = r1.boardingPoint?.trim().toLowerCase();
        const r2Point = r2.boardingPoint?.trim().toLowerCase();
        return r1Point === r2Point;
    }
    detectTransfer(r1, r2) {
        if (!this.isSameEmployee(r1, r2)) {
            return false;
        }
        return !this.isSameRoute(r1, r2) || !this.isSameBoardingPoint(r1, r2);
    }
    isSameEmployee(r1, r2) {
        if (r1.employeeId && r2.employeeId && r1.employeeId.trim() === r2.employeeId.trim()) {
            return true;
        }
        const p1 = this.normalizePhone(r1.phone);
        const p2 = this.normalizePhone(r2.phone);
        if (p1 && p2 && p1 === p2 && r1.employeeName?.trim() === r2.employeeName?.trim()) {
            return true;
        }
        return false;
    }
    selectBestRecord(records) {
        const scored = records.map((r, index) => ({
            record: r,
            score: this.calculateRecordScore(r),
            index
        }));
        scored.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.index - b.index;
        });
        return scored[0].record;
    }
    calculateRecordScore(r) {
        let score = 0;
        if (r.employeeId?.trim())
            score += 30;
        if (r.employeeName?.trim())
            score += 20;
        if (this.normalizePhone(r.phone))
            score += 20;
        if (r.routeName?.trim())
            score += 15;
        if (r.boardingPoint?.trim())
            score += 10;
        if (r.registrationDate?.trim())
            score += 5;
        return score;
    }
    groupByKey(records) {
        const groups = new Map();
        for (const record of records) {
            const keys = this.generateAllKeys(record);
            for (const key of keys) {
                const keyStr = `${key.type}:${key.value}`;
                if (!groups.has(keyStr)) {
                    groups.set(keyStr, []);
                }
                groups.get(keyStr).push(record);
            }
        }
        return groups;
    }
}
exports.DedupRuleEngine = DedupRuleEngine;
exports.dedupEngine = new DedupRuleEngine();
//# sourceMappingURL=DedupRules.js.map