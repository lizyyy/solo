const NOTES = {
    list: [
        'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
        'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
        'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
        'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
        'C6', 'C#6', 'D6', 'D#6', 'E6', 'F6', 'F#6', 'G6', 'G#6', 'A6', 'A#6', 'B6',
        'C7'
    ],
    
    displayNames: {
        'C2': 'C2 (低音C)', 'C#2': 'C#2', 'D2': 'D2', 'D#2': 'D#2', 'E2': 'E2',
        'F2': 'F2', 'F#2': 'F#2', 'G2': 'G2', 'G#2': 'G#2', 'A2': 'A2',
        'A#2': 'A#2', 'B2': 'B2',
        'C3': 'C3', 'C#3': 'C#3', 'D3': 'D3', 'D#3': 'D#3', 'E3': 'E3',
        'F3': 'F3', 'F#3': 'F#3', 'G3': 'G3', 'G#3': 'G#3', 'A3': 'A3',
        'A#3': 'A#3', 'B3': 'B3',
        'C4': 'C4 (中央C)', 'C#4': 'C#4', 'D4': 'D4', 'D#4': 'D#4', 'E4': 'E4',
        'F4': 'F4', 'F#4': 'F#4', 'G4': 'G4', 'G#4': 'G#4', 'A4': 'A4 (标准音)',
        'A#4': 'A#4', 'B4': 'B4',
        'C5': 'C5', 'C#5': 'C#5', 'D5': 'D5', 'D#5': 'D#5', 'E5': 'E5',
        'F5': 'F5', 'F#5': 'F#5', 'G5': 'G5', 'G#5': 'G#5', 'A5': 'A5',
        'A#5': 'A#5', 'B5': 'B5',
        'C6': 'C6', 'C#6': 'C#6', 'D6': 'D6', 'D#6': 'D#6', 'E6': 'E6',
        'F6': 'F6', 'F#6': 'F#6', 'G6': 'G6', 'G#6': 'G#6', 'A6': 'A6',
        'A#6': 'A#6', 'B6': 'B6',
        'C7': 'C7'
    },
    
    getIndex: function(note) {
        return this.list.indexOf(note);
    },
    
    getNote: function(index) {
        return this.list[index];
    },
    
    isInRange: function(note, low, high) {
        const noteIdx = this.getIndex(note);
        const lowIdx = this.getIndex(low);
        const highIdx = this.getIndex(high);
        return noteIdx >= lowIdx && noteIdx <= highIdx;
    },
    
    rangesOverlap: function(low1, high1, low2, high2) {
        const idx1 = this.getIndex(low1);
        const idx2 = this.getIndex(high1);
        const idx3 = this.getIndex(low2);
        const idx4 = this.getIndex(high2);
        return idx1 <= idx4 && idx3 <= idx2;
    },
    
    rangeContains: function(containerLow, containerHigh, innerLow, innerHigh) {
        const idx1 = this.getIndex(containerLow);
        const idx2 = this.getIndex(containerHigh);
        const idx3 = this.getIndex(innerLow);
        const idx4 = this.getIndex(innerHigh);
        return idx1 <= idx3 && idx4 <= idx2;
    },
    
    getRangeCenter: function(low, high) {
        const lowIdx = this.getIndex(low);
        const highIdx = this.getIndex(high);
        const centerIdx = Math.round((lowIdx + highIdx) / 2);
        return this.list[centerIdx];
    },
    
    getRangeOverlapScore: function(memberLow, memberHigh, sectionLow, sectionHigh) {
        const mLow = this.getIndex(memberLow);
        const mHigh = this.getIndex(memberHigh);
        const sLow = this.getIndex(sectionLow);
        const sHigh = this.getIndex(sectionHigh);
        
        const overlapStart = Math.max(mLow, sLow);
        const overlapEnd = Math.min(mHigh, sHigh);
        
        if (overlapStart > overlapEnd) return 0;
        
        const memberRange = mHigh - mLow + 1;
        const sectionRange = sHigh - sLow + 1;
        const overlapRange = overlapEnd - overlapStart + 1;
        
        const coverageRatio = overlapRange / memberRange;
        const sectionFitRatio = overlapRange / sectionRange;
        
        return (coverageRatio * 0.6 + sectionFitRatio * 0.4);
    }
};
