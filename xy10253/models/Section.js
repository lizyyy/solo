class Section {
    constructor(data = {}) {
        this.id = data.id || Validation.generateId('section');
        this.name = data.name || '';
        this.shortName = data.shortName || '';
        this.voiceLow = data.voiceLow || '';
        this.voiceHigh = data.voiceHigh || '';
        this.minCapacity = data.minCapacity || 0;
        this.maxCapacity = data.maxCapacity || 10;
        this.priority = data.priority || 0;
        this.color = data.color || '#e3f2fd';
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
    }
    
    get voiceRange() {
        return {
            low: this.voiceLow,
            high: this.voiceHigh
        };
    }
    
    get displayName() {
        return this.shortName || this.name;
    }
    
    isValid() {
        return Validation.validateSection(this).isValid;
    }
    
    canAcceptMember(member) {
        if (!member || !member.voiceLow || !member.voiceHigh) return false;
        if (!this.voiceLow || !this.voiceHigh) return false;
        
        return NOTES.rangesOverlap(
            member.voiceLow, member.voiceHigh,
            this.voiceLow, this.voiceHigh
        );
    }
    
    getMemberFitScore(member) {
        if (!member || !this.canAcceptMember(member)) return 0;
        
        return NOTES.getRangeOverlapScore(
            member.voiceLow, member.voiceHigh,
            this.voiceLow, this.voiceHigh
        );
    }
    
    isCapacitySatisfied(currentCount) {
        return currentCount >= this.minCapacity && currentCount <= this.maxCapacity;
    }
    
    isBelowMinimum(currentCount) {
        return currentCount < this.minCapacity;
    }
    
    isOverCapacity(currentCount) {
        return currentCount > this.maxCapacity;
    }
    
    hasCapacity(currentCount) {
        return currentCount < this.maxCapacity;
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            shortName: this.shortName,
            voiceLow: this.voiceLow,
            voiceHigh: this.voiceHigh,
            minCapacity: this.minCapacity,
            maxCapacity: this.maxCapacity,
            priority: this.priority,
            color: this.color,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    
    static fromJSON(data) {
        return new Section(data);
    }
}
