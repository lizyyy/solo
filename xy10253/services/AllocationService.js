const AllocationService = {
    allocate: function(members, sections, attendance, settings = {}) {
        const result = new AllocationResult({
            settings: {
                useVoiceRange: settings.useVoiceRange !== false,
                usePreference: settings.usePreference !== false,
                useStanding: settings.useStanding !== false,
                balanceSections: settings.balanceSections !== false
            }
        });
        
        const presentMembers = this.filterPresentMembers(members, attendance);
        result.stats.totalMembers = presentMembers.length;
        
        const sortedMembers = this.sortMembersForAllocation(presentMembers, sections, result.settings);
        
        const sectionCounts = {};
        sections.forEach(s => sectionCounts[s.id] = 0);
        
        const sortedSections = [...sections].sort((a, b) => b.priority - a.priority);
        
        for (const member of sortedMembers) {
            const bestSection = this.findBestSection(member, sortedSections, sectionCounts, result.settings);
            
            if (bestSection) {
                const score = this.calculateAllocationScore(member, bestSection, result.settings);
                result.addAllocation(member.id, bestSection.id, score);
                sectionCounts[bestSection.id]++;
            } else {
                result.addUnallocated(member.id, this.getUnallocationReason(member, sections));
            }
        }
        
        this.checkSectionBalances(sections, sectionCounts, result);
        this.calculateStats(result, members, sections);
        
        return result;
    },
    
    filterPresentMembers: function(members, attendance) {
        return members.filter(member => {
            const status = attendance[member.id];
            return status === undefined || status === true;
        });
    },
    
    sortMembersForAllocation: function(members, sections, settings) {
        return [...members].sort((a, b) => {
            if (a.isCoreMember !== b.isCoreMember) {
                return a.isCoreMember ? -1 : 1;
            }
            
            if (a.preferredSection && !b.preferredSection) return -1;
            if (!a.preferredSection && b.preferredSection) return 1;
            
            const aRange = a.voiceHigh && a.voiceLow ? 
                NOTES.getIndex(a.voiceHigh) - NOTES.getIndex(a.voiceLow) : 0;
            const bRange = b.voiceHigh && b.voiceLow ? 
                NOTES.getIndex(b.voiceHigh) - NOTES.getIndex(b.voiceLow) : 0;
            
            return aRange - bRange;
        });
    },
    
    findBestSection: function(member, sections, sectionCounts, settings) {
        let bestSection = null;
        let bestScore = -1;
        
        for (const section of sections) {
            if (!section.hasCapacity(sectionCounts[section.id])) continue;
            
            let canFit = true;
            if (settings.useVoiceRange) {
                canFit = member.canFitSection(section);
            }
            
            if (!canFit) continue;
            
            let score = this.calculateAllocationScore(member, section, settings);
            
            if (settings.balanceSections) {
                const balancePenalty = sectionCounts[section.id] * 0.05;
                score -= balancePenalty;
            }
            
            score += section.priority * 0.02;
            
            if (score > bestScore) {
                bestScore = score;
                bestSection = section;
            }
        }
        
        return bestSection;
    },
    
    calculateAllocationScore: function(member, section, settings) {
        let score = 0;
        
        if (settings.useVoiceRange) {
            score += member.getSectionFitScore(section) * 0.5;
        }
        
        if (settings.usePreference && member.preferredSection === section.id) {
            score += 0.3;
        }
        
        if (settings.useStanding && member.standingExperience) {
            score += 0.1;
        }
        
        score += member.isCoreMember ? 0.1 : 0;
        
        return Math.min(score, 1);
    },
    
    getUnallocationReason: function(member, sections) {
        const reasons = [];
        
        if (!member.voiceLow || !member.voiceHigh) {
            reasons.push('未设置音域');
        } else {
            const hasMatchingSection = sections.some(s => member.canFitSection(s));
            if (!hasMatchingSection) {
                reasons.push('音域与所有声部不匹配');
            }
        }
        
        if (reasons.length === 0) {
            reasons.push('所有声部已满员');
        }
        
        return reasons.join('；');
    },
    
    checkSectionBalances: function(sections, sectionCounts, result) {
        sections.forEach(section => {
            const count = sectionCounts[section.id];
            
            if (section.isBelowMinimum(count)) {
                result.addWarning(
                    'below_minimum',
                    section.id,
                    `${section.name}人数不足：当前${count}人，最少需要${section.minCapacity}人`
                );
            }
            
            if (section.isOverCapacity(count)) {
                result.addConflict(
                    'capacity_exceeded',
                    null,
                    section.id,
                    `${section.name}人数超额：当前${count}人，最多容纳${section.maxCapacity}人`
                );
            }
        });
    },
    
    calculateStats: function(result, members, sections) {
        const allocatedCount = Object.values(result.allocations)
            .reduce((sum, arr) => sum + arr.length, 0);
        
        let voiceRangeMatches = 0;
        let totalAllocations = 0;
        
        for (const sectionId in result.allocations) {
            const section = sections.find(s => s.id === sectionId);
            if (!section) continue;
            
            for (const alloc of result.allocations[sectionId]) {
                totalAllocations++;
                const member = members.find(m => m.id === alloc.memberId);
                if (member && member.canFitSection(section)) {
                    voiceRangeMatches++;
                }
            }
        }
        
        result.stats = {
            totalMembers: result.stats.totalMembers,
            allocated: allocatedCount,
            unallocated: result.unallocated.length,
            sectionsBalanced: result.warnings.filter(w => w.type === 'below_minimum').length === 0,
            voiceRangeMatchRate: totalAllocations > 0 ? voiceRangeMatches / totalAllocations : 1,
            preferenceMatchRate: this.calculatePreferenceMatchRate(result, members),
            coreMembersAllocated: this.calculateCoreMemberAllocation(result, members)
        };
    },
    
    calculatePreferenceMatchRate: function(result, members) {
        let matched = 0;
        let totalWithPreference = 0;
        
        for (const member of members) {
            if (!member.preferredSection) continue;
            totalWithPreference++;
            
            const allocation = result.getMemberAllocation(member.id);
            if (allocation && allocation.sectionId === member.preferredSection) {
                matched++;
            }
        }
        
        return totalWithPreference > 0 ? matched / totalWithPreference : 1;
    },
    
    calculateCoreMemberAllocation: function(result, members) {
        const coreMembers = members.filter(m => m.isCoreMember);
        let allocated = 0;
        
        for (const member of coreMembers) {
            if (result.isMemberAllocated(member.id)) {
                allocated++;
            }
        }
        
        return coreMembers.length > 0 ? allocated / coreMembers.length : 1;
    },
    
    manualAllocate: function(memberId, sectionId, currentResult, members, sections) {
        const newResult = AllocationResult.fromJSON(currentResult.toJSON());
        
        const oldAllocation = newResult.getMemberAllocation(memberId);
        if (oldAllocation) {
            newResult.allocations[oldAllocation.sectionId] = 
                newResult.allocations[oldAllocation.sectionId].filter(
                    a => a.memberId !== memberId
                );
        }
        
        newResult.unallocated = newResult.unallocated.filter(
            u => u.memberId !== memberId
        );
        
        const section = sections.find(s => s.id === sectionId);
        const member = members.find(m => m.id === memberId);
        
        if (section && member) {
            const score = member.getSectionFitScore(section);
            newResult.addAllocation(memberId, sectionId, score);
        }
        
        return newResult;
    }
};
