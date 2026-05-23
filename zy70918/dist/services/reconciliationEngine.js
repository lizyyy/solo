"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconciliationEngine = void 0;
const uuid_1 = require("uuid");
const dataStore_1 = __importDefault(require("../store/dataStore"));
const discrepancyExplainer_1 = __importDefault(require("./discrepancyExplainer"));
class ReconciliationEngine {
    runReconciliation(batchId, orders, schedules, elders) {
        const records = [];
        const elderMap = new Map(elders.map(e => [e.id, e]));
        const scheduleMap = this.buildScheduleMap(schedules);
        for (const order of orders) {
            const record = this.reconcileOrder(batchId, order, scheduleMap, elderMap);
            records.push(record);
        }
        this.detectDuplicateOrders(records);
        dataStore_1.default.saveReconciliationRecords(records);
        dataStore_1.default.updateBatchStats(batchId);
        return records;
    }
    buildScheduleMap(schedules) {
        const map = new Map();
        for (const schedule of schedules) {
            if (!map.has(schedule.date)) {
                map.set(schedule.date, new Map());
            }
            map.get(schedule.date).set(schedule.nurseId, schedule);
        }
        return map;
    }
    reconcileOrder(batchId, order, scheduleMap, elderMap) {
        const discrepancies = [];
        const elder = elderMap.get(order.elderId);
        const daySchedules = scheduleMap.get(order.serviceDate);
        let matchedSchedule;
        let matchedTimeSlot;
        if (!elder) {
            throw new Error(`老人档案不存在: ${order.elderId}`);
        }
        if (daySchedules) {
            matchedSchedule = daySchedules.get(order.nurseId);
            if (matchedSchedule) {
                matchedTimeSlot = this.findMatchingTimeSlot(order, matchedSchedule);
            }
        }
        if (!matchedSchedule || !matchedTimeSlot) {
            if (order.status === 'cancelled') {
                discrepancies.push(discrepancyExplainer_1.default.explainCancelledWithoutNotice(order));
            }
            else {
                discrepancies.push(discrepancyExplainer_1.default.explainMissingRecord(order));
            }
        }
        else {
            discrepancies.push(...this.checkTimeMatch(order, matchedTimeSlot));
            discrepancies.push(...this.checkNurseMatch(order, matchedSchedule, matchedTimeSlot));
            discrepancies.push(...this.checkSkillMatch(order, matchedSchedule, elder));
            discrepancies.push(...this.checkServiceMatch(order, elder));
            discrepancies.push(...this.checkRegionMatch(order, matchedSchedule, elder));
        }
        const status = discrepancies.length === 0 ? 'matched' : 'discrepancy';
        return {
            id: (0, uuid_1.v4)(),
            batchId,
            serviceOrderId: order.id,
            serviceOrder: order,
            matchedSchedule,
            matchedTimeSlot,
            elderProfile: elder,
            status,
            discrepancies,
            auditLogs: [{
                    id: (0, uuid_1.v4)(),
                    timestamp: new Date(),
                    operator: 'system',
                    action: '自动对账完成',
                    remark: `发现 ${discrepancies.length} 处差异`,
                }],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    findMatchingTimeSlot(order, schedule) {
        return schedule.timeSlots.find(slot => {
            if (!slot.elderId)
                return false;
            if (slot.elderId !== order.elderId)
                return false;
            const orderHour = parseInt(order.serviceTime.split(':')[0], 10);
            const slotStart = parseInt(slot.start.split(':')[0], 10);
            const slotEnd = parseInt(slot.end.split(':')[0], 10);
            return orderHour >= slotStart && orderHour <= slotEnd;
        });
    }
    checkTimeMatch(order, slot) {
        const discrepancies = [];
        const orderHour = parseInt(order.serviceTime.split(':')[0], 10);
        const slotStart = parseInt(slot.start.split(':')[0], 10);
        const slotEnd = parseInt(slot.end.split(':')[0], 10);
        if (orderHour < slotStart || orderHour > slotEnd) {
            discrepancies.push(discrepancyExplainer_1.default.explainTimeMismatch(order, slot));
        }
        return discrepancies;
    }
    checkNurseMatch(order, schedule, slot) {
        const discrepancies = [];
        if (slot.substituteNurseId && slot.substituteNurseId !== schedule.nurseId) {
            if (order.nurseId === slot.substituteNurseId) {
                return [];
            }
            discrepancies.push(discrepancyExplainer_1.default.explainNurseMismatch(order, slot.substituteNurseId, slot.substituteNurseName || '补位护士'));
        }
        return discrepancies;
    }
    checkSkillMatch(order, schedule, elder) {
        const discrepancies = [];
        const requiredSkills = this.getRequiredSkills(order.serviceItems);
        if (requiredSkills.length > 0) {
            const hasAllSkills = requiredSkills.every(s => schedule.skills.includes(s));
            if (!hasAllSkills) {
                discrepancies.push(discrepancyExplainer_1.default.explainSkillMismatch(order, schedule.skills, requiredSkills));
            }
        }
        return discrepancies;
    }
    getRequiredSkills(serviceItems) {
        const skillMapping = {
            '压疮护理': ['伤口护理', '无菌操作'],
            '鼻饲': ['鼻饲护理'],
            '导尿': ['导尿护理'],
            '造口护理': ['造口护理'],
            '输液': ['静脉输液'],
            '打针': ['肌肉注射'],
            '康复训练': ['康复护理'],
            '临终关怀': ['临终关怀'],
        };
        const skills = [];
        for (const item of serviceItems) {
            const itemSkills = skillMapping[item] || [];
            for (const skill of itemSkills) {
                if (!skills.includes(skill)) {
                    skills.push(skill);
                }
            }
        }
        return skills;
    }
    checkServiceMatch(order, elder) {
        const discrepancies = [];
        const unauthorized = order.serviceItems.filter(s => !elder.serviceItems.includes(s));
        if (unauthorized.length > 0) {
            discrepancies.push(discrepancyExplainer_1.default.explainServiceMismatch(order, elder.serviceItems));
        }
        return discrepancies;
    }
    checkRegionMatch(order, schedule, elder) {
        const discrepancies = [];
        if (schedule.district && elder.district && schedule.district !== elder.district) {
            discrepancies.push(discrepancyExplainer_1.default.explainCrossRegion(order, schedule.district, elder.district));
        }
        return discrepancies;
    }
    detectDuplicateOrders(records) {
        const groupMap = new Map();
        for (const record of records) {
            const key = `${record.serviceOrder.elderId}-${record.serviceOrder.serviceDate}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
            }
            groupMap.get(key).push(record);
        }
        for (const [, group] of groupMap) {
            if (group.length > 1) {
                for (const record of group) {
                    record.discrepancies.push(discrepancyExplainer_1.default.explainDuplicateOrder(record.serviceOrder, group.length));
                    record.status = 'discrepancy';
                }
            }
        }
    }
}
exports.ReconciliationEngine = ReconciliationEngine;
exports.default = new ReconciliationEngine();
