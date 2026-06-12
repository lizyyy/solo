"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOUNDARY_RULES = void 0;
exports.validateStatusTransition = validateStatusTransition;
exports.detectDualNameSong = detectDualNameSong;
const types_1 = require("./types");
exports.BOUNDARY_RULES = {
    songDualName: {
        description: '同一首歌同时存在现场名和版权名的处理规则',
        howToJudge: (song) => {
            return song.liveName.trim() !== '' &&
                song.copyrightName.trim() !== '' &&
                song.liveName.trim() !== song.copyrightName.trim();
        },
        howToProcess: () => {
            return types_1.ProcessingStatus.NEEDS_TEACHER_REVIEW;
        },
        howToRollback: () => {
            return types_1.ProcessingStatus.PENDING_REVIEW;
        },
        explanation: '老周你好：一首歌现场叫"青花瓷(即兴版)"，版权登记叫"青花瓷"，这不是bug。先别急着归正常，留给音乐老师确认一下两个名字是不是真的指同一首歌。'
    },
    statusTransition: {
        allowedTransitions: {
            [types_1.ProcessingStatus.PENDING_REVIEW]: [types_1.ProcessingStatus.NORMAL, types_1.ProcessingStatus.ABNORMAL, types_1.ProcessingStatus.NEEDS_TEACHER_REVIEW],
            [types_1.ProcessingStatus.NEEDS_TEACHER_REVIEW]: [types_1.ProcessingStatus.NORMAL, types_1.ProcessingStatus.ABNORMAL, types_1.ProcessingStatus.PENDING_REVIEW],
            [types_1.ProcessingStatus.NORMAL]: [types_1.ProcessingStatus.ABNORMAL, types_1.ProcessingStatus.NEEDS_TEACHER_REVIEW],
            [types_1.ProcessingStatus.ABNORMAL]: [types_1.ProcessingStatus.NORMAL, types_1.ProcessingStatus.NEEDS_TEACHER_REVIEW],
        },
        explanation: '状态就像调琴弦：松了要紧，紧了要松，但不能从断弦直接跳到调好。每一步都要有人看过才行。'
    },
    manualChange: {
        requiredFields: ['changedBy', 'field', 'oldValue', 'newValue', 'reason'],
        explanation: '改记录要像调音师留便签：谁改的、改了啥、原来啥样、为啥改，一个都不能少。音乐老师追问时要能拿出来对质。'
    }
};
function validateStatusTransition(from, to) {
    const allowed = exports.BOUNDARY_RULES.statusTransition.allowedTransitions[from] || [];
    return allowed.includes(to);
}
function detectDualNameSong(song) {
    return exports.BOUNDARY_RULES.songDualName.howToJudge(song);
}
