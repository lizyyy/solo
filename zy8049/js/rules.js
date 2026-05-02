const RuleEngine = {
    validateToggleSwitch(state, switchId) {
        const sw = state.getSwitch(switchId);
        if (!sw) {
            return { valid: false, message: '道岔不存在' };
        }

        if (state.isSwitchOccupied(switchId)) {
            return { valid: false, message: '道岔被占用，无法切换' };
        }

        return { valid: true };
    },

    validateToggleSignal(state, signalId) {
        const sig = state.getSignal(signalId);
        if (!sig) {
            return { valid: false, message: '信号机不存在' };
        }

        return { valid: true };
    },

    validateMoveTrain(state, trainId, levelData) {
        const train = state.getTrain(trainId);
        if (!train) {
            return { valid: false, message: '列车不存在' };
        }

        const nextSec = state.getNextSection(train.sectionId, levelData);
        if (!nextSec) {
            return { valid: false, message: '前方无可用轨道' };
        }

        if (nextSec.occupied) {
            return { valid: false, message: '前方区段被占用' };
        }

        const hasOpenSignal = this.checkSignalForSection(state, train.sectionId, levelData);
        if (!hasOpenSignal && levelData.signals.length > 0) {
            const entrySignal = levelData.signals.find(s => {
                const sec = levelData.sections.find(sec => sec.tracks.includes(s.trackId));
                return sec && sec.id === train.sectionId;
            });
            if (entrySignal) {
                return { valid: false, message: '信号机关闭，无法发车' };
            }
        }

        if (this.checkConflict(state, trainId, nextSec.id)) {
            return { valid: false, message: '调度冲突' };
        }

        return { valid: true };
    },

    checkSignalForSection(state, sectionId, levelData) {
        for (const sig of state.signals) {
            const sec = levelData.sections.find(s => s.tracks.includes(sig.trackId));
            if (sec && sec.id === sectionId && sig.state === 'open') {
                return true;
            }
        }
        return false;
    },

    checkConflict(state, movingTrainId, targetSectionId) {
        for (const train of state.trains) {
            if (train.id === movingTrainId) continue;
            const trainNextSec = state.getNextSection(train.sectionId, null);
            if (trainNextSec && trainNextSec.id === targetSectionId) {
                return true;
            }
        }
        return false;
    },

    executeToggleSwitch(state, switchId) {
        const validation = this.validateToggleSwitch(state, switchId);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }
        state.toggleSwitch(switchId);
        return { success: true };
    },

    executeToggleSignal(state, signalId) {
        const validation = this.validateToggleSignal(state, signalId);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }
        state.toggleSignal(signalId);
        return { success: true };
    },

    executeMoveTrain(state, trainId, levelData) {
        const validation = this.validateMoveTrain(state, trainId, levelData);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }
        const success = state.moveTrainForward(trainId, levelData);
        if (!success) {
            return { success: false, message: '移动失败' };
        }
        return { success: true };
    }
};
