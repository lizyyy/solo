const Validation = {
    validateMember: function(member) {
        const errors = [];
        
        if (!member.name || !member.name.trim()) {
            errors.push('姓名不能为空');
        }
        
        if (!member.voiceLow || !member.voiceHigh) {
            errors.push('音域范围必须填写完整');
        }
        
        if (member.voiceLow && member.voiceHigh) {
            const lowIdx = NOTES.getIndex(member.voiceLow);
            const highIdx = NOTES.getIndex(member.voiceHigh);
            
            if (lowIdx === -1 || highIdx === -1) {
                errors.push('音域值无效');
            } else if (lowIdx >= highIdx) {
                errors.push('最低音必须低于最高音');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },
    
    validateSection: function(section) {
        const errors = [];
        
        if (!section.name || !section.name.trim()) {
            errors.push('声部名称不能为空');
        }
        
        if (!section.voiceLow || !section.voiceHigh) {
            errors.push('声部音域必须填写完整');
        }
        
        if (section.voiceLow && section.voiceHigh) {
            const lowIdx = NOTES.getIndex(section.voiceLow);
            const highIdx = NOTES.getIndex(section.voiceHigh);
            
            if (lowIdx === -1 || highIdx === -1) {
                errors.push('声部音域值无效');
            } else if (lowIdx >= highIdx) {
                errors.push('声部最低音必须低于最高音');
            }
        }
        
        if (section.minCapacity !== undefined && section.minCapacity < 0) {
            errors.push('最小人数不能为负数');
        }
        
        if (!section.maxCapacity || section.maxCapacity < 1) {
            errors.push('最大人数必须大于0');
        }
        
        if (section.minCapacity !== undefined && section.maxCapacity && 
            section.minCapacity > section.maxCapacity) {
            errors.push('最小人数不能大于最大人数');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },
    
    isValidVoiceRange: function(low, high) {
        if (!low || !high) return false;
        const lowIdx = NOTES.getIndex(low);
        const highIdx = NOTES.getIndex(high);
        return lowIdx !== -1 && highIdx !== -1 && lowIdx < highIdx;
    },
    
    generateId: function(prefix) {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    formatVoiceRange: function(low, high) {
        if (!low || !high) return '-';
        return `${low} - ${high}`;
    }
};
