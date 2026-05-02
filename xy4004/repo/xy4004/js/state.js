(function(global) {
    'use strict';

    const CueState = {
        version: '1.0.0',
        cues: [],
        listeners: [],

        init: function() {
            this.cues = [];
            this.listeners = [];
        },

        generateId: function() {
            return 'cue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        createCue: function(data) {
            return {
                id: data.id || this.generateId(),
                number: data.number || '',
                startTime: data.startTime || 0,
                duration: data.duration !== undefined ? data.duration : null,
                description: data.description || '',
                group: data.group || '灯光',
                dependsOn: data.dependsOn || null,
                riskLevel: data.riskLevel || 'low',
                notes: data.notes || '',
                order: data.order !== undefined ? data.order : this.cues.length,
                actualStartTime: data.actualStartTime || null,
                actualEndTime: data.actualEndTime || null,
                status: data.status || 'pending'
            };
        },

        addCue: function(cueData) {
            const cue = this.createCue(cueData);
            this.cues.push(cue);
            this.recalculateStartTimes();
            this.notifyListeners('add', cue);
            return cue;
        },

        updateCue: function(id, updates) {
            const index = this.cues.findIndex(c => c.id === id);
            if (index === -1) return null;

            const oldCue = { ...this.cues[index] };
            this.cues[index] = { ...this.cues[index], ...updates };
            
            if ('order' in updates || 'dependsOn' in updates || 'duration' in updates) {
                this.recalculateStartTimes();
            }

            this.notifyListeners('update', { old: oldCue, new: this.cues[index] });
            return this.cues[index];
        },

        deleteCue: function(id) {
            const index = this.cues.findIndex(c => c.id === id);
            if (index === -1) return false;

            const deletedCue = this.cues.splice(index, 1)[0];
            
            this.cues.forEach((cue, i) => {
                if (cue.order > deletedCue.order) {
                    cue.order = i;
                }
                if (cue.dependsOn === id) {
                    cue.dependsOn = null;
                }
            });

            this.recalculateStartTimes();
            this.notifyListeners('delete', deletedCue);
            return true;
        },

        getCueById: function(id) {
            return this.cues.find(c => c.id === id) || null;
        },

        getCues: function() {
            return [...this.cues].sort((a, b) => a.order - b.order);
        },

        moveCueUp: function(id) {
            const index = this.cues.findIndex(c => c.id === id);
            if (index <= 0) return false;

            const currentCue = this.cues[index];
            const prevCue = this.cues[index - 1];
            
            const tempOrder = currentCue.order;
            currentCue.order = prevCue.order;
            prevCue.order = tempOrder;

            this.recalculateStartTimes();
            this.notifyListeners('reorder', { cue: currentCue, direction: 'up' });
            return true;
        },

        moveCueDown: function(id) {
            const index = this.cues.findIndex(c => c.id === id);
            if (index === -1 || index >= this.cues.length - 1) return false;

            const currentCue = this.cues[index];
            const nextCue = this.cues[index + 1];
            
            const tempOrder = currentCue.order;
            currentCue.order = nextCue.order;
            nextCue.order = tempOrder;

            this.recalculateStartTimes();
            this.notifyListeners('reorder', { cue: currentCue, direction: 'down' });
            return true;
        },

        moveCueToIndex: function(sourceId, targetIndex) {
            const sourceIndex = this.cues.findIndex(c => c.id === sourceId);
            if (sourceIndex === -1) return false;

            const sortedCues = this.getCues();
            const cueToMove = sortedCues[sourceIndex];
            
            sortedCues.splice(sourceIndex, 1);
            sortedCues.splice(targetIndex, 0, cueToMove);
            
            sortedCues.forEach((cue, index) => {
                cue.order = index;
            });

            this.recalculateStartTimes();
            this.notifyListeners('reorder', { cue: cueToMove, newIndex: targetIndex });
            return true;
        },

        recalculateStartTimes: function() {
            const sortedCues = this.getCues();
            
            const cueMap = new Map();
            sortedCues.forEach(cue => {
                cueMap.set(cue.id, { ...cue, startTime: 0 });
            });

            const visited = new Set();
            const visiting = new Set();

            const calculateStartTime = (cueId) => {
                const cue = cueMap.get(cueId);
                if (!cue) return 0;

                if (visited.has(cueId)) return cue.startTime;
                
                if (visiting.has(cueId)) {
                    cue.dependsOn = null;
                    return 0;
                }

                visiting.add(cueId);

                let maxDependencyTime = 0;
                
                if (cue.dependsOn && cueMap.has(cue.dependsOn)) {
                    const dependency = cueMap.get(cue.dependsOn);
                    const depStartTime = calculateStartTime(cue.dependsOn);
                    dependency.startTime = depStartTime;
                    const depEndTime = depStartTime + (dependency.duration || 0);
                    maxDependencyTime = Math.max(maxDependencyTime, depEndTime);
                }

                const sameGroupBefore = sortedCues.filter(c => {
                    if (c.id === cueId) return false;
                    if (c.group !== cue.group) return false;
                    return c.order < cue.order;
                });

                let latestGroupEnd = 0;
                sameGroupBefore.forEach(c => {
                    const cStartTime = calculateStartTime(c.id);
                    const cEndTime = cStartTime + (c.duration || 0);
                    if (cEndTime > latestGroupEnd) {
                        latestGroupEnd = cEndTime;
                    }
                });

                if (!cue.dependsOn) {
                    maxDependencyTime = Math.max(maxDependencyTime, latestGroupEnd);
                }

                cue.startTime = maxDependencyTime;
                visited.add(cueId);
                visiting.delete(cueId);

                return cue.startTime;
            };

            sortedCues.forEach(cue => {
                calculateStartTime(cue.id);
            });

            sortedCues.forEach(cue => {
                const updatedCue = cueMap.get(cue.id);
                if (updatedCue) {
                    cue.startTime = updatedCue.startTime;
                }
            });

            this.notifyListeners('recalculate', sortedCues);
        },

        resetRehearsalData: function() {
            this.cues.forEach(cue => {
                cue.actualStartTime = null;
                cue.actualEndTime = null;
                cue.status = 'pending';
            });
            this.notifyListeners('resetRehearsal', this.cues);
        },

        clearAll: function() {
            this.cues = [];
            this.notifyListeners('clear', null);
        },

        setState: function(cues) {
            this.cues = cues.map(c => this.createCue(c));
            this.recalculateStartTimes();
            this.notifyListeners('setState', this.cues);
        },

        getState: function() {
            return {
                version: this.version,
                cues: [...this.cues]
            };
        },

        subscribe: function(listener) {
            this.listeners.push(listener);
            return () => {
                const index = this.listeners.indexOf(listener);
                if (index > -1) {
                    this.listeners.splice(index, 1);
                }
            };
        },

        notifyListeners: function(action, data) {
            this.listeners.forEach(listener => {
                try {
                    listener(action, data);
                } catch (e) {
                    console.error('Listener error:', e);
                }
            });
        },

        formatTime: function(seconds) {
            if (seconds === null || seconds === undefined) return '--:--:--';
            const isNegative = seconds < 0;
            const absSeconds = Math.abs(seconds);
            const h = Math.floor(absSeconds / 3600);
            const m = Math.floor((absSeconds % 3600) / 60);
            const s = Math.floor(absSeconds % 60);
            const prefix = isNegative ? '-' : '';
            return prefix + 
                String(h).padStart(2, '0') + ':' +
                String(m).padStart(2, '0') + ':' +
                String(s).padStart(2, '0');
        },

        formatDuration: function(seconds) {
            if (seconds === null || seconds === undefined) return '--:--';
            const absSeconds = Math.abs(seconds);
            const m = Math.floor(absSeconds / 60);
            const s = Math.floor(absSeconds % 60);
            return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        },

        parseTime: function(timeStr) {
            if (!timeStr) return null;
            const parts = timeStr.split(':');
            if (parts.length === 3) {
                return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
            } else if (parts.length === 2) {
                return parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
            return parseInt(timeStr) || 0;
        }
    };

    CueState.init();
    global.CueState = CueState;

})(window);
