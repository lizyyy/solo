"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationEngine = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
class ReconciliationEngine {
    createDiscrepancy(type, description, severity, relatedRecordIds, sourceEvidence) {
        return {
            id: (0, uuid_1.v4)(),
            type,
            description,
            severity,
            relatedRecordIds,
            sourceEvidence,
        };
    }
    createAuditLog(reconciliationId, action, operator, previousValue, newValue, reason) {
        return {
            id: (0, uuid_1.v4)(),
            reconciliationId,
            action,
            previousValue,
            newValue,
            operator,
            timestamp: new Date(),
            reason,
        };
    }
    normalizePhone(phone) {
        return phone.replace(/\D/g, '');
    }
    isSamePerson(name1, phone1, name2, phone2) {
        const normalizedPhone1 = this.normalizePhone(phone1);
        const normalizedPhone2 = this.normalizePhone(phone2);
        return normalizedPhone1 === normalizedPhone2 ||
            (name1 === name2 && normalizedPhone1.slice(-4) === normalizedPhone2.slice(-4));
    }
    findDuplicates(registrations) {
        const duplicates = new Map();
        for (let i = 0; i < registrations.length; i++) {
            for (let j = i + 1; j < registrations.length; j++) {
                if (this.isSamePerson(registrations[i].name, registrations[i].phone, registrations[j].name, registrations[j].phone)) {
                    const key = registrations[i].id < registrations[j].id
                        ? `${registrations[i].id}-${registrations[j].id}`
                        : `${registrations[j].id}-${registrations[i].id}`;
                    if (!duplicates.has(key)) {
                        duplicates.set(key, [registrations[i], registrations[j]]);
                    }
                }
            }
        }
        return duplicates;
    }
    checkBlacklist(name, phone, blacklist) {
        return blacklist.find(b => this.isSamePerson(b.name, b.phone, name, phone)) || null;
    }
    findWaitlistPromotions(registration, waitlist) {
        return waitlist.find(w => this.isSamePerson(w.name, w.phone, registration.name, registration.phone) &&
            w.promotedToMain) || null;
    }
    processReconciliation(batchName, activityType, activityName, registrations, waitlist, checkIns, blacklist, operator) {
        const batchId = (0, uuid_1.v4)();
        const reconciliationRecords = [];
        const processedPhones = new Set();
        const allRecords = new Map();
        registrations.forEach(reg => {
            const key = this.normalizePhone(reg.phone);
            if (!allRecords.has(key)) {
                allRecords.set(key, {});
            }
            const existing = allRecords.get(key);
            if (!existing.registration || reg.registrationTime < existing.registration.registrationTime) {
                existing.registration = reg;
            }
            processedPhones.add(key);
        });
        waitlist.forEach(w => {
            const key = this.normalizePhone(w.phone);
            if (!allRecords.has(key)) {
                allRecords.set(key, {});
            }
            allRecords.get(key).waitlist = w;
            processedPhones.add(key);
        });
        checkIns.forEach(c => {
            const key = this.normalizePhone(c.phone);
            if (!allRecords.has(key)) {
                allRecords.set(key, {});
            }
            allRecords.get(key).checkIn = c;
            processedPhones.add(key);
        });
        const duplicates = this.findDuplicates(registrations);
        const duplicatePhoneMap = new Map();
        duplicates.forEach((regs) => {
            regs.forEach(r => {
                const key = this.normalizePhone(r.phone);
                if (!duplicatePhoneMap.has(key)) {
                    duplicatePhoneMap.set(key, []);
                }
                duplicatePhoneMap.get(key).push(r);
            });
        });
        for (const [phone, records] of allRecords.entries()) {
            const discrepancies = [];
            const { registration, waitlist: waitlistRecord, checkIn } = records;
            const primaryName = registration?.name || waitlistRecord?.name || checkIn?.name || '未知';
            const primaryPhone = registration?.phone || waitlistRecord?.phone || checkIn?.phone || phone;
            if (duplicatePhoneMap.has(phone)) {
                const dupRecords = duplicatePhoneMap.get(phone);
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.DUPLICATE_REGISTRATION, `检测到重复报名：该用户共有 ${dupRecords.length} 条报名记录`, 'high', dupRecords.map(r => r.id), dupRecords.map(r => ({
                    source: types_1.DataSource.REGISTRATION_CSV,
                    field: 'phone',
                    actualValue: r.phone,
                }))));
            }
            const blacklistRecord = this.checkBlacklist(primaryName, primaryPhone, blacklist);
            if (blacklistRecord) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.BLACKLISTED, `该用户在黑名单中：${blacklistRecord.reason}`, 'high', [blacklistRecord.id], [{
                        source: types_1.DataSource.BLACKLIST_JSON,
                        field: 'reason',
                        actualValue: blacklistRecord.reason,
                    }]));
            }
            if (registration && waitlistRecord?.promotedToMain) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.WAITLIST_PROMOTED, `该用户从候补第 ${waitlistRecord.waitlistPosition} 位递补至正式名单`, 'medium', [registration.id, waitlistRecord.id], [
                    { source: types_1.DataSource.WAITLIST_JSON, field: 'waitlistPosition', actualValue: String(waitlistRecord.waitlistPosition) },
                    { source: types_1.DataSource.WAITLIST_JSON, field: 'promotedToMain', actualValue: 'true' },
                ]));
            }
            if (registration?.status === types_1.RegistrationStatus.CANCELLED && checkIn?.status === types_1.CheckInStatus.CHECKED_IN) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.CANCELLED_BUT_CHECKED_IN, '该用户已取消报名但实际签到，需要人工复核', 'high', [registration.id, checkIn.id], [
                    { source: types_1.DataSource.REGISTRATION_CSV, field: 'status', expectedValue: types_1.RegistrationStatus.CANCELLED, actualValue: types_1.RegistrationStatus.CANCELLED },
                    { source: types_1.DataSource.CHECKIN_CSV, field: 'status', expectedValue: types_1.CheckInStatus.NOT_CHECKED_IN, actualValue: types_1.CheckInStatus.CHECKED_IN },
                ]));
            }
            if (!registration && checkIn?.status === types_1.CheckInStatus.CHECKED_IN) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.NOT_REGISTERED_BUT_CHECKED_IN, '该用户无报名记录但实际签到，需要人工确认', 'high', [checkIn.id], [
                    { source: types_1.DataSource.CHECKIN_CSV, field: 'status', actualValue: types_1.CheckInStatus.CHECKED_IN },
                ]));
            }
            if (registration && registration.status !== types_1.RegistrationStatus.CANCELLED && !checkIn) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.REGISTERED_BUT_NOT_CHECKED_IN, '该用户已报名但无签到记录', 'low', [registration.id], [
                    { source: types_1.DataSource.REGISTRATION_CSV, field: 'status', actualValue: registration.status },
                ]));
            }
            if (registration && waitlistRecord && registration.activityName !== waitlistRecord.activityName) {
                discrepancies.push(this.createDiscrepancy(types_1.DiscrepancyType.INFO_MISMATCH, `报名活动与候补活动名称不一致：报名"${registration.activityName}" vs 候补"${waitlistRecord.activityName}"`, 'medium', [registration.id, waitlistRecord.id], [
                    { source: types_1.DataSource.REGISTRATION_CSV, field: 'activityName', expectedValue: waitlistRecord.activityName, actualValue: registration.activityName },
                ]));
            }
            const hasHighSeverity = discrepancies.some(d => d.severity === 'high');
            const hasMediumSeverity = discrepancies.some(d => d.severity === 'medium');
            const record = {
                id: (0, uuid_1.v4)(),
                reconciliationBatchId: batchId,
                activityType,
                activityName: registration?.activityName || waitlistRecord?.activityName || checkIn?.activityName || activityName,
                name: primaryName,
                phone: primaryPhone,
                idCard: registration?.idCard || waitlistRecord?.idCard,
                registrationId: registration?.id,
                waitlistId: waitlistRecord?.id,
                checkInId: checkIn?.id,
                registrationStatus: registration?.status,
                checkInStatus: checkIn?.status || types_1.CheckInStatus.NOT_CHECKED_IN,
                reviewStatus: hasHighSeverity ? types_1.ReviewStatus.PENDING_REVIEW :
                    hasMediumSeverity ? types_1.ReviewStatus.PENDING_REVIEW : types_1.ReviewStatus.APPROVED,
                discrepancies,
                finalStatus: hasHighSeverity ? 'pending' :
                    hasMediumSeverity ? 'pending' : 'allowed',
                auditTrail: [
                    this.createAuditLog('', 'auto_reconciliation', 'system', undefined, { discrepancies: discrepancies.length }, '系统自动比对完成')
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            record.auditTrail[0].reconciliationId = record.id;
            reconciliationRecords.push(record);
        }
        const pendingReview = reconciliationRecords.filter(r => r.reviewStatus === types_1.ReviewStatus.PENDING_REVIEW).length;
        const approved = reconciliationRecords.filter(r => r.reviewStatus === types_1.ReviewStatus.APPROVED).length;
        const recordsWithDiscrepancies = reconciliationRecords.filter(r => r.discrepancies.length > 0).length;
        const batch = {
            id: batchId,
            name: batchName,
            activityType,
            activityName,
            createdAt: new Date(),
            createdBy: operator,
            status: 'ready_for_review',
            statistics: {
                totalRegistrations: registrations.length,
                totalWaitlist: waitlist.length,
                totalCheckIns: checkIns.length,
                matchedRecords: reconciliationRecords.length,
                discrepancies: recordsWithDiscrepancies,
                pendingReview,
                approved,
                rejected: 0,
            },
            recordIds: reconciliationRecords.map(r => r.id),
        };
        return { batch, records: reconciliationRecords };
    }
    recalculateStatistics(batch, records) {
        const pendingReview = records.filter(r => r.reviewStatus === types_1.ReviewStatus.PENDING_REVIEW).length;
        const approved = records.filter(r => r.reviewStatus === types_1.ReviewStatus.APPROVED).length;
        const rejected = records.filter(r => r.reviewStatus === types_1.ReviewStatus.REJECTED).length;
        const recordsWithDiscrepancies = records.filter(r => r.discrepancies.length > 0).length;
        return {
            ...batch,
            statistics: {
                ...batch.statistics,
                matchedRecords: records.length,
                discrepancies: recordsWithDiscrepancies,
                pendingReview,
                approved,
                rejected,
            },
            recordIds: records.map(r => r.id),
        };
    }
}
exports.ReconciliationEngine = ReconciliationEngine;
