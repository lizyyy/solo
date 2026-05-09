class AllocationResult {
    constructor(data = {}) {
        this.allocations = data.allocations || {};
        this.unallocated = data.unallocated || [];
        this.conflicts = data.conflicts || [];
        this.warnings = data.warnings || [];
        this.stats = data.stats || {
            totalMembers: 0,
            allocated: 0,
            unallocated: 0,
            sectionsBalanced: true,
            voiceRangeMatchRate: 1
        };
        this.createdAt = data.createdAt || Date.now();
        this.settings = data.settings || {
            useVoiceRange: true,
            usePreference: true,
            useStanding: true,
            balanceSections: true
        };
    }
    
    addAllocation(memberId, sectionId, score = 0) {
        if (!this.allocations[sectionId]) {
            this.allocations[sectionId] = [];
        }
        this.allocations[sectionId].push({
            memberId: memberId,
            score: score,
            allocatedAt: Date.now()
        });
    }
    
    addUnallocated(memberId, reason = '') {
        this.unallocated.push({
            memberId: memberId,
            reason: reason
        });
    }
    
    addConflict(type, memberId, sectionId, message = '') {
        this.conflicts.push({
            type: type,
            memberId: memberId,
            sectionId: sectionId,
            message: message,
            resolved: false
        });
    }
    
    addWarning(type, sectionId, message = '') {
        this.warnings.push({
            type: type,
            sectionId: sectionId,
            message: message
        });
    }
    
    getSectionMembers(sectionId) {
        return this.allocations[sectionId] || [];
    }
    
    getSectionCount(sectionId) {
        return this.getSectionMembers(sectionId).length;
    }
    
    isMemberAllocated(memberId) {
        for (const sectionId in this.allocations) {
            for (const alloc of this.allocations[sectionId]) {
                if (alloc.memberId === memberId) return true;
            }
        }
        return false;
    }
    
    getMemberAllocation(memberId) {
        for (const sectionId in this.allocations) {
            for (const alloc of this.allocations[sectionId]) {
                if (alloc.memberId === memberId) {
                    return {
                        sectionId: sectionId,
                        ...alloc
                    };
                }
            }
        }
        return null;
    }
    
    hasIssues() {
        return this.conflicts.length > 0 || this.unallocated.length > 0;
    }
    
    hasCriticalIssues() {
        return this.conflicts.some(c => c.type === 'capacity_exceeded' || c.type === 'missing_data');
    }
    
    getSummary(members, sections) {
        const sectionSummary = {};
        sections.forEach(section => {
            const allocations = this.getSectionMembers(section.id);
            const memberDetails = allocations.map(a => {
                const member = members.find(m => m.id === a.memberId);
                return {
                    ...a,
                    member: member
                };
            });
            
            sectionSummary[section.id] = {
                section: section,
                members: memberDetails,
                count: allocations.length,
                isBelowMin: section.isBelowMinimum(allocations.length),
                isOverMax: section.isOverCapacity(allocations.length),
                satisfaction: section.isCapacitySatisfied(allocations.length)
            };
        });
        
        const unallocatedDetails = this.unallocated.map(u => ({
            ...u,
            member: members.find(m => m.id === u.memberId)
        }));
        
        return {
            sections: sectionSummary,
            unallocated: unallocatedDetails,
            conflicts: this.conflicts,
            warnings: this.warnings,
            stats: this.stats
        };
    }
    
    toJSON() {
        return {
            allocations: this.allocations,
            unallocated: this.unallocated,
            conflicts: this.conflicts,
            warnings: this.warnings,
            stats: this.stats,
            createdAt: this.createdAt,
            settings: this.settings
        };
    }
    
    static fromJSON(data) {
        return new AllocationResult(data);
    }
}
