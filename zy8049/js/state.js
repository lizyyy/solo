class GameState {
    constructor(level) {
        this.levelId = level.id;
        this.moveCount = 0;
        this.status = 'playing';
        this.failureMessage = '';
        this.history = [];
        
        this.switches = level.switches.map(s => ({ ...s }));
        this.signals = level.signals.map(s => ({ ...s }));
        this.sections = level.sections.map(s => ({ ...s }));
        this.trains = level.trains.map(t => ({ ...t }));
        
        this.updateSectionsOccupation();
        this.saveState();
    }

    deepCopy() {
        return {
            switches: JSON.parse(JSON.stringify(this.switches)),
            signals: JSON.parse(JSON.stringify(this.signals)),
            sections: JSON.parse(JSON.stringify(this.sections)),
            trains: JSON.parse(JSON.stringify(this.trains)),
            moveCount: this.moveCount
        };
    }

    saveState() {
        this.history.push(this.deepCopy());
        if (this.history.length > 50) {
            this.history.shift();
        }
    }

    restoreState() {
        if (this.history.length <= 1) return false;
        this.history.pop();
        const prev = this.history[this.history.length - 1];
        this.switches = prev.switches;
        this.signals = prev.signals;
        this.sections = prev.sections;
        this.trains = prev.trains;
        this.moveCount = prev.moveCount;
        this.status = 'playing';
        this.failureMessage = '';
        return true;
    }

    getSwitch(switchId) {
        return this.switches.find(s => s.id === switchId);
    }

    getSignal(signalId) {
        return this.signals.find(s => s.id === signalId);
    }

    getSection(sectionId) {
        return this.sections.find(s => s.id === sectionId);
    }

    getTrain(trainId) {
        return this.trains.find(t => t.id === trainId);
    }

    updateSectionsOccupation() {
        this.sections.forEach(sec => sec.occupied = false);
        this.trains.forEach(train => {
            const sec = this.getSection(train.sectionId);
            if (sec) sec.occupied = true;
        });
    }

    isSwitchOccupied(switchId) {
        const sw = this.getSwitch(switchId);
        if (!sw) return false;
        const track = this.getTrackById(sw.trackId);
        for (const sec of this.sections) {
            if (sec.tracks.includes(sw.trackId) && sec.occupied) {
                return true;
            }
        }
        return false;
    }

    getTrackById(trackId, levelData) {
        return levelData.tracks.find(t => t.id === trackId);
    }

    toggleSwitch(switchId) {
        const sw = this.getSwitch(switchId);
        if (!sw) return false;
        sw.position = sw.position === 'straight' ? 'diverging' : 'straight';
        this.moveCount++;
        this.saveState();
        return true;
    }

    toggleSignal(signalId) {
        const sig = this.getSignal(signalId);
        if (!sig) return false;
        sig.state = sig.state === 'closed' ? 'open' : 'closed';
        this.moveCount++;
        this.saveState();
        return true;
    }

    getNextSection(sectionId, levelData) {
        const currentSec = this.getSection(sectionId);
        if (!currentSec) return null;
        
        const connections = {
            'sec1': 'sec2',
            'sec2': ['sec3', 'sec4'],
            'sec3': null,
            'sec4': ['sec5', 'sec6'],
            'sec5': null,
            'sec6': 'sec7',
            'sec7': null,
            'sec8': 'sec9',
            'sec9': 'sec10',
            'sec10': null
        };

        let nextId = connections[sectionId];
        if (Array.isArray(nextId)) {
            const swTrackId = currentSec.tracks.find(t => {
                const sw = this.switches.find(s => s.trackId === t);
                return sw !== undefined;
            });
            if (swTrackId) {
                const sw = this.switches.find(s => s.trackId === swTrackId);
                if (sw) {
                    nextId = sw.position === 'straight' ? nextId[0] : nextId[1];
                }
            } else {
                nextId = nextId[0];
            }
        }
        return nextId ? this.getSection(nextId) : null;
    }

    moveTrainForward(trainId, levelData) {
        const train = this.getTrain(trainId);
        if (!train) return false;

        const nextSec = this.getNextSection(train.sectionId, levelData);
        if (!nextSec) {
            return false;
        }

        if (nextSec.occupied) {
            return false;
        }

        const currentSec = this.getSection(train.sectionId);
        currentSec.occupied = false;
        train.sectionId = nextSec.id;
        train.position = 0.3;
        nextSec.occupied = true;
        this.moveCount++;
        this.saveState();
        return true;
    }

    checkWin(levelData) {
        for (const train of this.trains) {
            if (train.sectionId !== train.goalSection) {
                return false;
            }
        }
        return true;
    }
}
