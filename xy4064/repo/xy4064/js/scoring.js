const Scoring = {
    JUDGEMENT_TYPES: {
        PERFECT: 'perfect',
        GOOD: 'good',
        MISS: 'miss'
    },

    JUDGEMENT_WINDOWS: {
        perfect: 50,
        good: 150
    },

    SCORE_VALUES: {
        perfect: 100,
        good: 50,
        miss: 0
    },

    COMBO_MULTIPLIER: {
        base: 1,
        perCombo: 0.1,
        maxMultiplier: 5
    },

    stats: {
        score: 0,
        combo: 0,
        maxCombo: 0,
        perfectCount: 0,
        goodCount: 0,
        missCount: 0,
        totalNotes: 0,
        hitNotes: 0
    },

    noteStates: {},
    activeNotes: [],

    init: function(totalNotes) {
        this.stats = {
            score: 0,
            combo: 0,
            maxCombo: 0,
            perfectCount: 0,
            goodCount: 0,
            missCount: 0,
            totalNotes: totalNotes || 0,
            hitNotes: 0
        };
        this.noteStates = {};
        this.activeNotes = [];
    },

    reset: function() {
        this.init(0);
    },

    setActiveNotes: function(notes) {
        this.activeNotes = notes.filter(note => 
            !this.noteStates[note.id] || this.noteStates[note.id] === 'pending'
        );
    },

    getNoteState: function(noteId) {
        return this.noteStates[noteId] || 'pending';
    },

    setNoteState: function(noteId, state) {
        this.noteStates[noteId] = state;
    },

    calculateJudgement: function(noteTime, currentTime) {
        const timeDiff = Math.abs(currentTime - noteTime);

        if (timeDiff <= this.JUDGEMENT_WINDOWS.perfect) {
            return this.JUDGEMENT_TYPES.PERFECT;
        } else if (timeDiff <= this.JUDGEMENT_WINDOWS.good) {
            return this.JUDGEMENT_TYPES.GOOD;
        } else {
            return null;
        }
    },

    handleHit: function(note, currentTime, inputType) {
        if (!note || this.getNoteState(note.id) !== 'pending') {
            return null;
        }

        if (note.type !== inputType) {
            return null;
        }

        const judgement = this.calculateJudgement(note.time, currentTime);

        if (judgement) {
            this.processJudgement(judgement, note.id);
            return judgement;
        }

        return null;
    },

    handleMiss: function(noteId) {
        if (this.getNoteState(noteId) !== 'pending') {
            return;
        }

        this.processJudgement(this.JUDGEMENT_TYPES.MISS, noteId);
    },

    processJudgement: function(judgement, noteId) {
        this.setNoteState(noteId, judgement);

        switch (judgement) {
            case this.JUDGEMENT_TYPES.PERFECT:
                this.stats.perfectCount++;
                this.stats.hitNotes++;
                this.stats.combo++;
                if (this.stats.combo > this.stats.maxCombo) {
                    this.stats.maxCombo = this.stats.combo;
                }
                this.addScore(this.SCORE_VALUES.perfect);
                break;

            case this.JUDGEMENT_TYPES.GOOD:
                this.stats.goodCount++;
                this.stats.hitNotes++;
                this.stats.combo++;
                if (this.stats.combo > this.stats.maxCombo) {
                    this.stats.maxCombo = this.stats.combo;
                }
                this.addScore(this.SCORE_VALUES.good);
                break;

            case this.JUDGEMENT_TYPES.MISS:
                this.stats.missCount++;
                this.stats.combo = 0;
                break;
        }
    },

    addScore: function(baseScore) {
        const comboMultiplier = this.getComboMultiplier();
        const finalScore = Math.floor(baseScore * comboMultiplier);
        this.stats.score += finalScore;
    },

    getComboMultiplier: function() {
        const multiplier = this.COMBO_MULTIPLIER.base + 
                          (this.stats.combo * this.COMBO_MULTIPLIER.perCombo);
        return Math.min(multiplier, this.COMBO_MULTIPLIER.maxMultiplier);
    },

    checkMissedNotes: function(currentTime) {
        const missedNotes = [];
        
        for (const note of this.activeNotes) {
            if (this.getNoteState(note.id) === 'pending') {
                const missThreshold = note.time + this.JUDGEMENT_WINDOWS.good;
                if (currentTime > missThreshold) {
                    this.handleMiss(note.id);
                    missedNotes.push(note);
                }
            }
        }
        
        return missedNotes;
    },

    findMatchingNote: function(inputType, currentTime) {
        let bestNote = null;
        let bestTimeDiff = Infinity;

        for (const note of this.activeNotes) {
            if (this.getNoteState(note.id) !== 'pending') {
                continue;
            }

            if (note.type !== inputType) {
                continue;
            }

            const timeDiff = Math.abs(currentTime - note.time);
            
            if (timeDiff <= this.JUDGEMENT_WINDOWS.good && timeDiff < bestTimeDiff) {
                bestTimeDiff = timeDiff;
                bestNote = note;
            }
        }

        return bestNote;
    },

    getStats: function() {
        return { ...this.stats };
    },

    getAccuracy: function() {
        if (this.stats.totalNotes === 0) return 100;
        
        const totalPoints = this.stats.perfectCount * 2 + this.stats.goodCount;
        const maxPoints = this.stats.totalNotes * 2;
        
        return (totalPoints / maxPoints) * 100;
    },

    getGrade: function() {
        const accuracy = this.getAccuracy();
        
        if (accuracy >= 95) return 'S';
        if (accuracy >= 90) return 'A';
        if (accuracy >= 80) return 'B';
        if (accuracy >= 70) return 'C';
        return 'D';
    },

    isAllPerfect: function() {
        return this.stats.perfectCount === this.stats.totalNotes && 
               this.stats.missCount === 0;
    },

    isFullCombo: function() {
        return this.stats.maxCombo === this.stats.totalNotes && 
               this.stats.missCount === 0;
    },

    isCleared: function() {
        return this.getAccuracy() >= 70;
    }
};
