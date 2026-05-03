const RuleEngine = (function() {
    'use strict';
    
    const ISSUE_TYPES = {
        OVER_CAPACITY: 'over_capacity',
        SUPPLY_SHORTAGE: 'supply_shortage',
        DUPLICATE_REGISTRATION: 'duplicate_registration',
        MIDNIGHT_STATISTICS: 'midnight_statistics',
        SPECIAL_CARE_NEEDED: 'special_care_needed'
    };
    
    const SEVERITY = {
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low'
    };
    
    function checkOverCapacity(shelters, evacuees, supplyRules) {
        const issues = [];
        const shelterOccupancy = {};
        
        evacuees.forEach(evacuee => {
            const shelterId = evacuee.shelter_id;
            if (!shelterOccupancy[shelterId]) {
                shelterOccupancy[shelterId] = [];
            }
            shelterOccupancy[shelterId].push(evacuee);
        });
        
        shelters.forEach(shelter => {
            const occupancy = shelterOccupancy[shelter.id] || [];
            const capacity = shelter.capacity || 0;
            
            if (occupancy.length > capacity) {
                issues.push({
                    id: `over_capacity_${shelter.id}`,
                    type: ISSUE_TYPES.OVER_CAPACITY,
                    severity: SEVERITY.HIGH,
                    title: '床位超配',
                    description: `避难点"${shelter.name}"床位超配。容量: ${capacity}, 实际人数: ${occupancy.length}`,
                    shelterId: shelter.id,
                    shelterName: shelter.name,
                    capacity: capacity,
                    actualCount: occupancy.length,
                    overage: occupancy.length - capacity,
                    affectedEvacuees: occupancy.slice(capacity).map(e => ({
                        id: e.id,
                        name: e.name
                    })),
                    timestamp: getLatestArrivalTime(occupancy),
                    status: 'detected'
                });
            }
        });
        
        return issues;
    }
    
    function checkSupplyShortage(shelters, evacuees, supplyRules) {
        const issues = [];
        
        if (!supplyRules || !supplyRules.rules || !supplyRules.supply_types) {
            return issues;
        }
        
        const shelterEvacuees = {};
        evacuees.forEach(evacuee => {
            const shelterId = evacuee.shelter_id;
            if (!shelterEvacuees[shelterId]) {
                shelterEvacuees[shelterId] = [];
            }
            shelterEvacuees[shelterId].push(evacuee);
        });
        
        const shelterSupplyStatus = {};
        shelters.forEach(shelter => {
            shelterSupplyStatus[shelter.id] = {
                shelter: shelter,
                supplies: {}
            };
            
            supplyRules.supply_types.forEach(supplyType => {
                shelterSupplyStatus[shelter.id].supplies[supplyType.id] = {
                    type: supplyType,
                    required: 0,
                    allocated: shelter.initial_supplies?.[supplyType.id] || 0,
                    shortage: 0
                };
            });
        });
        
        supplyRules.rules.forEach(rule => {
            if (!rule.condition || !rule.action) {
                return;
            }
            
            Object.entries(shelterEvacuees).forEach(([shelterId, shelterEvacueeList]) => {
                const matchingEvacuees = shelterEvacueeList.filter(evacuee => 
                    matchesCondition(evacuee, rule.condition)
                );
                
                if (matchingEvacuees.length > 0) {
                    const supplyType = rule.action.supply_type;
                    const quantity = rule.action.quantity || 1;
                    
                    if (shelterSupplyStatus[shelterId] && 
                        shelterSupplyStatus[shelterId].supplies[supplyType]) {
                        
                        const supply = shelterSupplyStatus[shelterId].supplies[supplyType];
                        supply.required += matchingEvacuees.length * quantity;
                        supply.shortage = Math.max(0, supply.required - supply.allocated);
                        
                        if (supply.shortage > 0) {
                            issues.push({
                                id: `supply_shortage_${shelterId}_${supplyType}`,
                                type: ISSUE_TYPES.SUPPLY_SHORTAGE,
                                severity: supply.shortage > 5 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
                                title: '物资短缺',
                                description: `避难点"${shelterSupplyStatus[shelterId].shelter.name}"${supply.type.name}短缺。需求: ${supply.required}, 分配: ${supply.allocated}, 缺口: ${supply.shortage}`,
                                shelterId: shelterId,
                                shelterName: shelterSupplyStatus[shelterId].shelter.name,
                                supplyType: supplyType,
                                supplyName: supply.type.name,
                                required: supply.required,
                                allocated: supply.allocated,
                                shortage: supply.shortage,
                                affectedEvacuees: matchingEvacuees.map(e => ({
                                    id: e.id,
                                    name: e.name,
                                    age: e.age,
                                    specialNeeds: e.special_needs
                                })),
                                condition: rule.condition,
                                timestamp: getLatestArrivalTime(matchingEvacuees),
                                status: 'detected'
                            });
                        }
                    }
                }
            });
        });
        
        return issues;
    }
    
    function checkDuplicateRegistration(evacuees) {
        const issues = [];
        const idMap = {};
        const nameMap = {};
        
        evacuees.forEach((evacuee, index) => {
            if (evacuee.id) {
                if (!idMap[evacuee.id]) {
                    idMap[evacuee.id] = [];
                }
                idMap[evacuee.id].push({
                    evacuee: evacuee,
                    index: index
                });
            }
            
            if (evacuee.name) {
                const nameKey = evacuee.name.toLowerCase().trim();
                if (!nameMap[nameKey]) {
                    nameMap[nameKey] = [];
                }
                nameMap[nameKey].push({
                    evacuee: evacuee,
                    index: index
                });
            }
        });
        
        Object.entries(idMap).forEach(([id, entries]) => {
            if (entries.length > 1) {
                issues.push({
                    id: `duplicate_id_${id}`,
                    type: ISSUE_TYPES.DUPLICATE_REGISTRATION,
                    severity: SEVERITY.HIGH,
                    title: '重复登记（ID重复）',
                    description: `人员ID "${id}" 被重复登记了 ${entries.length} 次`,
                    duplicateId: id,
                    entries: entries.map(e => ({
                        index: e.index,
                        name: e.evacuee.name,
                        arrivalTime: e.evacuee.arrival_time,
                        shelterId: e.evacuee.shelter_id
                    })),
                    timestamp: getLatestArrivalTime(entries.map(e => e.evacuee)),
                    status: 'detected'
                });
            }
        });
        
        Object.entries(nameMap).forEach(([nameKey, entries]) => {
            if (entries.length > 1) {
                const uniqueIds = new Set(entries.map(e => e.evacuee.id));
                if (uniqueIds.size === entries.length) {
                    issues.push({
                        id: `duplicate_name_${nameKey}`,
                        type: ISSUE_TYPES.DUPLICATE_REGISTRATION,
                        severity: SEVERITY.MEDIUM,
                        title: '疑似重复登记（姓名相同）',
                        description: `姓名 "${entries[0].evacuee.name}" 出现了 ${entries.length} 次，可能是同名人员或重复登记`,
                        duplicateName: entries[0].evacuee.name,
                        entries: entries.map(e => ({
                            index: e.index,
                            id: e.evacuee.id,
                            arrivalTime: e.evacuee.arrival_time,
                            shelterId: e.evacuee.shelter_id,
                            age: e.evacuee.age
                        })),
                        timestamp: getLatestArrivalTime(entries.map(e => e.evacuee)),
                        status: 'suspected'
                    });
                }
            }
        });
        
        return issues;
    }
    
    function checkMidnightStatistics(evacuees, timeRange = null) {
        const issues = [];
        
        if (evacuees.length === 0) {
            return issues;
        }
        
        const arrivalTimes = evacuees
            .map(e => e.arrival_time)
            .filter(t => t)
            .map(t => new Date(t))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b);
        
        if (arrivalTimes.length < 2) {
            return issues;
        }
        
        const earliestTime = arrivalTimes[0];
        const latestTime = arrivalTimes[arrivalTimes.length - 1];
        
        const earliestDate = new Date(earliestTime);
        earliestDate.setHours(0, 0, 0, 0);
        
        const latestDate = new Date(latestTime);
        latestDate.setHours(0, 0, 0, 0);
        
        if (earliestDate.getTime() !== latestDate.getTime()) {
            const daysDiff = Math.ceil((latestDate - earliestDate) / (1000 * 60 * 60 * 24));
            
            const nightCrossings = [];
            let currentDate = new Date(earliestDate);
            
            for (let i = 0; i < daysDiff; i++) {
                const midnight = new Date(currentDate);
                midnight.setHours(24, 0, 0, 0);
                
                const beforeMidnight = arrivalTimes.filter(t => 
                    t >= currentDate && t < midnight
                );
                
                const afterMidnight = arrivalTimes.filter(t => 
                    t >= midnight && t < new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
                );
                
                if (beforeMidnight.length > 0 && afterMidnight.length > 0) {
                    nightCrossings.push({
                        date: currentDate.toISOString().split('T')[0],
                        beforeCount: beforeMidnight.length,
                        afterCount: afterMidnight.length,
                        beforeTime: formatTime(beforeMidnight[beforeMidnight.length - 1]),
                        afterTime: formatTime(afterMidnight[0])
                    });
                }
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            if (nightCrossings.length > 0) {
                issues.push({
                    id: `midnight_statistics_${Date.now()}`,
                    type: ISSUE_TYPES.MIDNIGHT_STATISTICS,
                    severity: SEVERITY.MEDIUM,
                    title: '跨午夜统计警告',
                    description: `数据跨越了 ${nightCrossings.length} 个午夜，可能存在统计误差`,
                    earliestTime: formatDateTime(earliestTime),
                    latestTime: formatDateTime(latestTime),
                    daysSpan: daysDiff + 1,
                    nightCrossings: nightCrossings,
                    suggestion: '建议按日期分段查看数据，或确认午夜时段的登记是否准确',
                    status: 'warning'
                });
            }
        }
        
        return issues;
    }
    
    function checkSpecialCareNeeds(evacuees, supplyRules) {
        const issues = [];
        
        const specialGroups = {
            infants: [],
            elderly: [],
            disabled: [],
            pregnant: [],
            chronic: []
        };
        
        evacuees.forEach(evacuee => {
            if (evacuee.age !== undefined && evacuee.age < 3) {
                specialGroups.infants.push(evacuee);
            }
            if (evacuee.age !== undefined && evacuee.age >= 65) {
                specialGroups.elderly.push(evacuee);
            }
            
            if (evacuee.special_needs) {
                const needs = Array.isArray(evacuee.special_needs) 
                    ? evacuee.special_needs 
                    : [evacuee.special_needs];
                
                needs.forEach(need => {
                    const needLower = need.toLowerCase();
                    if (needLower.includes('残疾') || needLower.includes('disabled')) {
                        specialGroups.disabled.push(evacuee);
                    }
                    if (needLower.includes('孕妇') || needLower.includes('pregnant')) {
                        specialGroups.pregnant.push(evacuee);
                    }
                    if (needLower.includes('慢性病') || needLower.includes('chronic')) {
                        specialGroups.chronic.push(evacuee);
                    }
                });
            }
        });
        
        const groupDescriptions = {
            infants: { name: '婴幼儿', threshold: 0, description: '3岁以下婴幼儿需要特殊照护' },
            elderly: { name: '老年人', threshold: 5, description: '65岁以上老年人需要特殊关注' },
            disabled: { name: '残疾人', threshold: 0, description: '残疾人需要特殊照护设施' },
            pregnant: { name: '孕妇', threshold: 0, description: '孕妇需要特殊医疗关注' },
            chronic: { name: '慢性病患者', threshold: 3, description: '慢性病患者需要持续药物供应' }
        };
        
        Object.entries(specialGroups).forEach(([groupKey, groupMembers]) => {
            if (groupMembers.length > 0) {
                const groupInfo = groupDescriptions[groupKey];
                const needsAttention = groupMembers.length > groupInfo.threshold;
                
                issues.push({
                    id: `special_care_${groupKey}`,
                    type: ISSUE_TYPES.SPECIAL_CARE_NEEDED,
                    severity: needsAttention ? SEVERITY.MEDIUM : SEVERITY.LOW,
                    title: `特殊人群照护提醒 - ${groupInfo.name}`,
                    description: `检测到 ${groupMembers.length} 名${groupInfo.name}。${groupInfo.description}`,
                    groupKey: groupKey,
                    groupName: groupInfo.name,
                    count: groupMembers.length,
                    threshold: groupInfo.threshold,
                    needsAttention: needsAttention,
                    affectedEvacuees: groupMembers.map(e => ({
                        id: e.id,
                        name: e.name,
                        age: e.age,
                        shelterId: e.shelter_id,
                        specialNeeds: e.special_needs
                    })),
                    timestamp: getLatestArrivalTime(groupMembers),
                    status: needsAttention ? 'attention_needed' : 'monitored'
                });
            }
        });
        
        return issues;
    }
    
    function runAllChecks(shelters, evacuees, supplyRules) {
        const allIssues = [];
        
        allIssues.push(...checkOverCapacity(shelters, evacuees, supplyRules));
        allIssues.push(...checkSupplyShortage(shelters, evacuees, supplyRules));
        allIssues.push(...checkDuplicateRegistration(evacuees));
        allIssues.push(...checkMidnightStatistics(evacuees));
        allIssues.push(...checkSpecialCareNeeds(evacuees, supplyRules));
        
        return allIssues.sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }
    
    function matchesCondition(evacuee, condition) {
        if (!condition) return true;
        
        if (condition.age_range) {
            const age = evacuee.age;
            if (age === undefined) return false;
            
            if (condition.age_range.min !== undefined && age < condition.age_range.min) {
                return false;
            }
            if (condition.age_range.max !== undefined && age > condition.age_range.max) {
                return false;
            }
        }
        
        if (condition.special_needs) {
            const needs = evacuee.special_needs;
            if (!needs) return false;
            
            const needsArray = Array.isArray(needs) ? needs : [needs];
            const conditionNeeds = Array.isArray(condition.special_needs) 
                ? condition.special_needs 
                : [condition.special_needs];
            
            return conditionNeeds.some(condNeed => 
                needsArray.some(need => 
                    need.toLowerCase().includes(condNeed.toLowerCase())
                )
            );
        }
        
        if (condition.has_medical_condition) {
            return evacuee.medical_conditions && 
                   (Array.isArray(evacuee.medical_conditions) 
                       ? evacuee.medical_conditions.length > 0 
                       : evacuee.medical_conditions);
        }
        
        return true;
    }
    
    function getLatestArrivalTime(evacuees) {
        if (!evacuees || evacuees.length === 0) {
            return null;
        }
        
        const validTimes = evacuees
            .map(e => e.arrival_time)
            .filter(t => t)
            .map(t => new Date(t))
            .filter(d => !isNaN(d.getTime()));
        
        if (validTimes.length === 0) {
            return null;
        }
        
        const latest = new Date(Math.max(...validTimes.map(d => d.getTime())));
        return formatDateTime(latest);
    }
    
    function formatDateTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().replace('T', ' ').substring(0, 19);
    }
    
    function formatTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toTimeString().substring(0, 8);
    }
    
    return {
        ISSUE_TYPES,
        SEVERITY,
        checkOverCapacity,
        checkSupplyShortage,
        checkDuplicateRegistration,
        checkMidnightStatistics,
        checkSpecialCareNeeds,
        runAllChecks,
        matchesCondition
    };
})();
