const StateCalculator = (function() {
    'use strict';
    
    function calculateShelterStates(shelters, evacuees, supplyRules, issues) {
        const shelterStates = {};
        
        shelters.forEach(shelter => {
            shelterStates[shelter.id] = {
                shelter: shelter,
                occupancy: {
                    total: 0,
                    byAge: { infants: 0, children: 0, adults: 0, elderly: 0 },
                    bySpecialNeeds: { disabled: 0, pregnant: 0, chronic: 0 }
                },
                bedStatus: {
                    capacity: shelter.capacity || 0,
                    occupied: 0,
                    available: shelter.capacity || 0,
                    isOverCapacity: false,
                    overage: 0
                },
                supplyStatus: {},
                issues: [],
                timeline: []
            };
            
            if (supplyRules && supplyRules.supply_types) {
                supplyRules.supply_types.forEach(supplyType => {
                    shelterStates[shelter.id].supplyStatus[supplyType.id] = {
                        type: supplyType,
                        initial: shelter.initial_supplies?.[supplyType.id] || 0,
                        allocated: 0,
                        required: 0,
                        consumed: 0,
                        remaining: shelter.initial_supplies?.[supplyType.id] || 0,
                        shortage: 0
                    };
                });
            }
        });
        
        evacuees.forEach(evacuee => {
            const shelterId = evacuee.shelter_id;
            if (!shelterStates[shelterId]) return;
            
            const state = shelterStates[shelterId];
            
            state.occupancy.total++;
            
            if (evacuee.age !== undefined) {
                if (evacuee.age < 3) {
                    state.occupancy.byAge.infants++;
                } else if (evacuee.age < 18) {
                    state.occupancy.byAge.children++;
                } else if (evacuee.age < 65) {
                    state.occupancy.byAge.adults++;
                } else {
                    state.occupancy.byAge.elderly++;
                }
            }
            
            if (evacuee.special_needs) {
                const needs = Array.isArray(evacuee.special_needs) 
                    ? evacuee.special_needs 
                    : [evacuee.special_needs];
                
                needs.forEach(need => {
                    const needLower = need.toLowerCase();
                    if (needLower.includes('残疾') || needLower.includes('disabled')) {
                        state.occupancy.bySpecialNeeds.disabled++;
                    }
                    if (needLower.includes('孕妇') || needLower.includes('pregnant')) {
                        state.occupancy.bySpecialNeeds.pregnant++;
                    }
                    if (needLower.includes('慢性病') || needLower.includes('chronic')) {
                        state.occupancy.bySpecialNeeds.chronic++;
                    }
                });
            }
            
            state.timeline.push({
                type: 'arrival',
                timestamp: evacuee.arrival_time,
                evacuee: evacuee,
                description: `${evacuee.name} 到达避难点`
            });
        });
        
        Object.values(shelterStates).forEach(state => {
            state.bedStatus.occupied = state.occupancy.total;
            state.bedStatus.available = state.bedStatus.capacity - state.bedStatus.occupied;
            state.bedStatus.isOverCapacity = state.bedStatus.occupied > state.bedStatus.capacity;
            state.bedStatus.overage = Math.max(0, state.bedStatus.occupied - state.bedStatus.capacity);
        });
        
        if (supplyRules && supplyRules.rules) {
            supplyRules.rules.forEach(rule => {
                if (!rule.condition || !rule.action) return;
                
                Object.entries(shelterStates).forEach(([shelterId, state]) => {
                    const shelterEvacuees = evacuees.filter(e => e.shelter_id === shelterId);
                    const matchingEvacuees = shelterEvacuees.filter(evacuee => 
                        RuleEngine.matchesCondition(evacuee, rule.condition)
                    );
                    
                    if (matchingEvacuees.length > 0) {
                        const supplyType = rule.action.supply_type;
                        const quantity = rule.action.quantity || 1;
                        
                        if (state.supplyStatus[supplyType]) {
                            state.supplyStatus[supplyType].required += matchingEvacuees.length * quantity;
                            state.supplyStatus[supplyType].allocated = Math.min(
                                state.supplyStatus[supplyType].initial,
                                state.supplyStatus[supplyType].required
                            );
                            state.supplyStatus[supplyType].consumed = state.supplyStatus[supplyType].allocated;
                            state.supplyStatus[supplyType].remaining = 
                                state.supplyStatus[supplyType].initial - state.supplyStatus[supplyType].consumed;
                            state.supplyStatus[supplyType].shortage = 
                                Math.max(0, state.supplyStatus[supplyType].required - state.supplyStatus[supplyType].allocated);
                        }
                    }
                });
            });
        }
        
        issues.forEach(issue => {
            if (issue.shelterId && shelterStates[issue.shelterId]) {
                shelterStates[issue.shelterId].issues.push(issue);
            }
        });
        
        return shelterStates;
    }
    
    function generateTimelineEvents(shelters, evacuees, issues) {
        const events = [];
        
        evacuees.forEach(evacuee => {
            if (evacuee.arrival_time) {
                const shelter = shelters.find(s => s.id === evacuee.shelter_id);
                events.push({
                    id: `arrival_${evacuee.id}`,
                    type: 'arrival',
                    timestamp: evacuee.arrival_time,
                    title: '人员到达',
                    description: `${evacuee.name}${evacuee.age !== undefined ? ` (${evacuee.age}岁)` : ''} 到达${shelter ? shelter.name : '避难点'}`,
                    evacuee: evacuee,
                    shelterId: evacuee.shelter_id,
                    shelterName: shelter?.name,
                    priority: 'normal'
                });
            }
        });
        
        issues.forEach(issue => {
            const eventType = getIssueEventType(issue.type);
            events.push({
                id: issue.id,
                type: 'issue',
                issueType: issue.type,
                timestamp: issue.timestamp || getEarliestTimestamp(evacuees),
                title: issue.title,
                description: issue.description,
                severity: issue.severity,
                shelterId: issue.shelterId,
                shelterName: issue.shelterName,
                affectedCount: issue.affectedEvacuees?.length || 0,
                priority: issue.severity === 'high' ? 'high' : 
                          issue.severity === 'medium' ? 'medium' : 'low'
            });
        });
        
        return events.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
        });
    }
    
    function getIssueEventType(issueType) {
        const typeMap = {
            'over_capacity': 'capacity_issue',
            'supply_shortage': 'supply_issue',
            'duplicate_registration': 'registration_issue',
            'midnight_statistics': 'statistics_warning',
            'special_care_needed': 'care_reminder'
        };
        return typeMap[issueType] || 'general_issue';
    }
    
    function getEarliestTimestamp(evacuees) {
        const validTimes = evacuees
            .map(e => e.arrival_time)
            .filter(t => t)
            .map(t => new Date(t))
            .filter(d => !isNaN(d.getTime()));
        
        if (validTimes.length === 0) {
            return new Date().toISOString();
        }
        
        return new Date(Math.min(...validTimes.map(d => d.getTime()))).toISOString();
    }
    
    function calculateStatistics(shelterStates, evacuees, issues) {
        const stats = {
            totalShelters: Object.keys(shelterStates).length,
            totalEvacuees: evacuees.length,
            totalIssues: issues.length,
            
            bedStats: {
                totalCapacity: 0,
                totalOccupied: 0,
                totalAvailable: 0,
                overCapacityShelters: 0,
                totalOverage: 0
            },
            
            supplyStats: {
                totalSupplyTypes: 0,
                suppliesWithShortage: 0,
                totalShortage: 0
            },
            
            demographicStats: {
                infants: 0,
                children: 0,
                adults: 0,
                elderly: 0,
                disabled: 0,
                pregnant: 0,
                chronic: 0
            },
            
            issueStats: {
                byType: {},
                bySeverity: {
                    high: 0,
                    medium: 0,
                    low: 0
                }
            }
        };
        
        Object.values(shelterStates).forEach(state => {
            stats.bedStats.totalCapacity += state.bedStatus.capacity;
            stats.bedStats.totalOccupied += state.bedStatus.occupied;
            stats.bedStats.totalAvailable += state.bedStatus.available;
            
            if (state.bedStatus.isOverCapacity) {
                stats.bedStats.overCapacityShelters++;
                stats.bedStats.totalOverage += state.bedStatus.overage;
            }
            
            stats.demographicStats.infants += state.occupancy.byAge.infants;
            stats.demographicStats.children += state.occupancy.byAge.children;
            stats.demographicStats.adults += state.occupancy.byAge.adults;
            stats.demographicStats.elderly += state.occupancy.byAge.elderly;
            stats.demographicStats.disabled += state.occupancy.bySpecialNeeds.disabled;
            stats.demographicStats.pregnant += state.occupancy.bySpecialNeeds.pregnant;
            stats.demographicStats.chronic += state.occupancy.bySpecialNeeds.chronic;
            
            Object.values(state.supplyStatus).forEach(supply => {
                stats.supplyStats.totalSupplyTypes++;
                if (supply.shortage > 0) {
                    stats.supplyStats.suppliesWithShortage++;
                    stats.supplyStats.totalShortage += supply.shortage;
                }
            });
        });
        
        issues.forEach(issue => {
            if (!stats.issueStats.byType[issue.type]) {
                stats.issueStats.byType[issue.type] = 0;
            }
            stats.issueStats.byType[issue.type]++;
            
            if (stats.issueStats.bySeverity[issue.severity] !== undefined) {
                stats.issueStats.bySeverity[issue.severity]++;
            }
        });
        
        return stats;
    }
    
    function filterByShelter(data, shelterId) {
        if (shelterId === 'all') {
            return data;
        }
        
        return {
            ...data,
            evacuees: data.evacuees.filter(e => e.shelter_id === shelterId),
            issues: data.issues.filter(i => i.shelterId === shelterId || !i.shelterId),
            timelineEvents: data.timelineEvents.filter(e => 
                e.shelterId === shelterId || !e.shelterId
            )
        };
    }
    
    function filterByTimeRange(data, startTime, endTime) {
        if (!startTime && !endTime) {
            return data;
        }
        
        const start = startTime ? new Date(startTime).getTime() : 0;
        const end = endTime ? new Date(endTime).getTime() : Infinity;
        
        const filterByTime = (item) => {
            if (!item.timestamp) return true;
            const itemTime = new Date(item.timestamp).getTime();
            return itemTime >= start && itemTime <= end;
        };
        
        return {
            ...data,
            evacuees: data.evacuees.filter(filterByTime),
            issues: data.issues.filter(filterByTime),
            timelineEvents: data.timelineEvents.filter(filterByTime)
        };
    }
    
    function filterByIssueTypes(data, filterOptions) {
        const { filterOverCapacity, filterSupplyShortage, filterDuplicate, filterMidnight } = filterOptions;
        
        const allowedTypes = [];
        if (filterOverCapacity) allowedTypes.push('over_capacity');
        if (filterSupplyShortage) allowedTypes.push('supply_shortage', 'special_care_needed');
        if (filterDuplicate) allowedTypes.push('duplicate_registration');
        if (filterMidnight) allowedTypes.push('midnight_statistics');
        
        return {
            ...data,
            issues: data.issues.filter(issue => 
                allowedTypes.includes(issue.type)
            ),
            timelineEvents: data.timelineEvents.filter(event => {
                if (event.type !== 'issue') return true;
                return allowedTypes.includes(event.issueType);
            })
        };
    }
    
    function prepareBedAllocationData(shelters, evacuees, shelterStates) {
        return evacuees.map(evacuee => {
            const shelter = shelters.find(s => s.id === evacuee.shelter_id);
            const state = shelterStates[evacuee.shelter_id];
            
            let status = 'normal';
            let statusText = '正常';
            
            if (state && state.bedStatus.isOverCapacity) {
                const shelterEvacuees = evacuees.filter(e => e.shelter_id === evacuee.shelter_id)
                    .sort((a, b) => new Date(a.arrival_time) - new Date(b.arrival_time));
                
                const index = shelterEvacuees.findIndex(e => e.id === evacuee.id);
                if (index >= state.bedStatus.capacity) {
                    status = 'danger';
                    statusText = '无床位';
                }
            }
            
            let specialNeeds = '-';
            if (evacuee.special_needs) {
                const needs = Array.isArray(evacuee.special_needs) 
                    ? evacuee.special_needs 
                    : [evacuee.special_needs];
                specialNeeds = needs.join(', ');
            }
            
            return {
                shelterName: shelter?.name || '-',
                arrivalTime: evacuee.arrival_time || '-',
                evacueeId: evacuee.id,
                name: evacuee.name,
                age: evacuee.age !== undefined ? evacuee.age : '-',
                specialNeeds: specialNeeds,
                bedAssigned: status === 'danger' ? '-' : '已分配',
                status: status,
                statusText: statusText
            };
        }).sort((a, b) => {
            if (a.arrivalTime === '-' || b.arrivalTime === '-') return 0;
            return new Date(a.arrivalTime) - new Date(b.arrivalTime);
        });
    }
    
    function prepareSupplyData(shelterStates) {
        const supplyData = [];
        
        Object.entries(shelterStates).forEach(([shelterId, state]) => {
            Object.entries(state.supplyStatus).forEach(([supplyTypeId, supply]) => {
                if (supply.required > 0 || supply.shortage > 0) {
                    let status = 'normal';
                    if (supply.shortage > 5) {
                        status = 'danger';
                    } else if (supply.shortage > 0) {
                        status = 'warning';
                    }
                    
                    supplyData.push({
                        supplyType: supply.type.name,
                        shelterName: state.shelter.name,
                        required: supply.required,
                        allocated: supply.allocated,
                        shortage: supply.shortage,
                        affectedCount: state.occupancy.total,
                        status: status,
                        statusText: supply.shortage > 0 ? `短缺 ${supply.shortage}` : '充足'
                    });
                }
            });
        });
        
        return supplyData.sort((a, b) => b.shortage - a.shortage);
    }
    
    function prepareSpecialCareData(evacuees, issues) {
        const specialCareEvacuees = evacuees.filter(evacuee => {
            if (evacuee.age !== undefined && (evacuee.age < 3 || evacuee.age >= 65)) {
                return true;
            }
            if (evacuee.special_needs) {
                const needs = Array.isArray(evacuee.special_needs) 
                    ? evacuee.special_needs 
                    : [evacuee.special_needs];
                return needs.some(need => {
                    const needLower = need.toLowerCase();
                    return needLower.includes('残疾') || 
                           needLower.includes('孕妇') || 
                           needLower.includes('慢性病');
                });
            }
            return false;
        });
        
        return specialCareEvacuees.map(evacuee => {
            const specialNeeds = [];
            
            if (evacuee.age < 3) {
                specialNeeds.push('婴幼儿');
            }
            if (evacuee.age >= 65) {
                specialNeeds.push('老年人');
            }
            
            if (evacuee.special_needs) {
                const needs = Array.isArray(evacuee.special_needs) 
                    ? evacuee.special_needs 
                    : [evacuee.special_needs];
                specialNeeds.push(...needs);
            }
            
            const relatedIssues = issues.filter(issue => 
                issue.affectedEvacuees?.some(e => e.id === evacuee.id)
            );
            
            let careStatus = 'normal';
            let careStatusText = '已照护';
            let issuesText = '-';
            
            if (relatedIssues.length > 0) {
                careStatus = 'warning';
                careStatusText = '需关注';
                issuesText = relatedIssues.map(i => i.title).join('; ');
            }
            
            return {
                evacueeId: evacuee.id,
                name: evacuee.name,
                age: evacuee.age !== undefined ? evacuee.age : '-',
                specialNeedsType: specialNeeds.join(', '),
                shelterId: evacuee.shelter_id,
                careStatus: careStatus,
                careStatusText: careStatusText,
                issues: issuesText
            };
        });
    }
    
    function prepareIssuesTableData(issues) {
        const severityLabels = {
            high: '高',
            medium: '中',
            low: '低'
        };
        
        const statusLabels = {
            detected: '已检测',
            suspected: '疑似',
            warning: '警告',
            attention_needed: '需关注',
            monitored: '监控中'
        };
        
        return issues.map(issue => ({
            issueType: getIssueTypeLabel(issue.type),
            severity: issue.severity,
            severityLabel: severityLabels[issue.severity] || issue.severity,
            description: issue.description,
            affectedObject: issue.shelterName || 
                           (issue.duplicateId ? `ID: ${issue.duplicateId}` : 
                            issue.duplicateName ? `姓名: ${issue.duplicateName}` : '-'),
            timestamp: issue.timestamp || '-',
            status: issue.status,
            statusText: statusLabels[issue.status] || issue.status
        }));
    }
    
    function getIssueTypeLabel(type) {
        const labels = {
            'over_capacity': '床位超配',
            'supply_shortage': '物资短缺',
            'duplicate_registration': '重复登记',
            'midnight_statistics': '跨午夜统计',
            'special_care_needed': '特殊照护'
        };
        return labels[type] || type;
    }
    
    return {
        calculateShelterStates,
        generateTimelineEvents,
        calculateStatistics,
        filterByShelter,
        filterByTimeRange,
        filterByIssueTypes,
        prepareBedAllocationData,
        prepareSupplyData,
        prepareSpecialCareData,
        prepareIssuesTableData,
        getIssueTypeLabel
    };
})();
