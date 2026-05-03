/**
 * CueDesk 风险检查模块
 * 负责检测彩排前的各种风险
 */

/**
 * 风险检查器类
 * 包含各种风险检测方法
 */
class RiskChecker {
    /**
     * 执行所有风险检查
     * @param {string} projectId - 项目ID
     * @returns {Array<Risk>} 风险列表
     */
    checkAll(projectId) {
        const cues = dataStore.getCues(projectId);
        if (cues.length === 0) {
            return [];
        }

        const risks = [];
        
        risks.push(...this.checkMissingAudioPaths(cues));
        risks.push(...this.checkTimeOverlap(cues));
        risks.push(...this.checkMicrophoneConflicts(cues));
        risks.push(...this.checkEmptyScriptWithResponsible(cues));
        risks.push(...this.checkUnconfirmedChanges(cues));
        risks.push(...this.checkMissingDuration(cues));
        risks.push(...this.checkMissingResponsible(cues));
        
        return risks.sort((a, b) => {
            const levelOrder = { high: 0, medium: 1, low: 2 };
            return levelOrder[a.level] - levelOrder[b.level];
        });
    }

    /**
     * 检查缺失的音频文件路径
     * @param {Array<Cue>} cues - 流程列表
     * @returns {Array<Risk>} 风险列表
     */
    checkMissingAudioPaths(cues) {
        const risks = [];
        const cuesWithMissingAudio = cues.filter(cue => 
            cue.audioPath && !this.isValidPath(cue.audioPath)
        );

        if (cuesWithMissingAudio.length > 0) {
            cuesWithMissingAudio.forEach(cue => {
                risks.push({
                    id: `missing-audio-${cue.id}`,
                    level: RISK_LEVELS.HIGH,
                    title: `音频文件路径无效`,
                    description: `流程 "${cue.name}" (顺序 ${cue.order}) 中的音频文件路径 "${cue.audioPath}" 可能无效或不存在。请检查路径是否正确。`,
                    relatedCueIds: [cue.id]
                });
            });
        }

        return risks;
    }

    /**
     * 检查相邻段落时长重叠
     * @param {Array<Cue>} cues - 流程列表
     * @returns {Array<Risk>} 风险列表
     */
    checkTimeOverlap(cues) {
        const risks = [];
        
        const cuesWithStartTime = cues.filter(cue => 
            cue.startTime && cue.duration > 0
        );

        for (let i = 0; i < cuesWithStartTime.length; i++) {
            for (let j = i + 1; j < cuesWithStartTime.length; j++) {
                const cue1 = cuesWithStartTime[i];
                const cue2 = cuesWithStartTime[j];

                if (this.doTimeRangesOverlap(
                    cue1.startTime, cue1.duration,
                    cue2.startTime, cue2.duration
                )) {
                    risks.push({
                        id: `time-overlap-${cue1.id}-${cue2.id}`,
                        level: RISK_LEVELS.HIGH,
                        title: `时间重叠`,
                        description: `流程 "${cue1.name}" (顺序 ${cue1.order}) 和流程 "${cue2.name}" (顺序 ${cue2.order}) 的时间存在重叠。${cue1.name} 从 ${cue1.startTime} 开始，时长 ${cue1.duration} 分钟；${cue2.name} 从 ${cue2.startTime} 开始，时长 ${cue2.duration} 分钟。请调整时间安排。`,
                        relatedCueIds: [cue1.id, cue2.id]
                    });
                }
            }
        }

        return risks;
    }

    /**
     * 检查同一时间段麦克风冲突
     * @param {Array<Cue>} cues - 流程列表
     * @returns {Array<Risk>} 风险列表
     */
    checkMicrophoneConflicts(cues) {
        const risks = [];
        
        const cuesWithMicAndTime = cues.filter(cue => 
            cue.microphones && cue.microphones.length > 0 && 
            cue.startTime && cue.duration > 0
        );

        const micToCues = new Map();
        cuesWithMicAndTime.forEach(cue => {
            cue.microphones.forEach(mic => {
                if (!micToCues.has(mic)) {
                    micToCues.set(mic, []);
                }
                micToCues.get(mic).push(cue);
            });
        });

        micToCues.forEach((cuesForMic, mic) => {
            for (let i = 0; i < cuesForMic.length; i++) {
                for (let j = i + 1; j < cuesForMic.length; j++) {
                    const cue1 = cuesForMic[i];
                    const cue2 = cuesForMic[j];

                    if (this.doTimeRangesOverlap(
                        cue1.startTime, cue1.duration,
                        cue2.startTime, cue2.duration
                    )) {
                        risks.push({
                            id: `mic-conflict-${mic}-${cue1.id}-${cue2.id}`,
                            level: RISK_LEVELS.HIGH,
                            title: `麦克风 ${mic} 冲突`,
                            description: `麦克风 ${mic} 在流程 "${cue1.name}" (顺序 ${cue1.order}) 和流程 "${cue2.name}" (顺序 ${cue2.order}) 中同时使用。${cue1.name} 从 ${cue1.startTime} 开始，时长 ${cue1.duration} 分钟；${cue2.name} 从 ${cue2.startTime} 开始，时长 ${cue2.duration} 分钟。请调整麦克风分配或时间安排。`,
                            relatedCueIds: [cue1.id, cue2.id]
                        });
                    }
                }
            }
        });

        return risks;
    }

    /**
     * 检查有人负责但口播词为空
     * @param {Array<Cue>} cues - 流程列表
     * @returns {Array<Risk>} 风险列表
     */
    checkEmptyScriptWithResponsible(cues) {
        const risks = [];
        const problematicCues = cues.filter(cue => 
            cue.responsible && cue.responsible.trim() !== '' && 
            (!cue.script || cue.script.trim() === '')
        );

        if (problematicCues.length > 0) {
            problematicCues.forEach(cue => {
                risks.push({
                    id: `empty-script-${cue.id}`,
                    level: RISK_LEVELS.MEDIUM,
                    title: `口播词缺失`,
                    description: `流程 "${cue.name}" (顺序 ${cue.order}) 分配了负责人 "${cue.responsible}"，但口播卡内容为空。请确认是否需要添加口播内容。`,
                    relatedCueIds: [cue.id]
                });
            });
        }

        return risks;
    }

    /**
     * 检查现场变更还没重新确认
     * @param {Array<Cue>} cues - 流程列表
     * @returns {Array<Risk>} 风险列表
     */
    checkUnconfirmedChanges(cues) {
        const risks = [];
        const changedCues = cues.filter(cue => 
            cue.status === CUE_STATUSES.CHANGED
        );

        if (changedCues.length > 0) {
            changedCues.forEach(cue => {
                risks.push({
                    id: `unconfirmed-change-${cue.id}`,
                    level: RISK_LEVELS.MEDIUM,
                    title: `现场变更待确认`,
                    description: `流程 "${cue.name}" (顺序 ${cue.order}) 状态为"现场变更"，但尚未重新确认。请在彩排前确认这些变更，并将状态更新为"已彩排"。`,
                    relatedCueIds: [cue.id]
                });
            });
        }

        return risks;
    }

    /**
     * 检查缺失预估时长的流程
     * @param {Array<Cue>} cues - 流程列表
     * @returns {Array<Risk>} 风险列表
     */
    checkMissingDuration(cues) {
        const risks = [];
        const cuesWithNoDuration = cues.filter(cue => 
            !cue.duration || cue.duration <= 0
        );

        if (cuesWithNoDuration.length > 0) {
            cuesWithNoDuration.forEach(cue => {
                risks.push({
                    id: `missing-duration-${cue.id}`,
                    level: RISK_LEVELS.LOW,
                    title: `预估时长缺失`,
                    description: `流程 "${cue.name}" (顺序 ${cue.order}) 没有设置预估时长。为了更好地进行时间规划和风险检查，建议添加预估时长。`,
                    relatedCueIds: [cue.id]
                });
            });
        }

        return risks;
    }

    /**
     * 检查没有负责人的流程
     * @param {Array<Cue>} cues - 流程列表
     * @returns {Array<Risk>} 风险列表
     */
    checkMissingResponsible(cues) {
        const risks = [];
        const cuesWithNoResponsible = cues.filter(cue => 
            !cue.responsible || cue.responsible.trim() === ''
        );

        if (cuesWithNoResponsible.length > 0) {
            cuesWithNoResponsible.forEach(cue => {
                risks.push({
                    id: `missing-responsible-${cue.id}`,
                    level: RISK_LEVELS.LOW,
                    title: `负责人缺失`,
                    description: `流程 "${cue.name}" (顺序 ${cue.order}) 没有分配负责人。为了确保责任明确，建议为每个流程指定负责人。`,
                    relatedCueIds: [cue.id]
                });
            });
        }

        return risks;
    }

    /**
     * 检查路径是否有效（简单检查）
     * @param {string} path - 文件路径
     * @returns {boolean} 是否有效
     */
    isValidPath(path) {
        if (!path || path.trim() === '') {
            return false;
        }

        const trimmedPath = path.trim();
        if (trimmedPath.length < 3) {
            return false;
        }

        const invalidChars = /[<>:"|?*]/;
        if (invalidChars.test(trimmedPath)) {
            return false;
        }

        return true;
    }

    /**
     * 检查两个时间范围是否重叠
     * @param {string} startTime1 - 开始时间1 (HH:mm 格式)
     * @param {number} duration1 - 时长1 (分钟)
     * @param {string} startTime2 - 开始时间2 (HH:mm 格式)
     * @param {number} duration2 - 时长2 (分钟)
     * @returns {boolean} 是否重叠
     */
    doTimeRangesOverlap(startTime1, duration1, startTime2, duration2) {
        const start1 = this.timeToMinutes(startTime1);
        const end1 = start1 + duration1;
        const start2 = this.timeToMinutes(startTime2);
        const end2 = start2 + duration2;

        return !(end1 <= start2 || end2 <= start1);
    }

    /**
     * 将 HH:mm 格式的时间转换为分钟数
     * @param {string} time - 时间字符串 (HH:mm)
     * @returns {number} 分钟数
     */
    timeToMinutes(time) {
        if (!time || !time.includes(':')) {
            return 0;
        }

        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * 根据风险级别获取图标
     * @param {string} level - 风险级别
     * @returns {string} 图标字符
     */
    getRiskIcon(level) {
        switch (level) {
            case RISK_LEVELS.HIGH:
                return '🔴';
            case RISK_LEVELS.MEDIUM:
                return '🟠';
            case RISK_LEVELS.LOW:
                return '🟡';
            default:
                return '⚪';
        }
    }

    /**
     * 格式化风险列表用于显示
     * @param {Array<Risk>} risks - 风险列表
     * @returns {Array<Object>} 格式化后的风险列表
     */
    formatRisksForDisplay(risks) {
        return risks.map(risk => ({
            ...risk,
            icon: this.getRiskIcon(risk.level),
            levelLabel: RISK_LEVEL_LABELS[risk.level] || risk.level,
            levelClass: `risk-${risk.level}`
        }));
    }
}

// 全局风险检查器实例
const riskChecker = new RiskChecker();

// 导出风险检查器（供其他脚本使用）
window.RiskChecker = RiskChecker;
window.riskChecker = riskChecker;
