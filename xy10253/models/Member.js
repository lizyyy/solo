class Member {
    constructor(data = {}) {
        this.id = data.id || Validation.generateId('member');
        this.name = data.name || '';
        this.gender = data.gender || 'female';
        this.voiceLow = data.voiceLow || '';
        this.voiceHigh = data.voiceHigh || '';
        this.preferredSection = data.preferredSection || '';
        this.standingExperience = data.standingExperience || '';
        this.isCoreMember = data.isCoreMember || false;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
    }
    
    get voiceRange() {
        return {
            low: this.voiceLow,
            high: this.voiceHigh
        };
    }
    
    get voiceCenter() {
        if (!this.voiceLow || !this.voiceHigh) return null;
        return NOTES.getRangeCenter(this.voiceLow, this.voiceHigh);
    }
    
    isValid() {
        return Validation.validateMember(this).isValid;
    }
    
    canFitSection(section) {
        if (!section || !section.voiceLow || !section.voiceHigh) return false;
        if (!this.voiceLow || !this.voiceHigh) return false;
        
        return NOTES.rangesOverlap(
            this.voiceLow, this.voiceHigh,
            section.voiceLow, section.voiceHigh
        );
    }
    
    getSectionFitScore(section) {
        if (!section || !this.canFitSection(section)) return 0;
        
        let score = NOTES.getRangeOverlapScore(
            this.voiceLow, this.voiceHigh,
            section.voiceLow, section.voiceHigh
        );
        
        if (this.preferredSection === section.id) {
            score += 0.2;
        }
        
        if (this.isCoreMember) {
            score += 0.1;
        }
        
        if (this.standingExperience) {
            const sectionKeywords = {
                '男高': ['男高', '高音区'],
                '男低': ['男低', '低音区'],
                '女高': ['女高', '高音区'],
                '女中': ['女中', '中音区']
            };
            
            const keywords = sectionKeywords[section.name] || 
                           sectionKeywords[section.shortName] || [];
            
            for (const keyword of keywords) {
                if (this.standingExperience.includes(keyword)) {
                    score += 0.1;
                    break;
                }
            }
        }
        
        return Math.min(score, 1);
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            gender: this.gender,
            voiceLow: this.voiceLow,
            voiceHigh: this.voiceHigh,
            preferredSection: this.preferredSection,
            standingExperience: this.standingExperience,
            isCoreMember: this.isCoreMember,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    
    static fromJSON(data) {
        return new Member(data);
    }
}
